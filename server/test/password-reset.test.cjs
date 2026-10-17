const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { AppService } = require('../dist/app.service.js');

test('platform admin password reset emails a one-time code and accepts it once', async () => {
  const service = Object.create(AppService.prototype);
  Object.assign(service, {
    superAdminEmail: 'platform-admin@example.com',
    superAdminName: 'Platform Admin',
    superAdminPasswordHash: bcrypt.hashSync('old-password-123', 4),
    superAdminPasswordResetCodeHash: null,
    superAdminPasswordResetExpiresAt: null,
    tenants: {},
    pendingPostgresWrite: Promise.resolve(),
    resendApiKey: 're_test_key',
    emailFrom: 'CareStack <no-reply@example.com>',
  });
  let persistedStates = 0;
  service.persistState = () => { persistedStates += 1; };

  const originalFetch = global.fetch;
  let sentRequest;
  global.fetch = async (url, options) => {
    sentRequest = { url, options };
    return { ok: true, text: async () => '' };
  };

  try {
    const response = await service.requestPasswordReset(' PLATFORM-ADMIN@example.com ');
    assert.match(response.message, /reset code has been sent/);
    assert.equal(sentRequest.url, 'https://api.resend.com/emails');
    assert.equal(sentRequest.options.method, 'POST');
    assert.equal(sentRequest.options.headers.Authorization, 'Bearer re_test_key');

    const email = JSON.parse(sentRequest.options.body);
    assert.deepEqual(email.to, ['platform-admin@example.com']);
    assert.equal(email.from, 'CareStack <no-reply@example.com>');
    assert.equal(email.subject, 'Your CareStack platform password reset code');
    const code = email.text.match(/reset code is: (\d{6})/)?.[1];
    assert.ok(code, 'email should contain a six-digit one-time code');
    assert.equal(service.superAdminPasswordResetCodeHash, createHash('sha256').update(code).digest('hex'));
    assert.ok(service.superAdminPasswordResetExpiresAt > Date.now());
    const incorrectCode = code === '000000' ? '000001' : '000000';
    assert.equal(await service.resetPassword('platform-admin@example.com', incorrectCode, 'new-password-456'), false);
    assert.equal(await bcrypt.compare('old-password-123', service.superAdminPasswordHash), true);

    assert.equal(await service.resetPassword('platform-admin@example.com', code, 'new-password-456'), true);
    assert.equal(await bcrypt.compare('new-password-456', service.superAdminPasswordHash), true);
    assert.equal(service.superAdminPasswordResetCodeHash, null);
    assert.equal(service.superAdminPasswordResetExpiresAt, null);
    assert.equal(await service.resetPassword('platform-admin@example.com', code, 'another-password-789'), false);
    assert.equal(persistedStates, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('platform admin reset rejects expired email codes', async () => {
  const service = Object.create(AppService.prototype);
  Object.assign(service, {
    superAdminEmail: 'platform-admin@example.com',
    superAdminPasswordHash: bcrypt.hashSync('old-password-123', 4),
    superAdminPasswordResetCodeHash: createHash('sha256').update('123456').digest('hex'),
    superAdminPasswordResetExpiresAt: Date.now() - 1,
    pendingPostgresWrite: Promise.resolve(),
  });

  assert.equal(await service.resetPassword('platform-admin@example.com', '123456', 'new-password-456'), false);
  assert.equal(await bcrypt.compare('old-password-123', service.superAdminPasswordHash), true);
});
