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
      voice_agent: { enabled: true, availability: 'all_day', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', clinic_context: { doctors: ['Dr. Test', 'Dr. Other'] } },
      telephony: { phone_number: '+919876543211' }, patients: [], bookings: [],
    },
    'tenant-other': {
      id: 'tenant-other', name: 'Other Clinic', admin_phone: '+919876543212',
      voice_agent: { enabled: true, availability: 'all_day', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata' },
      telephony: { phone_number: '+919876543213' }, patients: [], bookings: [],
    },
  };
  service.persistState = () => {};
  const controller = new AppController(service, null);
  const clinicSecret = service.getVoiceToolSecret('tenant-skycare');

  const details = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'clinic_info' });
  assert.equal(details.clinic_name, 'SkyCare Multi-Speciality');
  assert.equal(details.address, null);
  assert.deepEqual(details.faqs, []);
  const bearerDetails = await controller.voiceTool('tenant-skycare', '', { action: 'clinic_info' }, `Bearer ${clinicSecret}`);
  assert.equal(bearerDetails.clinic_name, 'SkyCare Multi-Speciality');
  await assert.rejects(controller.voiceTool('tenant-skycare', undefined, { action: 'clinic_info' }), /Voice tool authentication failed/);
  await assert.rejects(controller.voiceTool('tenant-skycare', '', { action: 'clinic_info' }, 'Basic invalid'), /Voice tool authentication failed/);
  await assert.rejects(controller.voiceTool('tenant-skycare', 'invalid-secret', { action: 'clinic_info' }), /Voice tool authentication failed/);
  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, undefined), /Unsupported action/);
  await assert.rejects(controller.voiceTool('tenant-other', clinicSecret, { action: 'clinic_info' }), /Voice tool authentication failed/);
  const urlTenantWins = await controller.voiceTool('tenant-skycare', clinicSecret, { action: 'clinic_info' }, undefined, 'notdecidedyet5');
  assert.equal(urlTenantWins.clinic_name, 'SkyCare Multi-Speciality');
  const otherClinicSecret = service.getVoiceToolSecret('tenant-other');
  assert.equal((await controller.voiceTool('tenant-other', otherClinicSecret, { action: 'clinic_info' })).clinic_name, 'Other Clinic');
  assert.equal(service.validateVoiceToolSecret('../tenant-skycare', clinicSecret), false);
  assert.equal(service.getVoiceToolSecret('../tenant-skycare'), '');

  const request = {
    action: 'book', request_id: 'call-request-001', confirmed: true,
    patient_name: 'Test Patient', phone_number: '+919876543210', doctor_name: 'Dr. Test',
    date: '2030-04-10', time: '11:00', reason: 'Test appointment',
  };
  const first = await controller.voiceTool('tenant-skycare', clinicSecret, request);
  assert.equal(first.appointment.status, 'confirmed');
  assert.match(first.appointment.id, /^VOICE-call-request-001$/);
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
  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'overlap-request-001', time: '11:15' }), /overlaps an existing booking/);

  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'call-request-002', confirmed: false }), /confirmation/);
  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, { action: 'book', confirmed: true }), /request_id, patient_name, phone_number, date, time, reason/);
  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, { action: 'cancel' }), /human receptionist/);
  await assert.rejects(controller.voiceTool('tenant-skycare', clinicSecret, { ...request, request_id: 'call-request-003', date: '2030-02-31' }), /date such as today or tomorrow/);
  await assert.rejects(controller.voiceTool('tenant-unknown', service.getVoiceToolSecret('tenant-unknown'), { action: 'clinic_info' }), /Clinic not found/);
  const normalizedAction = await controller.voiceTool('tenant-skycare', clinicSecret, { ...request, action: ' BOOK ', request_id: 'call-request-normalized', time: '12:00' });
  assert.equal(normalizedAction.appointment.id, 'VOICE-call-request-normalized');
  assert.equal(service.validateVoiceToolSecret('tenant-skycare', clinicSecret), true);
  assert.equal(service.validateVoiceToolSecret('other-clinic', clinicSecret), false);
  const configuredMasterSecret = process.env.VOICE_TOOL_SECRET;
  try {
    delete process.env.VOICE_TOOL_SECRET;
    assert.equal(service.validateVoiceToolSecret('tenant-skycare', clinicSecret), false);
  } finally {
    process.env.VOICE_TOOL_SECRET = configuredMasterSecret;
  }
});

test('voice tool dispatch accepts direct and supported wrapped arguments and safely diagnoses the request shape', async () => {
  const { AppService } = require('../dist/app.service.js');
  const { AppController } = require('../dist/app.controller.js');
  const service = Object.create(AppService.prototype);
  process.env.VOICE_TOOL_SECRET = 'test-master-secret-that-is-at-least-32-characters';
  service.tenants = {
    'tenant-skycare': {
      id: 'tenant-skycare', name: 'SkyCare', admin_phone: '+919876543210', patients: [], bookings: [],
      voice_agent: {
        enabled: true, availability: 'all_day', open_time: '00:00', close_time: '23:59', timezone: 'Asia/Kolkata',
        clinic_context: { address: '', services: [], fees: '', doctors: ['Dr. Rao'], languages: ['Hindi'], instructions: '', faqs: [{ question: 'Where are you?', answer: 'At the configured clinic address.' }] },
      },
    },
  };
  service.persistState = () => {};
  service.isFutureClinicDate = () => true;
  const controller = new AppController(service, null);
  const secret = service.getVoiceToolSecret('tenant-skycare');
  const emittedLogs = [];
  controller.logger = { log: (line) => emittedLogs.push(line) };

  // The API accepts direct arguments and known wrapper formats from tool adapters.
  const clinicInfo = await controller.voiceTool('tenant-skycare', secret, { action: 'clinic_info' }, '', '', 'application/json');
  assert.equal(clinicInfo.clinic_name, 'SkyCare');
  const faq = await controller.voiceTool('tenant-skycare', secret, { action: 'faq', question: 'Where are you?' }, '', '', 'application/json');
  assert.equal(faq.matched, true);
  const availability = await controller.voiceTool('tenant-skycare', secret, {
    action: 'availability', date: '2099-04-10', time: '11:00', doctor_name: 'Dr. Rao',
  }, '', '', 'application/json');
  assert.equal(availability.available, true);
  const booking = await controller.voiceTool('tenant-skycare', secret, {
    action: 'book', request_id: 'exotel-call-001', confirmed: true, patient_name: 'Sensitive Patient Name',
    phone_number: '+919876543210', doctor_name: 'Dr. Rao', date: '2099-04-10', time: '11:00', reason: 'Consultation',
  }, '', '', 'application/json');
  assert.equal(booking.appointment.id, 'VOICE-exotel-call-001');

  const shapeLog = JSON.parse(emittedLogs[1]);
  assert.equal(shapeLog.event, 'voice_tool.request_timing');
  assert.equal(shapeLog.received_action, 'faq');
  assert.equal(shapeLog.content_type, 'application/json');
  assert.deepEqual(shapeLog.body_field_names, ['action', 'question']);
  assert.doesNotMatch(emittedLogs.join('\n'), /test-master-secret|Sensitive Patient Name|\+919876543210|Consultation/);

  const wrappedClinicInfo = await controller.voiceTool('tenant-skycare', secret, { arguments: { action: 'clinic_info' } }, '', '', 'application/json');
  assert.equal(wrappedClinicInfo.clinic_name, 'SkyCare');
  const inferredAvailability = await controller.voiceTool('tenant-skycare', secret, {
    parameters: { date: '2099-04-10', time: '11:30', doctorName: '' },
  }, '', '', 'application/json');
  assert.equal(inferredAvailability.available, true);
  await assert.rejects(controller.voiceTool('tenant-skycare', secret, {}, '', '', 'application/json'), /Could not determine the tool action/);
  await assert.rejects(controller.voiceTool('tenant-skycare', secret, { action: 'appointments' }, '', '', 'application/json'), /Unsupported action/);
  const unsupportedLog = JSON.parse(emittedLogs.at(-1));
  assert.equal(unsupportedLog.received_action, 'unsupported');
  assert.equal(unsupportedLog.action_field_present, true);
  assert.deepEqual(unsupportedLog.body_field_names, ['action']);
});

test('availability accepts the Exotel schema fields and Hinglish dates without inventing a doctor', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.VOICE_TOOL_SECRET = 'test-master-secret-that-is-at-least-32-characters';
  service.tenants = {
    'tenant-skycare': {
      id: 'tenant-skycare', name: 'SkyCare', admin_phone: '+919876543210', patients: [], bookings: [],
      voice_agent: {
        enabled: true, availability: 'all_day', open_time: '00:00', close_time: '23:59', timezone: 'Asia/Kolkata',
        clinic_context: { doctors: ['Dr. Rao', 'Dr. Mehta'], services: [], faqs: [], languages: ['Hindi', 'English'] },
      },
    },
  };
  service.persistState = () => {};
  // Keep these parser/tool-contract tests independent of the time of day they run.
  service.isFutureClinicDate = () => true;

  // The Exotel tool schema requires all four inputs, even when no doctor is preferred.
  const availabilitySchema = require('../schemas/exotel-carestack-check-availability.schema.json');
  assert.deepEqual(availabilitySchema.required, ['action', 'date', 'time', 'doctor_name']);
  for (const field of availabilitySchema.required) assert.equal(availabilitySchema.properties[field].type, 'string');

  // The exact four-field argument shape required by the Exotel error contract
  // for “aaj 12 baje”. Backend date normalization uses the runtime clinic date.
  const todayRequest = { action: 'availability', date: 'aaj', time: '12:00', doctor_name: '' };
  assert.deepEqual(Object.keys(todayRequest), availabilitySchema.required);
  const hinglishDate = service.normalizeVoiceDate('tenant-skycare', 'aaj');
  const expectedToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  assert.equal(hinglishDate, expectedToday);
  assert.equal(service.normalizeVoiceTime('12 baje'), '12:00');
  assert.equal(service.normalizeVoiceDate('tenant-skycare', 'kal'), service.normalizeVoiceDate('tenant-skycare', 'tomorrow'));
  assert.equal(service.normalizeVoiceTime('shaam 5 baje'), '17:00');

  const todayAvailability = await service.voiceTool('tenant-skycare', todayRequest);
  assert.equal(todayAvailability.date, expectedToday);
  assert.equal(todayAvailability.time, '12:00');
  assert.deepEqual(todayAvailability.available_doctors, ['Dr. Rao', 'Dr. Mehta']);

  const eveningRequest = { action: 'availability', date: 'kal', time: '17:00', doctor_name: '' };
  assert.deepEqual(Object.keys(eveningRequest), availabilitySchema.required);
  const eveningAvailability = await service.voiceTool('tenant-skycare', eveningRequest);
  assert.equal(eveningAvailability.date, service.normalizeVoiceDate('tenant-skycare', 'tomorrow'));
  assert.equal(eveningAvailability.time, '17:00');
  assert.deepEqual(eveningAvailability.available_doctors, ['Dr. Rao', 'Dr. Mehta']);

  const available = await service.voiceTool('tenant-skycare', {
    action: 'availability', date: 'kal', time: '11 baje', doctor_name: '',
  });
  assert.equal(available.date, service.normalizeVoiceDate('tenant-skycare', 'kal'));
  assert.equal(available.time, '11:00');
  assert.equal(available.available, true);
  assert.equal(available.doctor_name, 'Dr. Rao');
  assert.deepEqual(available.available_doctors, ['Dr. Rao', 'Dr. Mehta']);
  const unknownDoctor = await service.voiceTool('tenant-skycare', {
    action: 'availability', date: 'kal', time: '11 baje', doctor_name: 'Dr. Invented',
  });
  assert.equal(unknownDoctor.available, false);
  assert.match(unknownDoctor.message, /not in the clinic doctor list/);

  const noDoctorConfigured = {
    id: 'tenant-empty', name: 'No Doctors', admin_phone: '+919876543210', patients: [], bookings: [],
    voice_agent: { enabled: true, availability: 'all_day', open_time: '00:00', close_time: '23:59', timezone: 'Asia/Kolkata', clinic_context: { doctors: [] } },
  };
  service.tenants[noDoctorConfigured.id] = noDoctorConfigured;
  const noDoctor = await service.voiceTool('tenant-empty', {
    action: 'availability', date: 'kal', time: '11 baje', doctor_name: '',
  });
  assert.equal(noDoctor.available, false);
  assert.match(noDoctor.message, /No doctors are configured/);
  assert.equal(noDoctor.doctor_name, undefined);
});

test('availability rejects missing or wrongly typed required tool arguments', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  service.tenants = {
    'tenant-skycare': {
      id: 'tenant-skycare', name: 'SkyCare', admin_phone: '+919876543210', patients: [], bookings: [],
      voice_agent: { enabled: true, availability: 'all_day', open_time: '00:00', close_time: '23:59', timezone: 'Asia/Kolkata', clinic_context: { doctors: ['Dr. Rao'] } },
    },
  };
  assert.match((await service.voiceTool('tenant-skycare', { action: 'availability', time: '11:00' })).error, /date is required as a string/);
  assert.match((await service.voiceTool('tenant-skycare', { action: 'availability', date: 'tomorrow' })).error, /time is required as a string/);
  assert.match((await service.voiceTool('tenant-skycare', { action: 'availability', date: 'tomorrow', time: '11:00' })).error, /doctor_name is required as a string/);
  assert.match((await service.voiceTool('tenant-skycare', { action: 'availability', date: 'tomorrow', time: '11:00', doctor_name: 42 })).error, /doctor_name must be a string/);
});

test('clinic context is bounded, persisted, and exposed through safe FAQ lookup', async () => {
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
  assert.deepEqual((await service.voiceTool(tenant.id, { action: 'clinic_info' })).services, ['Dental care']);
  assert.equal((await service.voiceTool(tenant.id, { action: 'faq', question: 'Do you provide dental care?' })).answer, 'Yes, dental consultations are available.');
  assert.equal((await service.voiceTool(tenant.id, { action: 'faq', question: 'Do you have parking?' })).handoff, true);
  assert.equal(service.previewVoiceAgent(tenant.id, 'Do you provide dental care?').reply, 'Yes, dental consultations are available.');
  assert.equal(service.updateVoiceAgent(tenant.id, { clinic_context: { address: 'x'.repeat(600) } }).clinic_context.address.length, 500);
});

test('voice booking does not report success when appointment persistence fails', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  process.env.VOICE_TOOL_SECRET = 'test-master-secret-that-is-at-least-32-characters';
  service.tenants = {
    'tenant-skycare': {
      id: 'tenant-skycare', name: 'SkyCare', admin_phone: '+919876543210', patients: [], bookings: [],
      voice_agent: { enabled: true, availability: 'all_day', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', clinic_context: { doctors: ['Dr. Test'] } },
    },
  };
  service.pendingPostgresWrite = Promise.resolve();
  service.persistState = () => { service.pendingPostgresWrite = Promise.reject(new Error('database unavailable')); };
  const booking = {
    action: 'book', request_id: 'db-failure-001', confirmed: true, patient_name: 'Test Patient',
    phone_number: '+919876543210', doctor_name: 'Dr. Test', date: '2030-04-10', time: '11:00', reason: 'Consultation',
  };
  const result = await service.voiceTool('tenant-skycare', booking);
  assert.equal(result.unavailable, true);
  assert.match(result.error, /booking was not confirmed/);
  assert.equal(result.appointment, undefined);
  assert.equal(service.tenants['tenant-skycare'].bookings.length, 0);
});

test('Postgres full-state writes coalesce queued snapshots while preserving the latest state', async () => {
  const { AppService } = require('../dist/app.service.js');
  const service = Object.create(AppService.prototype);
  const writtenPayloads = [];
  let releaseFirstWrite;
  service.pendingPostgresWrite = Promise.resolve();
  service.postgres = {
    query: async (_sql, params) => {
      writtenPayloads.push(params[0]);
      if (writtenPayloads.length === 1) await new Promise((resolve) => { releaseFirstWrite = resolve; });
      return { rows: [] };
    },
  };
  service.tenants = { 'tenant-skycare': { current_value: 0 } };
  service.planCatalog = [];
  service.clinicInterests = [];

  service.persistState();
  await new Promise((resolve) => setImmediate(resolve));
  service.tenants['tenant-skycare'].current_value = 1;
  service.persistState();
  service.tenants['tenant-skycare'].current_value = 2;
  service.persistState();
  releaseFirstWrite();
  await service.waitForPendingPersistence();

  assert.equal(writtenPayloads.length, 2);
  assert.equal(JSON.parse(writtenPayloads[0]).tenants['tenant-skycare'].current_value, 0);
  assert.equal(JSON.parse(writtenPayloads[1]).tenants['tenant-skycare'].current_value, 2);
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
