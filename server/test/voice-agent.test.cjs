const test = require('node:test');
const assert = require('node:assert/strict');

test('booking orchestration uses the configured private Python agent URL', async () => {
  const { AppController } = require('../dist/app.controller.js');
  const service = {
    validateAgentBooking: () => null,
    addBooking: (_tenantId, appointment) => appointment,
  };
  const controller = new AppController(service, null);
  const priorFetch = global.fetch;
  const priorUrl = process.env.PYTHON_AGENT_URL;
  let requestedUrl = '';
  process.env.PYTHON_AGENT_URL = 'carestack-uat-agent:10000';
  global.fetch = async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => ({ appointment: { id: 'APT-UAT-1' } }) };
  };
  try {
    const result = await controller.triggerOrchestration({ tenant_id: 'tenant-test', appointment_time: '10:30' });
    assert.equal(requestedUrl, 'http://carestack-uat-agent:10000/api/agent/phone-booking');
    assert.equal(result.appointment.id, 'APT-UAT-1');
  } finally {
    global.fetch = priorFetch;
    if (priorUrl === undefined) delete process.env.PYTHON_AGENT_URL;
    else process.env.PYTHON_AGENT_URL = priorUrl;
  }
});

test('voice tools use tenant calendar, require confirmation, and make retries idempotent', async () => {
  const { AppService } = require('../dist/app.service.js');
  const { AppController } = require('../dist/app.controller.js');
  const service = Object.create(AppService.prototype);
  process.env.VOICE_TOOL_SECRET = 'test-master-secret-that-is-at-least-32-characters';
  service.tenants = {
    'tenant-skycare': {
      id: 'tenant-skycare', name: 'SkyCare Multi-Speciality', admin_phone: '+919876543210',
      voice_agent: { enabled: true, availability: 'all_day', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata' },
      telephony: { phone_number: '+919876543211' }, patients: [], bookings: [],
    },
  };
  service.persistState = () => {};
  const controller = new AppController(service, null);
  const clinicSecret = service.getVoiceToolSecret('tenant-skycare');

  const details = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'clinic_info' });
  assert.equal(details.clinic_name, 'SkyCare Multi-Speciality');
  assert.equal(details.address, null);
  assert.deepEqual(details.faqs, []);

  const request = {
    action: 'book', request_id: 'call-request-001', confirmed: true,
    patient_name: 'Test Patient', phone_number: '+919876543210', doctor_name: 'Dr. Test',
    date: '2030-04-10', time: '11:00', reason: 'Test appointment',
  };
  const first = await controller.voiceTool('tenant-skycare', clinicSecret, request);
  assert.equal(first.appointment.status, 'confirmed');
  assert.equal(first.appointment.duration_minutes, 30);
  assert.equal(first.idempotent_replay, false);
  const retry = await controller.voiceTool('tenant-skycare', clinicSecret, request);
  assert.equal(retry.appointment.id, first.appointment.id);
  assert.equal(retry.idempotent_replay, true);
  const occupied = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'availability', date: request.date, time: request.time, doctor_name: request.doctor_name });
  assert.equal(occupied.available, false);
  const overlapping = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'availability', date: request.date, time: '11:15', doctor_name: request.doctor_name });
  assert.equal(overlapping.available, false);
  assert.match(overlapping.message, /overlaps an existing booking/);
  const backToBack = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'availability', date: request.date, time: '11:30', doctor_name: request.doctor_name });
  assert.equal(backToBack.available, true);
  const anotherDoctor = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'availability', date: request.date, time: '11:15', doctor_name: 'Dr. Other' });
  assert.equal(anotherDoctor.available, true);
  const overlapBooking = await controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'overlap-request-001', time: '11:15' });
  assert.match(overlapBooking.error, /overlaps an existing booking/);

  const unconfirmed = await controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'call-request-002', confirmed: false });
  assert.match(unconfirmed.error, /confirmation/);
  const handoff = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'cancel' });
  assert.match(handoff.error, /human receptionist/);
  const invalidDate = await controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'call-request-003', date: '2030-02-31' });
  assert.match(invalidDate.error, /future date/);
  await assert.rejects(controller.voiceTool('other-clinic', service.getVoiceToolSecret('other-clinic'), { action: 'clinic_info' }), /Clinic not found/);
  await assert.rejects(controller.voiceTool('tenant-skycare', 'wrong-clinic-secret', { action: 'clinic_info' }), /Voice tool authentication failed/);
  assert.equal(service.validateVoiceToolSecret('tenant-skycare', clinicSecret), true);
  assert.equal(service.validateVoiceToolSecret('other-clinic', clinicSecret), false);
});

test('clinic context is bounded, persisted, and exposed through safe FAQ lookup', () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  const tenant = { id: 'tenant-context', name: 'Context Clinic', admin_phone: '+919876543210', patients: [], bookings: [], voice_agent: undefined };
  service.tenants = { [tenant.id]: tenant };
  service.persistState = () => {};
  const saved = service.updateVoiceAgent(tenant.id, { clinic_context: {
    address: '12 Main Road', services: ['Dental care', ' '.repeat(4)], doctors: ['Dr. Rao'], fees: 'Consultation ₹500',
    languages: ['Hindi', 'English'], instructions: 'Ask caller to arrive early.', faqs: [{ question: 'Do you provide dental care?', answer: 'Yes, dental consultations are available.' }],
  } });
  assert.equal(saved.clinic_context.address, '12 Main Road');
  assert.deepEqual(service.voiceTool(tenant.id, { action: 'clinic_info' }).services, ['Dental care']);
  assert.equal(service.voiceTool(tenant.id, { action: 'faq', question: 'Do you provide dental care?' }).answer, 'Yes, dental consultations are available.');
  assert.equal(service.voiceTool(tenant.id, { action: 'faq', question: 'Do you have parking?' }).handoff, true);
  assert.equal(service.previewVoiceAgent(tenant.id, 'Do you provide dental care?').reply, 'Yes, dental consultations are available.');
  assert.equal(service.updateVoiceAgent(tenant.id, { clinic_context: { address: 'x'.repeat(600) } }).clinic_context.address.length, 500);
});

test('Sarvam deployment adapter sends the clinic number and configured inbound hours', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.SARVAM_API_KEY = 'test-sarvam-key';
  process.env.VOICE_TOOL_SECRET = 'test-master-secret-that-is-at-least-32-characters';
  const tenant = {
    id: 'tenant-demo', name: 'Demo Clinic', admin_phone: '+919876543210', patients: [], bookings: [],
    voice_agent: { enabled: true, availability: 'business_hours', open_time: '08:30', close_time: '19:00', timezone: 'Asia/Kolkata' },
    telephony: { provider: 'exotel', phone_number: '+919876543211', account_sid: 'account', app_id: 'flow', region: 'mumbai', enabled: false, sarvam_org_id: 'org', sarvam_workspace_id: 'workspace', sarvam_agent_id: 'agent', sarvam_agent_version: 4, sarvam_connection_id: 'connection' },
  };
  service.tenants = { 'tenant-demo': tenant };
  service.persistState = () => {};
  const priorFetch = global.fetch;
  let observed;
  global.fetch = async (url, options) => {
    observed = { url, options, payload: JSON.parse(options.body) };
    return { ok: true, status: 200, json: async () => ({ deployment_id: 'deployment-test-123' }) };
  };
  try {
    const result = await service.activateVoiceDeployment('tenant-demo');
    assert.equal(result.deployment_id, 'deployment-test-123');
    assert.equal(tenant.telephony.enabled, true);
    assert.deepEqual(observed.payload.connection_configs[0].phone_numbers, ['+919876543211']);
    assert.deepEqual(observed.payload.inbound_config, {
      start_time: '08:30', end_time: '19:00',
      allowed_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      timezone: 'Asia/Kolkata',
    });
    assert.equal(observed.options.headers['X-API-Key'], 'test-sarvam-key');
  } finally {
    global.fetch = priorFetch;
  }
});

test('Exotel provider checks clinic account credentials without placing a call', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.EXOTEL_API_KEY = 'test-exotel-key';
  process.env.EXOTEL_API_TOKEN = 'test-exotel-token';
  const tenant = {
    id: 'tenant-exotel', name: 'Exotel Clinic', patients: [], bookings: [],
    telephony: { voice_provider: 'exotel_voicebot', phone_number: '+919876543211', account_sid: 'account-123', region: 'mumbai' },
  };
  service.tenants = { 'tenant-exotel': tenant };
  const priorFetch = global.fetch;
  let observed;
  global.fetch = async (url, options) => {
    observed = { url, options };
    return { ok: true, status: 200 };
  };
  try {
    const result = await service.verifyExotelConnection('tenant-exotel');
    assert.equal(result.connected, true);
    assert.match(observed.url, /^https:\/\/api\.in\.exotel\.com\/v1\/Accounts\/account-123\/Balance\.json$/);
    assert.equal(observed.options.headers.Authorization, `Basic ${Buffer.from('test-exotel-key:test-exotel-token').toString('base64')}`);
  } finally {
    global.fetch = priorFetch;
  }
});

test('Exotel authentication failures explain the required CPaaS credentials', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.EXOTEL_API_KEY = 'test-exotel-key';
  process.env.EXOTEL_API_TOKEN = 'test-exotel-token';
  service.tenants = { 'tenant-exotel': { id: 'tenant-exotel', patients: [], bookings: [], telephony: { account_sid: 'account-123', region: 'mumbai' } } };
  const priorFetch = global.fetch;
  let responseStatus = 401;
  global.fetch = async () => ({ ok: false, status: responseStatus });
  try {
    const result = await service.verifyExotelConnection('tenant-exotel');
    assert.match(result.error, /HTTP 401.*CPaaS API Key\/API Token/);
    responseStatus = 403;
    const accountError = await service.verifyExotelConnection('tenant-exotel');
    assert.match(accountError.error, /HTTP 403.*Account SID/);
  } finally {
    global.fetch = priorFetch;
  }
});

test('Exotel form credentials are encrypted at rest and omitted from public settings', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-secret-at-least-32-characters';
  delete process.env.EXOTEL_API_KEY;
  delete process.env.EXOTEL_API_TOKEN;
  const tenant = { id: 'tenant-form-creds', name: 'Form Clinic', patients: [], bookings: [] };
  service.tenants = { [tenant.id]: tenant };
  service.persistState = () => {};
  const config = service.updateTenantTelephony(tenant.id, {
    voice_provider: 'exotel_voicebot', phone_number: '+919876543211', account_sid: 'account-form', region: 'mumbai',
    exotel_api_key: 'clinic-api-key', exotel_api_token: 'clinic-api-token',
  });
  assert.equal(config.exotel_credentials_configured, true);
  assert.equal('exotel_api_key' in config, false);
  assert.equal('exotel_api_token' in config, false);
  assert.notEqual(tenant.telephony.exotel_api_key_encrypted, 'clinic-api-key');
  const liveConfig = service.updateTenantTelephony(tenant.id, { voice_provider: 'exotel_voicebot', phone_number: '+919876543211', account_sid: 'account-form', region: 'mumbai', app_id: 'updated-flow', exotel_voicebot_id: 'published-bot', enabled: true });
  assert.equal(liveConfig.enabled, true);
  assert.equal(liveConfig.deployment_status, 'active');
  const priorFetch = global.fetch;
  let authorization;
  global.fetch = async (_url, options) => { authorization = options.headers.Authorization; return { ok: true, status: 200 }; };
  try {
    const result = await service.verifyExotelConnection(tenant.id);
    assert.equal(result.connected, true);
    assert.equal(authorization, `Basic ${Buffer.from('clinic-api-key:clinic-api-token').toString('base64')}`);
  } finally { global.fetch = priorFetch; }
});

test('Sarvam and Exotel calling settings remain isolated when switching providers', () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-secret-at-least-32-characters';
  const tenant = { id: 'tenant-provider-split', patients: [], bookings: [] };
  service.tenants = { [tenant.id]: tenant };
  service.persistState = () => {};
  service.updateTenantTelephony(tenant.id, {
    voice_provider: 'exotel_voicebot', phone_number: '+919876543211', account_sid: 'exotel-account', app_id: 'exotel-flow',
    region: 'mumbai', exotel_voicebot_id: 'voicebot-1', exotel_api_key: 'private-key', exotel_api_token: 'private-token',
  });
  service.updateTenantTelephony(tenant.id, {
    voice_provider: 'sarvam', phone_number: '+919876543212', account_sid: 'sarvam-account', app_id: 'sarvam-flow', region: 'singapore',
    sarvam_org_id: 'org-1', sarvam_workspace_id: 'workspace-1', sarvam_agent_id: 'agent-1', sarvam_agent_version: 2, sarvam_connection_id: 'connection-1',
  });
  assert.equal(tenant.telephony.phone_number, '+919876543212');
  assert.equal(tenant.telephony.account_sid, 'sarvam-account');
  assert.equal(tenant.telephony.provider_configs.exotel_voicebot.phone_number, '+919876543211');
  assert.equal(tenant.telephony.provider_configs.exotel_voicebot.app_id, 'exotel-flow');
  assert.equal(tenant.telephony.provider_configs.sarvam.phone_number, '+919876543212');
  assert.equal(tenant.telephony.provider_configs.sarvam.sarvam_agent_id, 'agent-1');
  const publicConfig = service.updateTenantTelephony(tenant.id, {
    voice_provider: 'exotel_voicebot', ...tenant.telephony.provider_configs.exotel_voicebot,
  });
  assert.equal(publicConfig.phone_number, '+919876543211');
  assert.equal(publicConfig.account_sid, 'exotel-account');
  assert.equal(publicConfig.provider_configs.sarvam.phone_number, '+919876543212');
  assert.equal('exotel_api_key' in publicConfig.provider_configs.exotel_voicebot, false);
  assert.equal(tenant.telephony.exotel_api_key_encrypted === 'private-key', false);
});

test('calling setup reports specific phone number validation errors', async () => {
  const { AppService } = require('../dist/app.service.js');
  const { AppController } = require('../dist/app.controller.js');
  const service = Object.create(AppService.prototype);
  service.tenants = {
    'clinic-one': { id: 'clinic-one', patients: [], bookings: [] },
    'clinic-two': { id: 'clinic-two', patients: [], bookings: [], telephony: { phone_number: '+919876543210', voice_provider: 'exotel_voicebot' } },
  };
  service.persistState = () => {};
  const controller = new AppController(service, null);
  assert.throws(
    () => controller.updateTenantTelephony('clinic-one', { voice_provider: 'sarvam', phone_number: '01143060445' }),
    (error) => /international E\.164 format/.test(error.response.message),
  );
  assert.throws(
    () => controller.updateTenantTelephony('clinic-one', { voice_provider: 'sarvam', phone_number: '+919876543210' }),
    (error) => /already assigned to another clinic/.test(error.response.message),
  );
});
