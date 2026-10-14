import { useEffect, useMemo, useState } from 'react';

const PUBLIC_APP_URL = 'https://carestack-uat-web.onrender.com';
const PUBLIC_API_URL = 'https://carestack-6psq.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname === new URL(PUBLIC_APP_URL).hostname
    ? PUBLIC_API_URL
    : 'http://localhost:3001'
);
const emptyPatient = { name: '', phone: '', email: '', age: '', notes: '', status: 'active' };
const emptyBooking = { patient_name: '', phone_number: '', doctor_name: 'Dr. Sarah Chen', appointment_date: '', appointment_time: '', reason: 'General consultation' };
const emptyTenant = { tenant_name: '', tenant_domain: '', admin_name: '', admin_email: '', admin_phone: '', plan: 'growth', billing_cycle: 'monthly', subscription_status: 'active', region: 'India' };
const emptyPlan = { id: '', name: '', monthly_price: '', annual_price: '', clinic_limit: '', user_limit: '' };
const defaultVoiceAgent = { enabled: true, availability: 'business_hours', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: { address: '', services: [], doctors: [], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] } };
const emptyTelephony = { phone_number: '', account_sid: '', app_id: '', region: 'mumbai', enabled: false, exotel_api_key: '', exotel_api_token: '', sarvam_org_id: '', sarvam_workspace_id: '', sarvam_agent_id: '', sarvam_agent_version: '', sarvam_connection_id: '' };
const telephonyConfigFields = ['phone_number', 'account_sid', 'app_id', 'region', 'enabled', 'exotel_voicebot_id', 'sarvam_org_id', 'sarvam_workspace_id', 'sarvam_agent_id', 'sarvam_agent_version', 'sarvam_connection_id'];
const emptyProviderTelephony = Object.fromEntries(telephonyConfigFields.map((key) => [key, key === 'region' ? 'mumbai' : key === 'enabled' ? false : '']));
const providerTelephonyDefaults = { sarvam: { ...emptyProviderTelephony }, exotel_voicebot: { ...emptyProviderTelephony } };
const emptyClinicInterest = { clinic_name: '', contact_name: '', email: '', phone: '', plan: 'growth' };

const request = async (path, options = {}) => {
  let accessToken = '';
  try {
    accessToken = JSON.parse(localStorage.getItem('carestack-session') || '{}').access_token || '';
  } catch {
    localStorage.removeItem('carestack-session');
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && accessToken) {
    localStorage.removeItem('carestack-session');
    window.dispatchEvent(new Event('carestack-auth-expired'));
    throw new Error('Your CareStack session expired. Sign in again to continue.');
  }
  if (!response.ok || data.statusCode >= 400) {
    throw new Error(data.message || data.detail || 'The request could not be completed.');
  }
  return data;
};

const getTenantPortalUrl = (domain) => {
  if (typeof window === 'undefined') return `${PUBLIC_APP_URL}/?tenant=${encodeURIComponent(domain)}`;
  const url = new URL(window.location.href);
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  if (localHost) url.hostname = `${domain}.localhost`;
  else url.searchParams.set('tenant', domain);
  return url.toString();
};

const getTenantBrand = () => {
  if (typeof window === 'undefined') {
    return {
      name: 'SkyCare Multi-Speciality',
      shortName: 'SkyCare',
      domain: 'skycare',
      hostname: 'localhost',
      accent: '#2a6df3',
      tagline: 'Multi-clinic operations platform',
    };
  }

  const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const parts = host.split('.');
  const requestedTenant = new URLSearchParams(window.location.search).get('tenant')?.trim().toLowerCase();
  const localTenant = host.endsWith('.localhost') ? parts[0] : '';
  const isAppRoot = host === 'localhost' || host === '127.0.0.1' || host === PUBLIC_APP_URL.replace(/^https?:\/\//, '');
  const subdomain = requestedTenant || localTenant || (isAppRoot ? 'skycare' : parts[0]) || 'skycare';

  const aliasMap = {
    skycare: {
      name: 'SkyCare Multi-Speciality',
      shortName: 'SkyCare',
      domain: 'skycare',
      hostname: 'skycare.localhost',
      accent: '#2a6df3',
      tagline: 'Multi-clinic operations platform',
    },
    alps: {
      name: 'Alps Care Network',
      shortName: 'Alps Care',
      domain: 'alps',
      hostname: 'alps.localhost',
      accent: '#0f766e',
      tagline: 'Regional family health network',
    },
    citycare: {
      name: 'CityCare Clinics',
      shortName: 'CityCare',
      domain: 'citycare',
      hostname: 'citycare.localhost',
      accent: '#8b5cf6',
      tagline: 'Smart urban care delivery',
    },
  };

  const mapped = aliasMap[subdomain] || {
    name: `${subdomain.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())} Clinic`,
    shortName: subdomain.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    domain: subdomain,
    hostname: host,
    accent: '#2a6df3',
    tagline: 'Connected care operations',
  };

  return mapped;
};

function App() {
  const [tenantBrand, setTenantBrand] = useState(getTenantBrand);
  const [page, setPage] = useState('landing');
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState('tenant');
  const [activeView, setActiveView] = useState('overview');
  const [session, setSession] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: `admin@${tenantBrand.domain}.in`, password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [appointmentQuery, setAppointmentQuery] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [voiceAgent, setVoiceAgent] = useState(defaultVoiceAgent);
  const [clinicCallingNumber, setClinicCallingNumber] = useState('');
  const [telephonyTenantId, setTelephonyTenantId] = useState(null);
  const [telephonyForm, setTelephonyForm] = useState(emptyTelephony);
  const [voiceToolSecret, setVoiceToolSecret] = useState('');
  const [voiceToolApiBaseUrl, setVoiceToolApiBaseUrl] = useState(() => {
    try { return localStorage.getItem('carestack-voice-tool-api-base-url') || API_URL; } catch { return API_URL; }
  });
  const [exotelConnectionStatus, setExotelConnectionStatus] = useState('');
  const [agentPreviewInput, setAgentPreviewInput] = useState('I want to book an appointment');
  const [agentPreviewReply, setAgentPreviewReply] = useState('');
  const [agentPreviewListening, setAgentPreviewListening] = useState(false);
  const [publicPlans, setPublicPlans] = useState([]);
  const [clinicInterests, setClinicInterests] = useState([]);
  const [clinicInterestForm, setClinicInterestForm] = useState(emptyClinicInterest);
  const [clinicInterestMessage, setClinicInterestMessage] = useState('');
  const [clinicInterestError, setClinicInterestError] = useState('');

  useEffect(() => {
    const handleExpiredSession = () => {
      sessionStorage.setItem('carestack-auth-expired', '1');
      window.location.reload();
    };
    window.addEventListener('carestack-auth-expired', handleExpiredSession);
    return () => window.removeEventListener('carestack-auth-expired', handleExpiredSession);
  }, []);

  useEffect(() => {
    request('/api/public/plans').then((data) => setPublicPlans(data.plans || [])).catch(() => {});
  }, []);

  const openLogin = (role = 'tenant') => {
    setLoginRole(role);
    setLoginForm({
      email: role === 'super_admin' ? 'superadmin@hospital.ai' : `admin@${tenantBrand.domain}.in`,
      password: '',
    });
    setError('');
    setLoginOpen(true);
  };

  useEffect(() => {
    if (sessionStorage.getItem('carestack-auth-expired') === '1') {
      sessionStorage.removeItem('carestack-auth-expired');
      setPage('login');
      setLoginOpen(true);
      setError('Your CareStack session expired. Sign in again to continue.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(localStorage.getItem('carestack-session') || 'null');
    } catch {
      localStorage.removeItem('carestack-session');
    }
    if (!parsed) return;
    if (parsed.token === 'demo-token' || !parsed.access_token) {
      localStorage.removeItem('carestack-session');
      return;
    }
    if (parsed.role === 'super_admin') {
      setSession(parsed);
      setPage('dashboard');
      setActiveView('overview');
      loadAdminData().catch((loadError) => setError(loadError.message));
    } else if (parsed.tenant_id) {
      request(`/api/tenant/resolve/${encodeURIComponent(tenantBrand.domain)}`).then((hostTenant) => {
        if (hostTenant.id !== parsed.tenant_id || hostTenant.subscription_status !== 'active') {
          localStorage.removeItem('carestack-session');
          setPage('login');
          setError(`This session is not active for the ${tenantBrand.domain} clinic workspace. Sign in with this clinic's account.`);
          return;
        }
        setSession(parsed);
        setPage('dashboard');
        loadDashboard(parsed.tenant_id);
      }).catch((loadError) => setError(loadError.message));
    }
  }, [tenantBrand.domain]);

  useEffect(() => {
    request(`/api/tenant/resolve/${encodeURIComponent(tenantBrand.domain)}`).then((tenant) => {
      if (tenant) {
        setTenantBrand((current) => ({ ...current, name: tenant.name, shortName: tenant.name.split(' ')[0] }));
      }
    }).catch(() => {});
  }, [tenantBrand.domain]);

  useEffect(() => {
    if (tenantBrand?.domain) {
      setLoginForm((current) => ({
        ...current,
        email: `admin@${tenantBrand.domain}.in`,
      }));
    }
  }, [tenantBrand]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password,
        }),
      });

      const data = await response.json();
      const user = data?.user || null;

      if (!response.ok || data.statusCode === 401 || !user) {
        throw new Error(data.message || 'Login failed');
      }

      if (user.role !== 'super_admin') {
        const hostTenant = await request(`/api/tenant/resolve/${encodeURIComponent(tenantBrand.domain)}`);
        if (!hostTenant || hostTenant.id !== user.tenant_id) {
          throw new Error(`This account does not belong to the ${tenantBrand.domain} clinic workspace.`);
        }
      }

      if (!data.access_token) throw new Error('The server did not issue an access token.');
      const nextSession = { ...user, access_token: data.access_token };
      localStorage.setItem('carestack-session', JSON.stringify(nextSession));
      setSession(nextSession);
      setLoginOpen(false);
      setPage('dashboard');
      setActiveView('overview');
      if (nextSession.role === 'super_admin') {
        await loadAdminData();
      } else {
        await loadDashboard(nextSession.tenant_id);
      }
    } catch (err) {
      setError(err.message || 'Unable to login');
    } finally {
      setBusy(false);
    }
  };

  const loadDashboard = async (tenantId) => {
    if (!tenantId) return;
    try {
      const dashboard = await request(`/api/tenant/${tenantId}/dashboard`);
      setTenantData(dashboard);
      setPatients(dashboard.patients || []);
      setBookings(dashboard.bookings || []);
      setVoiceAgent({ ...defaultVoiceAgent, ...(dashboard.voice_agent || {}), clinic_context: { ...defaultVoiceAgent.clinic_context, ...(dashboard.voice_agent?.clinic_context || {}) } });
      setClinicCallingNumber(dashboard.telephony?.phone_number || '');
    } catch (err) {
      setError(err.message || 'Dashboard could not be loaded.');
    }
  };

  const saveVoiceAgent = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/voice-agent`, {
        method: 'PUT', body: JSON.stringify(voiceAgent),
      });
      setVoiceAgent(result.voice_agent);
      setNotice('AI agent context, FAQs, and calling hours saved.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  const getVoiceAgentPreview = async (message, speakReply = false) => {
    if (!session?.tenant_id) return;
    setBusy(true); setError('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/voice-agent/preview`, {
        method: 'POST', body: JSON.stringify({ caller_message: message }),
      });
      setAgentPreviewReply(result.reply);
      if (window.speechSynthesis && speakReply) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply));
      }
    } catch (previewError) { setError(previewError.message); }
    finally { setBusy(false); }
  };

  const previewVoiceAgent = async (event) => {
    event.preventDefault();
    setAgentPreviewListening(false);
    await getVoiceAgentPreview(agentPreviewInput);
  };

  const startSpokenAgentPreview = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Speech recognition is unavailable in this browser. Use the text preview instead.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceAgent.timezone === 'Asia/Kolkata' ? 'en-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setAgentPreviewListening(true);
    recognition.onerror = () => { setAgentPreviewListening(false); setError('Microphone preview could not start. Check browser microphone permission or use text preview.'); };
    recognition.onend = () => setAgentPreviewListening(false);
    recognition.onresult = (event) => {
      const message = event.results?.[0]?.[0]?.transcript || '';
      if (message) { setAgentPreviewInput(message); setAgentPreviewListening(true); getVoiceAgentPreview(message, true); }
    };
    recognition.start();
  };

  const shareClinicNumber = async () => {
    const message = `Call ${displayedTenant} to book an appointment: ${clinicCallingNumber}`;
    try {
      await navigator.clipboard.writeText(message);
      setNotice('Clinic calling number copied with a customer-ready message.');
    } catch {
      setError('Clipboard access is unavailable. You can select and copy the number.');
    }
  };

  const configureClinicTelephony = (tenant) => {
    setVoiceToolSecret('');
    setExotelConnectionStatus('');
    setTelephonyTenantId(tenant.id);
    const saved = tenant.telephony || {};
    const provider_configs = { ...providerTelephonyDefaults, ...(saved.provider_configs || {}) };
    const selectedProvider = saved.voice_provider || 'sarvam';
    if (!saved.provider_configs?.[selectedProvider]) provider_configs[selectedProvider] = { ...provider_configs[selectedProvider], ...saved };
    setTelephonyForm({ ...emptyTelephony, ...saved, ...provider_configs[selectedProvider], provider_configs, voice_provider: selectedProvider, exotel_api_key: '', exotel_api_token: '' });
    document.getElementById('clinic-telephony-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveClinicTelephony = async (event) => {
    event.preventDefault();
    if (!telephonyTenantId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await request(`/api/tenants/${telephonyTenantId}/telephony`, { method: 'PUT', body: JSON.stringify({ ...telephonyForm, provider_config: Object.fromEntries(telephonyConfigFields.map((key) => [key, telephonyForm[key]])) }) });
      setVoiceToolSecret(saved.voice_tool_secret || '');
      const savedConfig = saved.telephony || {};
      const provider_configs = { ...providerTelephonyDefaults, ...(savedConfig.provider_configs || {}) };
      setTelephonyForm({ ...emptyTelephony, ...savedConfig, ...provider_configs[savedConfig.voice_provider || telephonyForm.voice_provider], provider_configs, voice_provider: savedConfig.voice_provider || telephonyForm.voice_provider, exotel_api_key: '', exotel_api_token: '' });
      setNotice(saved.voice_tool_secret ? 'Calling configuration saved. Copy the clinic tool secret below into the Exotel Voicebot tools.' : 'Calling settings were saved, but voice booking tools are disabled. Set VOICE_TOOL_SECRET (at least 32 characters) on the API server before configuring Exotel tools.');
      await loadAdminData();
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  };

  const updateTelephonyField = (field, value) => setTelephonyForm((current) => {
    const provider = current.voice_provider || 'sarvam';
    return { ...current, [field]: value, provider_configs: { ...providerTelephonyDefaults, ...(current.provider_configs || {}), [provider]: { ...(current.provider_configs?.[provider] || {}), [field]: value } } };
  });

  const selectTelephonyProvider = (provider) => setTelephonyForm((current) => ({
    ...current, ...providerTelephonyDefaults[provider], ...(current.provider_configs?.[provider] || {}),
    voice_provider: provider, provider_configs: { ...providerTelephonyDefaults, ...(current.provider_configs || {}) }, exotel_api_key: '', exotel_api_token: '',
  }));

  const activateClinicVoice = async (tenantId) => {
    if (!window.confirm('This creates an active inbound Sarvam deployment for the clinic number. Calls may incur Sarvam and Exotel charges. Continue?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`/api/tenants/${tenantId}/voice-deployment`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(`Inbound voice deployment ${result.deployment_id} is active.`);
      await loadAdminData();
    } catch (activationError) { setError(activationError.message); }
    finally { setBusy(false); }
  };

  const verifyExotelForClinic = async (tenantId) => {
    setBusy(true); setError(''); setNotice(''); setExotelConnectionStatus('');
    try {
      const result = await request(`/api/tenants/${tenantId}/exotel/verify`, { method: 'POST', body: JSON.stringify({}) });
      setExotelConnectionStatus('Connected');
      setNotice(result.message);
    } catch (verifyError) { setError(verifyError.message); setExotelConnectionStatus('Not connected'); }
    finally { setBusy(false); }
  };

  const loadTenants = async () => {
    const data = await request('/api/tenants');
    setTenants(data.tenants || []);
  };

  const loadAdminData = async () => {
    const [tenantDataResponse, planDataResponse, dashboardResponse, clinicInterestsResponse] = await Promise.all([
      request('/api/tenants'),
      request('/api/plans'),
      request('/api/super-admin/dashboard'),
      request('/api/super-admin/clinic-interests'),
    ]);
    setTenants(tenantDataResponse.tenants || []);
    setPlans(planDataResponse.plans || []);
    setAdminDashboard(dashboardResponse);
    setClinicInterests(clinicInterestsResponse.clinic_interests || []);
  };

  const submitClinicInterest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setClinicInterestError('');
    setClinicInterestMessage('');
    try {
      const response = await request('/api/public/clinic-interest', { method: 'POST', body: JSON.stringify(clinicInterestForm) });
      setClinicInterestMessage(response.message);
      setClinicInterestForm(emptyClinicInterest);
    } catch (submitError) {
      setClinicInterestError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTenantSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const data = await request(editingTenantId ? `/api/tenants/${editingTenantId}` : '/api/tenants/onboard', {
        method: editingTenantId ? 'PUT' : 'POST',
        body: JSON.stringify(tenantForm),
      });
      setNotice(editingTenantId
        ? `${data.tenant.name} was updated.`
        : `${data.tenant.tenant_name} is ready at ${getTenantPortalUrl(data.tenant.domain)}. Admin: ${data.tenant.admin_email}. One-time password: ${data.tenant.temporary_password}.`);
      setTenantForm(emptyTenant);
      setEditingTenantId(null);
      await loadAdminData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const editTenant = (tenant) => {
    setEditingTenantId(tenant.id);
    setTenantForm({
      tenant_name: tenant.name,
      tenant_domain: tenant.domain,
      admin_name: tenant.admin_name,
      admin_email: tenant.admin_email,
      admin_phone: tenant.admin_phone || '',
      plan: tenant.plan,
      billing_cycle: tenant.billing_cycle || 'monthly',
      subscription_status: tenant.subscription_status || 'active',
      region: tenant.region,
    });
    setNotice('');
    setError('');
    document.getElementById('tenant-management-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateSubscription = async (tenantId, changes) => {
    setError('');
    try {
      const data = await request(`/api/tenants/${tenantId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      setNotice(`${data.tenant.name} subscription updated.`);
      await loadAdminData();
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  const removeTenant = async (tenant) => {
    if (!window.confirm(`Delete ${tenant.name} and its tenant workspace? This cannot be undone.`)) return;
    setError('');
    try {
      await request(`/api/tenants/${tenant.id}`, { method: 'DELETE' });
      setNotice(`${tenant.name} was deleted.`);
      if (editingTenantId === tenant.id) {
        setEditingTenantId(null);
        setTenantForm(emptyTenant);
      }
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handlePlanSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const payload = {
        ...planForm,
        monthly_price: Number(planForm.monthly_price),
        annual_price: Number(planForm.annual_price),
        clinic_limit: planForm.clinic_limit === '' ? null : Number(planForm.clinic_limit),
        user_limit: planForm.user_limit === '' ? null : Number(planForm.user_limit),
      };
      const data = await request(editingPlanId ? `/api/plans/${editingPlanId}` : '/api/plans', {
        method: editingPlanId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setNotice(`${data.plan.name} plan ${editingPlanId ? 'updated' : 'created'}.`);
      setPlanForm(emptyPlan);
      setEditingPlanId(null);
      await loadAdminData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const editPlan = (plan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      id: plan.id,
      name: plan.name,
      monthly_price: String(plan.monthly_price),
      annual_price: String(plan.annual_price),
      clinic_limit: plan.clinic_limit == null ? '' : String(plan.clinic_limit),
      user_limit: plan.user_limit == null ? '' : String(plan.user_limit),
    });
    setNotice('');
    setError('');
    document.getElementById('plan-management-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const removePlan = async (plan) => {
    if (!window.confirm(`Delete the ${plan.name} plan? Plans assigned to tenants cannot be deleted.`)) return;
    setError('');
    try {
      await request(`/api/plans/${plan.id}`, { method: 'DELETE' });
      setNotice(`${plan.name} plan deleted.`);
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handlePatientSubmit = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true);
    setError('');
    try {
      const method = editingPatientId ? 'PUT' : 'POST';
      const patientPath = `/api/tenant/${session.tenant_id}/patients${editingPatientId ? `/${editingPatientId}` : ''}`;
      await request(patientPath, {
        method,
        body: JSON.stringify({ ...patientForm, age: patientForm.age ? Number(patientForm.age) : null }),
      });
      setNotice(editingPatientId ? 'Patient record updated.' : 'Patient added.');
      setPatientForm(emptyPatient);
      setEditingPatientId(null);
      await loadDashboard(session.tenant_id);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const editPatient = (patient) => {
    setPatientForm({ ...emptyPatient, ...patient, age: patient.age || '' });
    setEditingPatientId(patient.id);
    setNotice('');
  };

  const deletePatient = async (patientId) => {
    if (!session?.tenant_id || !window.confirm('Delete this patient record?')) return;
    setError('');
    try {
      await request(`/api/tenant/${session.tenant_id}/patients/${patientId}`, { method: 'DELETE' });
      setNotice('Patient record deleted.');
      await loadDashboard(session.tenant_id);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await request('/api/agent/booking', {
        method: 'POST',
        body: JSON.stringify({ ...bookingForm, tenant_id: session.tenant_id }),
      });
      setNotice(`Appointment ${result.appointment.id} confirmed by Python booking agents.`);
      setBookingForm(emptyBooking);
      await loadDashboard(session.tenant_id);
    } catch (bookingError) {
      setError(bookingError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    if (!session?.tenant_id) return;
    if (status === 'cancelled' && !window.confirm('Cancel this appointment?')) {
      await loadDashboard(session.tenant_id);
      return;
    }
    setError('');
    try {
      await request(`/api/tenant/${session.tenant_id}/appointments/${appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Appointment ${appointmentId} marked ${status.replace('_', ' ')}.`);
      await loadDashboard(session.tenant_id);
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  const exportTenantCsv = (kind) => {
    const rows = kind === 'patients'
      ? [['Patient ID', 'Name', 'Phone', 'Email', 'Age', 'Status'], ...patients.map((patient) => [patient.id, patient.name, patient.phone, patient.email || '', patient.age || '', patient.status])]
      : [['Appointment ID', 'Patient', 'Phone', 'Doctor', 'Date', 'Time', 'Reason', 'Status'], ...bookings.map((booking) => [booking.id, booking.patient_name, booking.phone_number, booking.doctor_name, booking.appointment_date, booking.appointment_time, booking.reason || '', booking.status])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tenantBrand.domain}-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const logout = () => {
    localStorage.removeItem('carestack-session');
    setSession(null);
    setTenantData(null);
    setPage('landing');
    setNotice('');
    setError('');
  };

  const summary = useMemo(() => tenantData?.summary || {
    patients: 0,
    appointments: 0,
    active_patients: 0,
    upcoming_appointments: 0,
    completed_appointments: 0,
    cancellation_rate: 0,
  }, [tenantData]);
  const analytics = {
    summary: {},
    activity: [],
    schedule: [],
    status_breakdown: [],
    doctor_workload: [],
    ...tenantData?.analytics,
  };
  const superAdmin = session?.role === 'super_admin';
  const displayedTenant = tenantData?.tenant_name || tenantBrand.name;
  const adminSummary = adminDashboard?.summary || { tenants: 0, active: 0, paused: 0, monthly_recurring_revenue: 0 };
  const planBreakdown = adminDashboard?.plan_breakdown || [];
  const marketedPlans = publicPlans.length ? publicPlans : [
    { id: 'starter', name: 'Starter', monthly_price: 4999, annual_price: 49990, clinic_limit: 1, user_limit: 3 },
    { id: 'growth', name: 'Growth', monthly_price: 14999, annual_price: 149990, clinic_limit: 5, user_limit: 15 },
    { id: 'enterprise', name: 'Enterprise', monthly_price: 39999, annual_price: 399990, clinic_limit: null, user_limit: null },
  ];
  const maxPlanCount = Math.max(1, ...planBreakdown.map((item) => item.count));
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount || 0);
  const maxScheduleCount = Math.max(1, ...analytics.schedule.map((day) => day.count));
  const maxActivityCount = Math.max(1, ...analytics.activity.map((day) => Math.max(day.patients, day.bookings)));
  const maxStatusCount = Math.max(1, ...analytics.status_breakdown.map((item) => item.count));
  const maxDoctorCount = Math.max(1, ...analytics.doctor_workload.map((item) => item.count));
  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = appointmentStatusFilter === 'all' || booking.status === appointmentStatusFilter;
    const query = appointmentQuery.trim().toLowerCase();
    const matchesQuery = !query || [booking.id, booking.patient_name, booking.phone_number, booking.doctor_name]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });
  const upcomingBookings = bookings.filter((booking) => {
    const today = new Date().toISOString().slice(0, 10);
    return booking.appointment_date >= today && !['cancelled', 'no_show'].includes(booking.status);
  }).sort((left, right) => `${left.appointment_date} ${left.appointment_time}`.localeCompare(`${right.appointment_date} ${right.appointment_time}`)).slice(0, 5);
  const activityComparison = (current = 0, previous = 0) => previous === 0
    ? `${current} this week · no prior baseline`
    : `${current - previous > 0 ? '+' : ''}${current - previous} vs prior 7 days`;

  const renderTenantOverview = () => (
    <>
      <div className="row g-3 mb-4">
        {[
          ['Active patients', summary.active_patients ?? summary.patients, `${summary.patients} records in your clinic`],
          ['New patients', analytics.summary.patient_activity?.current ?? 0, activityComparison(analytics.summary.patient_activity?.current, analytics.summary.patient_activity?.previous)],
          ['Bookings created', analytics.summary.booking_activity?.current ?? 0, activityComparison(analytics.summary.booking_activity?.current, analytics.summary.booking_activity?.previous)],
          ['Next 7 days', summary.upcoming_appointments ?? 0, 'Visits scheduled in the coming week'],
        ].map(([label, value, hint], index) => <div className="col-6 col-xl-3" key={label}><div className={`tenant-kpi tenant-kpi-${index}`}><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></div>)}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-12"><section className="tenant-insight-panel">
          <div className="admin-panel-heading tenant-growth-heading"><div><h3>Clinic growth activity</h3><p>Patient records and appointment bookings created each day · last 7 days</p></div><div className="growth-legend"><span><i className="growth-swatch patient-swatch" />New patients</span><span><i className="growth-swatch booking-swatch" />Bookings</span></div></div>
          <div className="growth-chart" role="img" aria-label="Daily patient registrations compared with appointment bookings over the last seven days">
            {analytics.activity.map((day) => <div className="growth-day" key={day.date} title={`${day.date}: ${day.patients} new patients, ${day.bookings} bookings`}>
              <strong>{day.patients + day.bookings}</strong><div className="growth-track"><span className="growth-bar patient-growth" style={{ height: `${day.patients ? Math.max(7, (day.patients / maxActivityCount) * 100) : 0}%` }} /><span className="growth-bar booking-growth" style={{ height: `${day.bookings ? Math.max(7, (day.bookings / maxActivityCount) * 100) : 0}%` }} /></div><small>{day.label}</small>
            </div>)}
          </div>
          <div className="growth-comparison"><span>Patient registrations <strong>{analytics.summary.patient_activity?.current ?? 0}</strong> this 7 days <span className="comparison-divider">vs</span> <strong>{analytics.summary.patient_activity?.previous ?? 0}</strong> prior 7 days</span><span>Bookings created <strong>{analytics.summary.booking_activity?.current ?? 0}</strong> this 7 days <span className="comparison-divider">vs</span> <strong>{analytics.summary.booking_activity?.previous ?? 0}</strong> prior 7 days</span></div>
        </section></div>
      </div>
      <div className="row g-4 mb-4">
        <div className="col-xl-7"><section className="tenant-insight-panel h-100">
          <div className="admin-panel-heading"><div><h3>Upcoming demand</h3><p>Appointments by scheduled date · next 7 days</p></div><button className="btn btn-sm btn-outline-primary" onClick={() => setActiveView('appointments')}>Open schedule</button></div>
          <div className="schedule-bars" role="img" aria-label="Upcoming appointments scheduled over the next seven days">
            {analytics.schedule.map((day) => <div className="schedule-day" key={day.date} title={`${day.count} appointments on ${day.date}`}>
              <strong>{day.count}</strong><div className="schedule-track"><span style={{ height: `${day.count ? Math.max(8, (day.count / maxScheduleCount) * 100) : 0}%` }} /></div><small>{day.label}</small>
            </div>)}
          </div>
          <div className="chart-footnote">Counts reflect saved appointment dates; no forecast or unsaved call volume is included.</div>
        </section></div>
        <div className="col-xl-5"><section className="tenant-insight-panel h-100">
          <div className="admin-panel-heading"><div><h3>Appointment outcomes</h3><p>Current status mix across all bookings</p></div></div>
          <div className="outcome-bars" role="img" aria-label="Appointment counts by status">
            {analytics.status_breakdown.map((item) => <div className="admin-bar-row" key={item.status}><span className="admin-bar-label text-capitalize">{item.status.replace('_', ' ')}</span><div className="admin-bar-track"><span className={`outcome-fill outcome-${item.status}`} style={{ width: `${(item.count / maxStatusCount) * 100}%` }} /></div><strong>{item.count}</strong></div>)}
          </div>
          <button className="btn btn-link px-0 mt-2" onClick={() => setActiveView('appointments')}>Review and update appointments</button>
        </section></div>
      </div>
      <div className="row g-4 mb-4">
        <div className="col-xl-5"><section className="tenant-insight-panel h-100">
          <div className="admin-panel-heading"><div><h3>Doctor workload</h3><p>Upcoming confirmed visits by doctor</p></div></div>
          {analytics.doctor_workload.length ? <div className="doctor-workload">{analytics.doctor_workload.slice(0, 5).map((item) => <div className="doctor-row" key={item.doctor}><span>{item.doctor}</span><div className="admin-bar-track"><span className="doctor-fill" style={{ width: `${(item.count / maxDoctorCount) * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div> : <div className="empty-insight">No upcoming appointments to allocate yet.</div>}
        </section></div>
        <div className="col-xl-7"><section className="tenant-insight-panel h-100">
          <div className="admin-panel-heading"><div><h3>Next on the schedule</h3><p>Nearest confirmed visits requiring clinic readiness</p></div><button className="btn btn-sm btn-primary" onClick={() => setActiveView('appointments')}>+ Book visit</button></div>
          {upcomingBookings.length ? <div className="agenda-list">{upcomingBookings.map((booking) => <div className="agenda-row" key={booking.id}><div className="agenda-date"><strong>{new Date(`${booking.appointment_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit' })}</strong><small>{new Date(`${booking.appointment_date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small></div><div className="agenda-details"><strong>{booking.patient_name}</strong><span>{booking.doctor_name} · {booking.appointment_time}</span></div><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div>)}</div> : <div className="empty-insight">No upcoming visits. Use Book visit to fill the schedule.</div>}
        </section></div>
      </div>
    </>
  );

  const renderAdminOverview = () => (
    <>
      <div className="row g-3 mb-4">
        {[
          ['Tenant accounts', adminSummary.tenants, 'Across all clinic workspaces'],
          ['Active subscriptions', adminSummary.active, 'Currently billable tenants'],
          ['Paused subscriptions', adminSummary.paused, 'Temporarily not billable'],
          ['Monthly recurring revenue', formatCurrency(adminSummary.monthly_recurring_revenue), 'Annual plans normalized monthly'],
        ].map(([label, value, hint]) => <div className="col-6 col-xl-3" key={label}><div className="admin-metric"><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></div>)}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-7"><section className="admin-panel h-100">
          <div className="admin-panel-heading"><div><h3>Plan distribution</h3><p>Tenant allocation by subscribed plan</p></div><button className="btn btn-sm btn-outline-primary" onClick={() => setActiveView('subscriptions')}>Manage plans</button></div>
          <div className="admin-bars" role="img" aria-label="Tenant count by subscription plan">
            {planBreakdown.map((item, index) => <div className="admin-bar-row" key={item.id}>
              <span className="admin-bar-label">{item.name}</span>
              <div className="admin-bar-track"><span className={`admin-bar-fill tone-${index}`} style={{ width: `${Math.max(0, (item.count / maxPlanCount) * 100)}%` }} /></div>
              <strong>{item.count}</strong>
            </div>)}
          </div>
        </section></div>
        <div className="col-lg-5"><section className="admin-panel h-100">
          <div className="admin-panel-heading"><div><h3>Subscription health</h3><p>Active versus paused accounts</p></div></div>
          <div className="health-summary"><div><span className="status-dot active-dot" />Active<strong>{adminSummary.active}</strong></div><div><span className="status-dot paused-dot" />Paused<strong>{adminSummary.paused}</strong></div></div>
          <div className="health-track" role="img" aria-label={`${adminSummary.active} active and ${adminSummary.paused} paused subscriptions`}>
            <span className="health-active" style={{ width: `${adminSummary.tenants ? (adminSummary.active / adminSummary.tenants) * 100 : 0}%` }} />
            <span className="health-paused" style={{ width: `${adminSummary.tenants ? (adminSummary.paused / adminSummary.tenants) * 100 : 0}%` }} />
          </div>
          <button className="btn btn-link px-0 mt-3" onClick={() => setActiveView('tenants')}>Review tenant accounts</button>
        </section></div>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>Latest tenant accounts</h3><p>Recently provisioned workspaces</p></div><button className="btn btn-sm btn-primary" onClick={() => setActiveView('tenants')}>Manage tenants</button></div>
        <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Clinic</th><th>Portal</th><th>Plan</th><th>Subscription</th><th>Monthly value</th></tr></thead>
          <tbody>{[...tenants].slice(-5).reverse().map((tenant) => <tr key={tenant.id}><td className="fw-semibold">{tenant.name}</td><td><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></td><td className="text-capitalize">{tenant.plan}</td><td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td><td>{formatCurrency(tenant.monthly_price)}</td></tr>)}{tenants.length === 0 && <tr><td colSpan="5" className="text-muted py-4">No tenant accounts yet.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  );

  const renderSubscriptions = () => (
    <>
      <div className="admin-panel-heading subscription-title"><div><h3>Plans and subscriptions</h3><p>Review pricing, assign plans, and control billing state.</p></div></div>
      <div className="row g-3 mb-4">
        {plans.map((plan, index) => <div className="col-md-4" key={plan.id}><section className={`plan-panel plan-tone-${index}`}>
          <div className="d-flex justify-content-between align-items-start"><div><small>CARE PLAN</small><h3>{plan.name}</h3></div><span className="plan-count">{tenants.filter((tenant) => tenant.plan === plan.id).length} tenants</span></div>
          <p className="plan-price">{formatCurrency(plan.monthly_price)}<span> / month</span></p>
          <p className="plan-annual">{formatCurrency(plan.annual_price)} billed annually</p>
          <div className="plan-limits">{plan.clinic_limit || 'Unlimited'} clinics <span>·</span> {plan.user_limit || 'Unlimited'} users</div>
          <div className="d-flex gap-2 mt-3"><button className="btn btn-sm btn-outline-primary" onClick={() => editPlan(plan)}>Edit plan</button><button className="btn btn-sm btn-outline-danger" onClick={() => removePlan(plan)}>Delete plan</button></div>
        </section></div>)}
      </div>
      <section className="admin-panel mb-4" id="plan-management-form">
        <div className="admin-panel-heading"><div><h3>{editingPlanId ? 'Edit plan' : 'Create a plan'}</h3><p>Set plan rates and included workspace limits. Leave a limit blank for unlimited.</p></div></div>
        <form onSubmit={handlePlanSubmit}>
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label" htmlFor="plan-id">Plan ID</label><input id="plan-id" className="form-control" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={planForm.id} disabled={Boolean(editingPlanId)} onChange={(event) => setPlanForm({ ...planForm, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="plan-name">Plan name</label><input id="plan-name" className="form-control" required minLength="2" value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="plan-monthly">Monthly price (INR)</label><input id="plan-monthly" type="number" min="1" className="form-control" required value={planForm.monthly_price} onChange={(event) => setPlanForm({ ...planForm, monthly_price: event.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="plan-annual">Annual price (INR)</label><input id="plan-annual" type="number" min="1" className="form-control" required value={planForm.annual_price} onChange={(event) => setPlanForm({ ...planForm, annual_price: event.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="plan-clinics">Clinic limit</label><input id="plan-clinics" type="number" min="1" className="form-control" placeholder="Unlimited" value={planForm.clinic_limit} onChange={(event) => setPlanForm({ ...planForm, clinic_limit: event.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="plan-users">User limit</label><input id="plan-users" type="number" min="1" className="form-control" placeholder="Unlimited" value={planForm.user_limit} onChange={(event) => setPlanForm({ ...planForm, user_limit: event.target.value })} /></div>
          </div>
          <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingPlanId ? 'Save plan' : 'Create plan'}</button>{editingPlanId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingPlanId(null); setPlanForm(emptyPlan); }}>Cancel</button>}</div>
        </form>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>Subscription register</h3><p>Plan and billing changes apply immediately.</p></div></div>
        <div className="table-responsive"><table className="table align-middle mb-0">
          <thead><tr><th>Clinic</th><th>Plan</th><th>Billing</th><th>Monthly value</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{tenants.map((tenant) => <tr key={tenant.id}>
            <td><div className="fw-semibold">{tenant.name}</div><small><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></small></td>
            <td><select className="form-select form-select-sm plan-select" aria-label={`Plan for ${tenant.name}`} value={tenant.plan} onChange={(event) => updateSubscription(tenant.id, { plan: event.target.value })}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></td>
            <td><select className="form-select form-select-sm cycle-select" aria-label={`Billing cycle for ${tenant.name}`} value={tenant.billing_cycle} onChange={(event) => updateSubscription(tenant.id, { billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></td>
            <td>{formatCurrency(tenant.monthly_price)}<small className="d-block text-muted">per month equivalent</small></td>
            <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
            <td><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : 'Activate'}</button></td>
          </tr>)}{tenants.length === 0 && <tr><td colSpan="6" className="text-muted py-4">No subscriptions to manage.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  );

  const renderLanding = () => (
    <div className="site-shell">
      <nav className="site-nav">
        <a className="site-wordmark" href="#top" aria-label="CareStack home"><span className="wordmark-symbol">C</span><span>care<span>stack</span></span></a>
        <div className="site-nav-links"><a href="#platform">Platform</a><a href="#intelligence">AI workflow</a><a href="#plans">Plans</a><a href="#for-clinics">For clinics</a></div>
        <div className="site-nav-actions"><button className="nav-login" onClick={() => openLogin('tenant')}>Clinic sign in</button><button className="nav-admin" onClick={() => openLogin('super_admin')}>Platform admin <span aria-hidden="true">↗</span></button></div>
      </nav>

      <main id="top">
        <section className="brand-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> CLINIC OPERATIONS, IN SYNC</div>
            <h1>More time for care.<br /><em>Less time</em> between the call and the clinic.</h1>
            <p className="hero-description">CareStack brings patient intake, appointment coordination and clinic operations into one calm, connected workspace, with AI agents helping turn conversations into confirmed visits.</p>
            <div className="hero-actions"><button className="button-dark" onClick={() => openLogin('tenant')}>Enter your clinic <span aria-hidden="true">→</span></button><a className="button-text" href="#intelligence">See how it works <span aria-hidden="true">↓</span></a></div>
            <div className="hero-proof"><span className="proof-mark">INDIA · BUILT FOR CARE TEAMS</span><span>Tenant-specific clinic workspaces</span><span>Human-led, agent-assisted operations</span></div>
          </div>

          <div className="hero-visual" aria-label="Care team reviewing a digital patient workflow">
            <img className="hero-photo" src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1500&q=85" alt="Doctor discussing a patient care plan in a clinic" />
            <div className="photo-shade" />
            <div className="visual-caption"><span>CONNECTED CARE</span><strong>Every call has a next step.</strong></div>
            <div className="call-flow-panel">
              <div className="call-flow-head"><span className="call-pulse" /> VOICE INTAKE <small>AGENT WORKFLOW</small></div>
              <div className="flow-line"><span className="flow-index">01</span><div><strong>Intent recognized</strong><small>Appointment request · patient details captured</small></div><b>DONE</b></div>
              <div className="flow-line"><span className="flow-index">02</span><div><strong>Care pathway checked</strong><small>Reason for visit · doctor preference</small></div><b>DONE</b></div>
              <div className="flow-line flow-current"><span className="flow-index">03</span><div><strong>Visit coordinated</strong><small>Available slot · clinic confirmation</small></div><b>READY</b></div>
              <div className="flow-footer"><span>Python orchestration</span><span>Human team stays in control</span></div>
            </div>
          </div>
          <div className="hero-bottomline"><span>01 / A BETTER FRONT DOOR FOR CARE</span><span>SCROLL TO EXPLORE&nbsp; ↓</span></div>
        </section>

        <section className="intro-band" id="platform">
          <p className="section-kicker">THE CARESTACK APPROACH</p>
          <div className="intro-grid"><h2>One thoughtful system.<br /><span>From first hello to follow-up.</span></h2><p>Clinics shouldn’t have to stitch together phone notes, patient lists and appointment calendars. CareStack gives each organization a branded home for the work, while a shared platform keeps the operation clear.</p></div>
        </section>

        <section className="capability-section" id="intelligence">
          <div className="section-heading"><div><p className="section-kicker">INTELLIGENCE THAT MOVES WORK FORWARD</p><h2>Useful AI, inside a real workflow.</h2></div><p>Agents handle structured steps. Your team retains oversight of patient care and decisions.</p></div>
          <div className="capability-grid">
            <article className="capability capability-large"><span className="capability-no">01</span><div className="capability-art intake-art"><div className="sound-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><span>“I need to see a doctor this week.”</span></div><h3>Listen, understand, organize.</h3><p>Voice-intent and intake steps capture a caller’s request and the details the clinic needs to respond.</p></article>
            <article className="capability"><span className="capability-no">02</span><div className="capability-art triage-art"><span>REASON FOR VISIT</span><strong>Follow-up</strong><span>DOCTOR PREFERENCE</span><strong>Dr. Sarah Chen</strong><span>REQUESTED WINDOW</span><strong>This week</strong></div><h3>Route with context.</h3><p>Triage organizes preferences and visit context before a booking is prepared.</p></article>
            <article className="capability"><span className="capability-no">03</span><div className="capability-art confirm-art"><span className="confirm-check">✓</span><strong>Appointment ready</strong><small>Doctor · Date · Time</small><div className="confirm-rule"/><span className="confirm-tag">CONFIRMATION STEP</span></div><h3>Close the loop.</h3><p>Booking and confirmation steps return a clear outcome for staff and the patient.</p></article>
          </div>
        </section>

        <section className="subscription-section" id="plans">
          <div className="section-heading"><div><p className="section-kicker">A PLAN THAT GROWS WITH YOUR CLINIC</p><h2>One calmer front desk.<br />A clear monthly price.</h2></div><p>Start with one clinic, add locations when you’re ready, and keep calls, bookings and patient follow-up in one workspace.</p></div>
          <div className="subscription-cards">{marketedPlans.map((plan) => <article className={`subscription-card ${plan.id === 'growth' ? 'subscription-card-featured' : ''}`} key={plan.id}>
            {plan.id === 'growth' && <span className="subscription-popular">MOST POPULAR</span>}
            <p className="section-kicker">{plan.name.toUpperCase()}</p><h3>{formatCurrency(plan.monthly_price)}<small> / month</small></h3><p className="subscription-yearly">{formatCurrency(plan.annual_price)} billed annually</p>
            <ul><li>{plan.clinic_limit || 'Unlimited'} {plan.clinic_limit === 1 ? 'clinic' : 'clinics'}</li><li>{plan.user_limit || 'Unlimited'} team members</li><li>Patient and appointment workspace</li><li>Agent workflow and clinic-hour controls</li><li>Reports and appointment exports</li></ul>
            <button className={plan.id === 'growth' ? 'button-dark' : 'button-outline'} onClick={() => { setClinicInterestForm({ ...emptyClinicInterest, plan: plan.id }); document.getElementById('clinic-request')?.scrollIntoView({ behavior: 'smooth' }); }}>Request {plan.name} <span aria-hidden="true">→</span></button>
          </article>)}</div>
          <div className="clinic-request-card" id="clinic-request">
            <div><p className="section-kicker">GET YOUR CLINIC STARTED</p><h3>See how CareStack fits your front desk.</h3><p>Send a short request and our team can help set up your clinic workspace and calling line.</p></div>
            <form onSubmit={submitClinicInterest}>
              <div className="clinic-request-fields"><label>Clinic name<input required minLength="2" value={clinicInterestForm.clinic_name} onChange={(event) => setClinicInterestForm({ ...clinicInterestForm, clinic_name: event.target.value })} /></label><label>Your name<input required minLength="2" value={clinicInterestForm.contact_name} onChange={(event) => setClinicInterestForm({ ...clinicInterestForm, contact_name: event.target.value })} /></label><label>Work email<input type="email" required value={clinicInterestForm.email} onChange={(event) => setClinicInterestForm({ ...clinicInterestForm, email: event.target.value })} /></label><label>Phone<input type="tel" required value={clinicInterestForm.phone} onChange={(event) => setClinicInterestForm({ ...clinicInterestForm, phone: event.target.value })} /></label><label>Interested plan<select value={clinicInterestForm.plan} onChange={(event) => setClinicInterestForm({ ...clinicInterestForm, plan: event.target.value })}>{marketedPlans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label></div>
              {clinicInterestError && <div className="login-error" role="alert">{clinicInterestError}</div>}{clinicInterestMessage && <div className="clinic-interest-success" role="status">{clinicInterestMessage}</div>}
              <button className="button-dark" disabled={busy}>{busy ? 'Sending request…' : 'Request a clinic demo'} <span aria-hidden="true">→</span></button>
            </form>
          </div>
        </section>

        <section className="clinic-band" id="for-clinics">
          <div className="clinic-band-copy"><p className="section-kicker">MADE FOR MULTI-CLINIC TEAMS</p><h2>Your clinic’s name.<br />Your team’s workspace.</h2><p>Each clinic gets a branded subdomain, a tenant-scoped dashboard, patient management, appointment operations and reporting. Platform administrators manage onboarding and subscriptions separately.</p><button className="button-light" onClick={() => openLogin('tenant')}>Sign in to your clinic <span aria-hidden="true">→</span></button></div>
          <div className="tenant-preview"><div className="tenant-preview-top"><span className="preview-mark">S</span><span>SKYCARE CLINIC</span><span className="preview-status"><i/> WORKSPACE ACTIVE</span></div><div className="tenant-preview-title"><small>CLINIC OVERVIEW</small><strong>Today, at a glance.</strong></div><div className="preview-metrics"><div><span>Active patients</span><strong>—</strong></div><div><span>Next 7 days</span><strong>—</strong></div><div><span>Care team</span><strong>—</strong></div></div><div className="preview-agenda"><span>APPOINTMENT FLOW</span><div><b>01</b><span>Patient intake</span><i>→</i></div><div><b>02</b><span>Clinic coordination</span><i>→</i></div><div><b>03</b><span>Outcome tracking</span><i>✓</i></div></div><small className="preview-disclaimer">Illustrative workspace preview · live figures appear after clinic sign-in</small></div>
        </section>

        <section className="security-strip"><span className="section-kicker">BUILT AROUND CLEAR BOUNDARIES</span><div><strong>Tenant data stays scoped</strong><span>Clinic sessions are restricted to their organization.</span></div><div><strong>Role-based access</strong><span>Clinic admins and platform admins have separate workspaces.</span></div><div><strong>Operations stay visible</strong><span>Appointments and agent outcomes can be reviewed by staff.</span></div></section>

        <section className="closing-cta"><p className="section-kicker">READY TO BRING YOUR CLINIC ONBOARD?</p><h2>A clearer day for your care team starts here.</h2><div><a className="button-dark" href="#clinic-request">Request a demo <span aria-hidden="true">→</span></a><button className="button-outline" onClick={() => openLogin('tenant')}>Clinic sign in</button></div></section>
      </main>

      <footer className="site-footer"><a className="site-wordmark" href="#top"><span className="wordmark-symbol">C</span><span>care<span>stack</span></span></a><span>AI-assisted clinic operations · India</span><button onClick={() => openLogin('super_admin')}>Platform admin</button></footer>

      {loginOpen && <div className="login-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
        <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-heading">
          <button className="login-close" aria-label="Close sign in" onClick={() => setLoginOpen(false)}>×</button>
          <p className="section-kicker">CARESTACK ACCESS</p><h2 id="login-heading">Welcome back.</h2><p className="login-subtitle">Choose your workspace to continue.</p>
          <div className="login-role-switch" role="tablist" aria-label="Choose sign-in type"><button role="tab" aria-selected={loginRole === 'tenant'} className={loginRole === 'tenant' ? 'selected' : ''} onClick={() => openLogin('tenant')}>Clinic team</button><button role="tab" aria-selected={loginRole === 'super_admin'} className={loginRole === 'super_admin' ? 'selected' : ''} onClick={() => openLogin('super_admin')}>Platform admin</button></div>
          <div className="login-clinic-label"><span>{loginRole === 'tenant' ? 'CLINIC WORKSPACE' : 'PLATFORM CONTROL'}</span><strong>{loginRole === 'tenant' ? tenantBrand.name : 'CareStack platform'}</strong>{loginRole === 'tenant' && <small>{tenantBrand.domain}</small>}</div>
          <form onSubmit={handleLogin}>
            <label htmlFor="site-login-email">Work email</label><input id="site-login-email" type="email" autoComplete="username" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
            <label htmlFor="site-login-password">Password</label><input id="site-login-password" type="password" autoComplete="current-password" required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="button-dark login-submit" disabled={busy}>{busy ? 'Signing in…' : loginRole === 'tenant' ? 'Open clinic workspace' : 'Open platform console'} <span aria-hidden="true">→</span></button>
          </form>
          {import.meta.env.DEV && <p className="login-demo-note">Local demo: {loginRole === 'tenant' ? `admin@${tenantBrand.domain}.in` : 'superadmin@hospital.ai'} / admin123</p>}
        </section>
      </div>}
    </div>
  );

  const renderLogin = () => (
    <div className="page-shell auth-shell">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="card shadow-lg border-0 rounded-4">
              <div className="card-body p-4 p-lg-5">
                <div className="text-center mb-4">
                  <div className="auth-logo" style={{ background: `${tenantBrand.accent}1a`, color: tenantBrand.accent }}>{tenantBrand.shortName.charAt(0)}</div>
                  <h2 className="fw-bold mt-3">{tenantBrand.name}</h2>
                  <p className="text-muted mb-0">Tenant admin / super admin access · {tenantBrand.hostname}</p>
                </div>

                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control form-control-lg"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control form-control-lg"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </div>

                  {error && <div className="alert alert-danger">{error}</div>}

                  <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
                </form>

                {import.meta.env.DEV && <div className="mt-4 text-muted small bg-light rounded-3 p-3">
                  Tenant demo: admin@skycare.in / admin123<br />Super admin: superadmin@hospital.ai / admin123
                </div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (!session) return null;

    return (
      <div className="page-shell dashboard-shell">
        <div className="container-fluid">
          <div className="row min-vh-100">
            <aside className="col-lg-2 bg-dark text-white px-3 py-4">
              <div className="brand-mark text-white mb-4">{superAdmin ? 'CARESTACK' : tenantBrand.shortName.toUpperCase()}</div>
              <nav className="nav flex-column gap-2">
                {(superAdmin ? [['overview', 'Overview'], ['leads', 'Clinic requests'], ['tenants', 'Tenants'], ['subscriptions', 'Plans & subscriptions']] : [['overview', 'Overview'], ['agents', 'Agents'], ['patients', 'Patients'], ['appointments', 'Appointments'], ['reports', 'Reports']]).map(([view, label]) => (
                  <button key={view} className={`nav-link text-start border-0 ${activeView === view ? 'active' : ''}`} onClick={() => { setActiveView(view); setError(''); setNotice(''); }}>{label}</button>
                ))}
              </nav>

              <div className="mt-5 p-3 rounded-3 bg-secondary-subtle text-dark">
                <small className="d-block text-uppercase text-muted mb-2">{superAdmin ? 'Access level' : 'Tenant'}</small>
                <strong>{superAdmin ? 'All organizations' : displayedTenant}</strong>
              </div>

              <button className="btn btn-outline-light w-100 mt-4" onClick={logout}>Log out</button>
            </aside>

            <main className="col-lg-10 p-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                <div>
                  <p className="small text-primary fw-bold mb-1 text-uppercase">{superAdmin ? 'Super admin' : `${tenantData?.plan || 'Clinic'} plan · ${tenantData?.region || 'India'}`}</p>
                  <h2 className="fw-bold mb-0">{superAdmin ? activeView === 'overview' ? 'Platform overview' : activeView === 'subscriptions' ? 'Plans & subscriptions' : activeView === 'leads' ? 'Clinic subscription requests' : 'Tenant management' : activeView === 'reports' ? 'Clinic reports' : activeView === 'agents' ? 'AI agents & voice calling' : displayedTenant}</h2>
                </div>
                {!superAdmin && <div className="d-flex align-items-center gap-2 flex-wrap"><span className="tenant-live-badge"><span />Workspace active</span>{activeView === 'reports' ? <button className="btn btn-outline-primary" onClick={() => exportTenantCsv('bookings')}>Export appointments</button> : <button className="btn btn-primary" onClick={() => { if (activeView === 'appointments') document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' }); else setActiveView('patients'); }}>{activeView === 'appointments' ? '+ Book appointment' : '+ Add patient'}</button>}</div>}
              </div>

              {(notice || error) && <div className={`alert ${error ? 'alert-danger' : 'alert-success'} alert-dismissible`} role="status">
                {error || notice}
                <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => { setError(''); setNotice(''); }} />
              </div>}

              {!superAdmin && activeView === 'overview' && renderTenantOverview()}

              {!superAdmin && activeView === 'agents' && <div className="row g-4">
                <div className="col-12"><section className="tenant-insight-panel">
                  <div className="admin-panel-heading"><div><h3>Try the booking agent</h3><p>Preview how it answers using this clinic’s current availability settings. This test needs no phone number or Exotel credentials.</p></div><span className="status-pill confirmed">Agent preview</span></div>
                  <form onSubmit={previewVoiceAgent} className="row g-2"><div className="col-md-6"><label className="visually-hidden" htmlFor="agent-preview-input">What does the caller say?</label><input id="agent-preview-input" className="form-control" value={agentPreviewInput} onChange={(event) => setAgentPreviewInput(event.target.value)} placeholder="Example: I need to book an appointment" /></div><div className="col-md-3"><button className="btn btn-primary w-100" disabled={busy || !agentPreviewInput.trim()}>{busy ? 'Checking…' : 'Preview text reply'}</button></div><div className="col-md-3"><button type="button" className="btn btn-outline-primary w-100" disabled={busy || agentPreviewListening} onClick={startSpokenAgentPreview}>{agentPreviewListening ? 'Listening…' : 'Speak to preview'}</button></div></form>
                  {agentPreviewReply && <div className="alert alert-info mt-3 mb-0" role="status"><strong>Agent:</strong> {agentPreviewReply}</div>}
                  <p className="small text-muted mt-3 mb-0">This no-key preview uses browser speech recognition and speech playback when supported. It is a rules-based test, not a live phone call; it does not save audio or book an appointment in CareStack.</p>
                </section></div>
                <div className="col-12"><section className="tenant-insight-panel clinic-call-number">
                  <div><p className="section-kicker mb-2">YOUR CLINIC’S AI BOOKING LINE</p><h3 className="mb-1">{clinicCallingNumber || 'Number not assigned yet'}</h3><p className="text-muted mb-0">{clinicCallingNumber ? `Dedicated to ${displayedTenant}. ${tenantData?.telephony?.enabled ? (tenantData.telephony.voice_provider === 'exotel_voicebot' ? 'Exotel Voicebot inbound is marked live.' : 'Sarvam inbound is active.') : 'Ask your platform administrator to finish the inbound flow setup before sharing it as live.'}` : 'Your platform administrator assigns a unique clinic number in Super Admin.'}</p></div>
                  <div className="d-flex gap-2 flex-wrap">{clinicCallingNumber && <><a className="btn btn-outline-primary" href={`tel:${clinicCallingNumber}`}>Call this line</a><button type="button" className="btn btn-outline-primary" onClick={shareClinicNumber}>Copy share message</button><a className="btn btn-success" href={`https://wa.me/?text=${encodeURIComponent(`Call ${displayedTenant} to book an appointment: ${clinicCallingNumber}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a></>}</div>
                </section></div>
                <div className="col-12"><section className="tenant-insight-panel">
                  <div className="admin-panel-heading"><div><h3>Train the agent with clinic-approved information</h3><p>Add facts callers commonly ask about. The agent uses these answers as its reference and hands off questions it cannot answer.</p></div><span className="status-pill confirmed">Clinic context</span></div>
                  {(() => { const context = voiceAgent.clinic_context || defaultVoiceAgent.clinic_context; const update = (key, value) => setVoiceAgent({ ...voiceAgent, clinic_context: { ...context, [key]: value } }); const faqs = [...(context.faqs || [])]; while (faqs.length < 3) faqs.push({ question: '', answer: '' }); return <div className="row g-3">
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-address">Clinic address</label><textarea id="agent-address" className="form-control" rows="2" maxLength="500" value={context.address || ''} onChange={(event) => update('address', event.target.value)} placeholder="Full address and nearby landmark" /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-languages">Languages (comma separated)</label><input id="agent-languages" className="form-control" value={(context.languages || []).join(', ')} onChange={(event) => update('languages', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Hindi, Hinglish, English" /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-services">Services (one per line)</label><textarea id="agent-services" className="form-control" rows="3" value={(context.services || []).join('\n')} onChange={(event) => update('services', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} placeholder="General consultation\nDental care" /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-doctors">Doctors and specialties (one per line)</label><textarea id="agent-doctors" className="form-control" rows="3" value={(context.doctors || []).join('\n')} onChange={(event) => update('doctors', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} placeholder="Dr. A. Sharma — General Medicine" /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-fees">Fees and payment information</label><textarea id="agent-fees" className="form-control" rows="3" maxLength="2000" value={context.fees || ''} onChange={(event) => update('fees', event.target.value)} placeholder="Consultation fee, accepted payment methods, insurance notes" /></div>
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-instructions">Receptionist instructions</label><textarea id="agent-instructions" className="form-control" rows="3" maxLength="4000" value={context.instructions || ''} onChange={(event) => update('instructions', event.target.value)} placeholder="For example: ask patients to arrive 15 minutes early." /></div>
                    <div className="col-12"><h5 className="mb-1">Frequently asked questions</h5><p className="small text-muted">Save exact answers approved by your clinic. Leave unused rows blank.</p>{faqs.map((faq, index) => <div className="row g-2 mb-2" key={index}><div className="col-md-5"><label className="visually-hidden" htmlFor={`agent-faq-q-${index}`}>Question {index + 1}</label><input id={`agent-faq-q-${index}`} className="form-control" maxLength="300" value={faq.question} placeholder={`Question ${index + 1}`} onChange={(event) => { faqs[index] = { ...faq, question: event.target.value }; update('faqs', faqs); }} /></div><div className="col-md-7"><label className="visually-hidden" htmlFor={`agent-faq-a-${index}`}>Approved answer {index + 1}</label><input id={`agent-faq-a-${index}`} className="form-control" maxLength="1200" value={faq.answer} placeholder="Clinic-approved answer" onChange={(event) => { faqs[index] = { ...faq, answer: event.target.value }; update('faqs', faqs); }} /></div></div>)}<button type="button" className="btn btn-sm btn-outline-primary" onClick={() => update('faqs', [...faqs, { question: '', answer: '' }])} disabled={faqs.length >= 25}>Add FAQ</button></div>
                    <div className="col-12"><button type="button" className="btn btn-primary" disabled={busy} onClick={saveVoiceAgent}>{busy ? 'Saving…' : 'Save clinic agent context'}</button></div>
                  </div>; })()}
                </section></div>
                <div className="col-xl-5"><section className="tenant-insight-panel h-100">
                  <div className="admin-panel-heading"><div><h3>Clinic voice agent</h3><p>Set when the inbound booking agent can answer calls.</p></div><span className={`status-pill ${voiceAgent.enabled ? 'confirmed' : 'cancelled'}`}>{voiceAgent.enabled ? 'Enabled' : 'Paused'}</span></div>
                  <form onSubmit={saveVoiceAgent}>
                    <label className="d-flex align-items-center justify-content-between gap-3 py-3 border-bottom"><span><strong>Accept AI booking calls</strong><small className="d-block text-muted">Pause call handling without removing your setup.</small></span><input type="checkbox" className="form-check-input" checked={voiceAgent.enabled} onChange={(event) => setVoiceAgent({ ...voiceAgent, enabled: event.target.checked })} /></label>
                    <label className="form-label mt-3" htmlFor="agent-hours">Call availability</label><select id="agent-hours" className="form-select" value={voiceAgent.availability} onChange={(event) => setVoiceAgent({ ...voiceAgent, availability: event.target.value })}><option value="business_hours">Clinic opening hours</option><option value="all_day">All day, every day</option></select>
                    {voiceAgent.availability === 'business_hours' && <div className="row g-3 mt-1"><div className="col-6"><label className="form-label" htmlFor="agent-open">Opens</label><input id="agent-open" type="time" className="form-control" required value={voiceAgent.open_time} onChange={(event) => setVoiceAgent({ ...voiceAgent, open_time: event.target.value })} /></div><div className="col-6"><label className="form-label" htmlFor="agent-close">Closes</label><input id="agent-close" type="time" className="form-control" required value={voiceAgent.close_time} onChange={(event) => setVoiceAgent({ ...voiceAgent, close_time: event.target.value })} /></div></div>}
                    <label className="form-label mt-3" htmlFor="agent-appointment-duration">Appointment length</label><select id="agent-appointment-duration" className="form-select" value={voiceAgent.appointment_duration_minutes || 30} onChange={(event) => setVoiceAgent({ ...voiceAgent, appointment_duration_minutes: Number(event.target.value) })}><option value={15}>15 minutes</option><option value={20}>20 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option></select><small className="text-muted">The agent checks this full time window against existing bookings for the same doctor. Overlapping and duplicate appointments are rejected.</small>
                    <label className="form-label mt-3" htmlFor="agent-timezone">Clinic timezone</label><select id="agent-timezone" className="form-select" value={voiceAgent.timezone} onChange={(event) => setVoiceAgent({ ...voiceAgent, timezone: event.target.value })}><option value="Asia/Kolkata">India · Asia/Kolkata</option><option value="Asia/Dubai">UAE · Asia/Dubai</option><option value="Europe/London">UK · Europe/London</option><option value="America/New_York">US Eastern · America/New_York</option></select>
                    <p className="small text-muted mt-3 mb-0">Appointment requests outside these hours are rejected. The platform administrator configures this clinic’s dedicated number and Exotel routing.</p>
                    <button className="btn btn-primary mt-3" disabled={busy}>{busy ? 'Saving…' : 'Save agent settings'}</button>
                  </form>
                </section></div>
                <div className="col-xl-7"><section className="tenant-insight-panel h-100">
                  <div className="admin-panel-heading"><div><h3>Booking call agents</h3><p>Steps used to turn a caller’s answers into an appointment.</p></div></div>
                  <div className="agenda-list"><div className="agenda-row"><span className="agenda-index">01</span><div><strong>Voice intent agent</strong><small>Greets callers and identifies appointment requests.</small></div><span className="status-pill confirmed">Ready</span></div><div className="agenda-row"><span className="agenda-index">02</span><div><strong>Intake agent</strong><small>Collects patient name, callback number, doctor, date, and reason.</small></div><span className="status-pill confirmed">Ready</span></div><div className="agenda-row"><span className="agenda-index">03</span><div><strong>Appointment agent</strong><small>Checks clinic hours and records the confirmed request.</small></div><span className="status-pill confirmed">Ready</span></div><div className="agenda-row"><span className="agenda-index">04</span><div><strong>Confirmation agent</strong><small>Reads the appointment details back to the caller.</small></div><span className="status-pill confirmed">Ready</span></div></div>
                  <div className="alert alert-info mt-3 mb-0">This number is stored against this clinic. Live AI call answering requires provider provisioning and a voice webhook connection.</div>
                </section></div>
              </div>}

              {superAdmin && activeView === 'overview' && renderAdminOverview()}
              {superAdmin && activeView === 'subscriptions' && renderSubscriptions()}
              {superAdmin && activeView === 'leads' && <div className="card border-0 shadow-sm rounded-4 mb-4"><div className="card-body"><h4 className="mb-1">New clinic interest</h4><p className="text-muted mb-3">Follow up with clinics that requested subscription information or a demo.</p><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Clinic</th><th>Contact</th><th>Phone</th><th>Plan</th><th>Received</th></tr></thead><tbody>{clinicInterests.length ? clinicInterests.map((lead) => <tr key={lead.id}><td className="fw-semibold">{lead.clinic_name}<small className="d-block text-muted">{lead.email}</small></td><td>{lead.contact_name}</td><td><a href={`tel:${lead.phone}`}>{lead.phone}</a></td><td className="text-capitalize">{lead.plan}</td><td>{new Date(lead.created_at).toLocaleDateString('en-IN')}</td></tr>) : <tr><td colSpan="5" className="text-muted py-4">No clinic requests yet.</td></tr>}</tbody></table></div></div></div>}

              {superAdmin && activeView === 'tenants' && <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body">
                  <h4 className="mb-3">Tenant organizations</h4>
                  {voiceToolSecret && <div className="alert alert-info" role="status"><strong>Connect this clinic’s Exotel IVR to CareStack booking</strong><p className="mb-2">This clinic-scoped secret lets the Exotel Voicebot call its CareStack tools. Copy it into the Exotel tool’s <code>x-voice-tool-secret</code> header. It is shown only in this admin session.</p><label className="form-label">Exotel reachable API base URL</label><input className="form-control font-monospace mb-2" value={voiceToolApiBaseUrl} onChange={(event) => { const value = event.target.value.trim().replace(/\/+$/, ''); setVoiceToolApiBaseUrl(value); try { localStorage.setItem('carestack-voice-tool-api-base-url', value); } catch {} }} placeholder={API_URL} /><small className="d-block text-muted mb-2">The default uses the configured CareStack API URL. For local testing use <code>http://localhost:3001</code>; Exotel calls require the API service's public HTTPS URL.</small><label className="form-label">Clinic voice tool endpoint</label><input className="form-control font-monospace mb-2" readOnly value={`${voiceToolApiBaseUrl.replace(/\/+$/, '')}/api/voice/tools/${telephonyTenantId}`} onFocus={(event) => event.target.select()} />{/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(voiceToolApiBaseUrl) && <p className="alert alert-warning py-2">Exotel cloud cannot reach localhost. The local endpoint works for testing on this machine; calls from Exotel need a public HTTPS URL.</p>}<label className="form-label">Clinic tool secret</label><input className="form-control font-monospace" readOnly value={voiceToolSecret} onFocus={(event) => event.target.select()} /><div className="mt-3"><strong>Exotel console setup</strong><ol className="mb-2 mt-2"><li>In <b>Build Bot → Tool Integration</b>, create three active POST tools using the endpoint above and JSON request bodies below. Add header <code>x-voice-tool-secret</code> with the clinic secret.</li><li>Attach the tools to the clinic’s published Voicebot and map each value from the caller’s speech. Use ISO dates (<code>YYYY-MM-DD</code>) and 24-hour times (<code>HH:mm</code>).</li><li>In App Bazaar, connect <b>Greeting → IVR Menu</b>. Set “Press 1 for appointment booking” to the published booking Voicebot applet. Assign the saved app flow to this clinic’s ExoPhone.</li><li>Tell the bot to collect the patient’s name, callback number, doctor, date, time and reason; check availability; read all details back; get a clear yes; then call the booking tool. Read the confirmed booking ID back to the caller.</li></ol><details><summary>Tool request bodies</summary><p className="small mt-2 mb-1">Create a <code>carestack_clinic_info</code> tool with this body:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'clinic_info' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_check_availability</code> tool. Map date, time and doctor_name from the conversation:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'availability', date: 'YYYY-MM-DD', time: 'HH:mm', doctor_name: 'doctor name' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_book_appointment</code> tool. Map request_id to a unique ID per call, confirmed to true only after caller approval, and the remaining fields from the confirmed details:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'book', request_id: 'unique-call-id', confirmed: true, patient_name: 'patient name', phone_number: '+919876543210', doctor_name: 'doctor name', date: 'YYYY-MM-DD', time: 'HH:mm', reason: 'visit reason' }, null, 2)}</pre></details><p className="small mb-0"><b>Important:</b> Exotel must be able to reach this endpoint over public HTTPS. A localhost URL will not work from an Exotel call. A successful appointment appears immediately in this clinic’s CareStack appointments; booking hours, future dates, duplicate slots and caller confirmation are checked by the API.</p></div></div>}
                  <div className="table-responsive mb-4"><table className="table align-middle">
                    <thead><tr><th>Clinic</th><th>Portal</th><th>Administrator</th><th>Plan</th><th>AI phone</th><th>Subscription</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>{tenants.length ? tenants.map((tenant) => <tr key={tenant.id}>
                      <td><div className="fw-semibold">{tenant.name}</div><small className="text-muted">{tenant.region}</small></td>
                      <td><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></td>
                      <td>{tenant.admin_email}</td>
                      <td className="text-capitalize">{tenant.plan}<small className="d-block text-muted">{tenant.billing_cycle}</small></td>
                      <td><div>{telephonyTenantId === tenant.id ? (telephonyForm.phone_number || 'Not assigned') : (tenant.telephony?.phone_number || 'Not assigned')}</div><small className="text-muted">{telephonyTenantId === tenant.id ? `${telephonyForm.voice_provider === 'exotel_voicebot' ? 'Exotel Voicebot' : 'Sarvam'} · editing (unsaved)` : tenant.telephony?.voice_provider === 'exotel_voicebot' ? (tenant.telephony?.enabled ? 'Exotel Voicebot · live' : 'Exotel Voicebot · console setup') : tenant.telephony?.deployment_status === 'active' ? 'Sarvam inbound active' : 'Not deployed'}</small></td>
                      <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
                      <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => configureClinicTelephony(tenant)}>Configure calling</button><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editTenant(tenant)}>Edit</button><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'} me-2`} onClick={() => updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : 'Activate'}</button><button className="btn btn-sm btn-outline-danger" onClick={() => removeTenant(tenant)}>Delete</button></td>
                    </tr>) : <tr><td colSpan="6" className="text-muted">No tenants yet.</td></tr>}</tbody>
                  </table></div>
                  {telephonyTenantId && <div id="clinic-telephony-form" className="border rounded-4 p-3 p-md-4 mb-4 bg-light">
                    <div className="d-flex justify-content-between align-items-start gap-3"><div><h4 className="mb-1">Calling setup · {tenants.find((tenant) => tenant.id === telephonyTenantId)?.name}</h4><p className="text-muted">Each voice provider keeps its own Exophone, account, and routing settings. Exotel API credentials are encrypted and never sent back to this form.</p></div><span className={`status-pill ${tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.exotel_credentials_configured ? 'confirmed' : 'cancelled'}`}>{tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.exotel_credentials_configured ? 'Exotel credentials saved' : 'Exotel credentials needed'}</span></div>
                    <form onSubmit={saveClinicTelephony}><div className="row g-3">
                      <div className="col-md-6"><label className="form-label">AI voice provider</label><select className="form-select" value={telephonyForm.voice_provider || 'sarvam'} onChange={(event) => { selectTelephonyProvider(event.target.value); setExotelConnectionStatus(''); }}><option value="sarvam">Sarvam Voice Agents</option><option value="exotel_voicebot">Exotel Voicebot</option></select><small className="text-muted">Choose one voice engine per clinic. Exotel phone routing stays the telephony layer.</small></div>
                      <div className="col-md-6"><label className="form-label">Clinic Exophone number</label><input className="form-control" type="tel" placeholder="+919876543210" value={telephonyForm.phone_number || ''} onChange={(event) => updateTelephonyField('phone_number', event.target.value)} /><small className="text-muted">Unique across clinics; use international format.</small></div>
                      <div className="col-md-6"><label className="form-label">Exotel Account SID</label><input className="form-control" value={telephonyForm.account_sid || ''} onChange={(event) => updateTelephonyField('account_sid', event.target.value)} /><small className="text-muted">Use the Account SID shown with the CPaaS API credentials in Exotel Dashboard → Settings → API Settings.</small></div>
                      <div className="col-md-6"><label className="form-label">Exotel region</label><select className="form-select" value={telephonyForm.region || 'mumbai'} onChange={(event) => updateTelephonyField('region', event.target.value)}><option value="mumbai">India · Mumbai</option><option value="singapore">Singapore</option></select></div>
                      {telephonyForm.voice_provider === 'exotel_voicebot' ? <>
                        <div className="col-12"><h5 className="mt-2 mb-0">Exotel Voicebot</h5><p className="small text-muted mb-0">Legacy managed voicebot option. CareStack’s own agent runtime is the provider-neutral path.</p></div>
                        <div className="col-md-6"><label className="form-label">Exotel CPaaS API Key</label><input className="form-control" type="password" autoComplete="new-password" value={telephonyForm.exotel_api_key || ''} onChange={(event) => setTelephonyForm({ ...telephonyForm, exotel_api_key: event.target.value })} placeholder={tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.exotel_credentials_configured ? 'Saved — enter a new key to replace it' : 'Enter CPaaS API Key'} /><small className="text-muted">Use the CPaaS API Key, not a Voicebot key. Leave blank to keep the saved value.</small></div>
                        <div className="col-md-6"><label className="form-label">Exotel CPaaS API Token / Secret</label><input className="form-control" type="password" autoComplete="new-password" value={telephonyForm.exotel_api_token || ''} onChange={(event) => setTelephonyForm({ ...telephonyForm, exotel_api_token: event.target.value })} placeholder={tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.exotel_credentials_configured ? 'Saved — enter a new token to replace it' : 'Enter CPaaS API Token'} /><small className="text-muted">Use the CPaaS API Token paired with that key. Stored encrypted on the server.</small></div>
                        <div className="col-md-6"><label className="form-label">Exotel App / Flow ID</label><input className="form-control" value={telephonyForm.app_id || ''} onChange={(event) => updateTelephonyField('app_id', event.target.value)} /><small className="text-muted">Assign the matching inbound flow to this clinic’s Exophone.</small></div>
                        <div className="col-md-6"><label className="form-label">Exotel Voicebot ID</label><input className="form-control" value={telephonyForm.exotel_voicebot_id || ''} onChange={(event) => updateTelephonyField('exotel_voicebot_id', event.target.value)} /><small className="text-muted">Reference from the Exotel Voicebot console.</small></div><div className="col-12"><label className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input mt-0" checked={Boolean(telephonyForm.enabled)} onChange={(event) => updateTelephonyField('enabled', event.target.checked)} /><span><strong>Exotel inbound flow is assigned and tested</strong><small className="d-block text-muted">Enable the clinic’s live status after assigning this flow to its ExoPhone and completing a test call.</small></span></label></div>
                        {exotelConnectionStatus && <div className="col-md-6 align-self-end"><span className={`status-pill ${exotelConnectionStatus === 'Connected' ? 'confirmed' : 'cancelled'}`}>{exotelConnectionStatus}</span></div>}
                      </> : <>
                      <div className="col-12"><h5 className="mt-2 mb-0">Sarvam inbound agent</h5></div>
                      <div className="col-md-6"><label className="form-label">Organization ID</label><input className="form-control" value={telephonyForm.sarvam_org_id || ''} onChange={(event) => updateTelephonyField('sarvam_org_id', event.target.value)} /></div>
                      <div className="col-md-6"><label className="form-label">Workspace ID</label><input className="form-control" value={telephonyForm.sarvam_workspace_id || ''} onChange={(event) => updateTelephonyField('sarvam_workspace_id', event.target.value)} /></div>
                      <div className="col-md-6"><label className="form-label">Agent / app ID</label><input className="form-control" value={telephonyForm.sarvam_agent_id || ''} onChange={(event) => updateTelephonyField('sarvam_agent_id', event.target.value)} /></div>
                      <div className="col-md-6"><label className="form-label">Agent version</label><input className="form-control" type="number" min="1" value={telephonyForm.sarvam_agent_version || ''} onChange={(event) => updateTelephonyField('sarvam_agent_version', event.target.value)} /></div>
                      <div className="col-md-6"><label className="form-label">Sarvam Exotel connection ID</label><input className="form-control" value={telephonyForm.sarvam_connection_id || ''} onChange={(event) => updateTelephonyField('sarvam_connection_id', event.target.value)} /></div>
                      </>}
                    </div><p className="alert alert-info mt-3 mb-0">Exotel credentials and phone routing are saved separately from the AI agent configuration. Use Verify Exotel account to check the saved Account SID and credentials. Provider-specific activation is available for the existing managed agent options.</p><div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save calling settings'}</button><button type="button" className="btn btn-outline-secondary" onClick={() => setTelephonyTenantId(null)}>Cancel</button><button type="button" className="btn btn-outline-success ms-auto" disabled={busy || !tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.exotel_credentials_configured || !telephonyForm.account_sid} onClick={() => verifyExotelForClinic(telephonyTenantId)}>Verify Exotel account</button>{telephonyForm.voice_provider !== 'exotel_voicebot' && <button type="button" className="btn btn-success" disabled={busy || !tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.credentials_configured || tenants.find((tenant) => tenant.id === telephonyTenantId)?.telephony?.deployment_status === 'active'} onClick={() => activateClinicVoice(telephonyTenantId)}>Activate inbound calls</button>}</div></form>
                  </div>}
                  <div id="tenant-management-form"><h4 className="mb-1">{editingTenantId ? 'Edit tenant' : 'Onboard a clinic'}</h4>
                  <p className="text-muted mb-3">{editingTenantId ? 'Update clinic identity, plan, billing cycle, or subscription state.' : 'Create its tenant identity and first administrator.'}</p>
                  <form onSubmit={handleTenantSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6"><label className="form-label" htmlFor="tenant-name">Clinic name</label><input id="tenant-name" className="form-control" required minLength="2" value={tenantForm.tenant_name} onChange={(event) => setTenantForm({ ...tenantForm, tenant_name: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="tenant-domain">Tenant slug</label><div className="input-group"><input id="tenant-domain" className="form-control" pattern="[a-z0-9]+(-[a-z0-9]+)*" required minLength="2" value={tenantForm.tenant_domain} onChange={(event) => setTenantForm({ ...tenantForm, tenant_domain: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /><span className="input-group-text">workspace</span></div><small className="text-muted">Clinics use the shared CareStack URL with this tenant slug.</small></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-name">Admin name</label><input id="admin-name" className="form-control" required value={tenantForm.admin_name} onChange={(event) => setTenantForm({ ...tenantForm, admin_name: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-email">Admin email</label><input id="admin-email" type="email" className="form-control" required value={tenantForm.admin_email} onChange={(event) => setTenantForm({ ...tenantForm, admin_email: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-phone">Admin phone</label><input id="admin-phone" type="tel" className="form-control" required value={tenantForm.admin_phone} onChange={(event) => setTenantForm({ ...tenantForm, admin_phone: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-plan">Plan</label><select id="tenant-plan" className="form-select" value={tenantForm.plan} onChange={(event) => setTenantForm({ ...tenantForm, plan: event.target.value })}>{(plans.length ? plans : [{ id: 'starter', name: 'Starter' }, { id: 'growth', name: 'Growth' }, { id: 'enterprise', name: 'Enterprise' }]).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-cycle">Billing cycle</label><select id="tenant-cycle" className="form-select" value={tenantForm.billing_cycle} onChange={(event) => setTenantForm({ ...tenantForm, billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-region">Region</label><input id="tenant-region" className="form-control" required value={tenantForm.region} onChange={(event) => setTenantForm({ ...tenantForm, region: event.target.value })} /></div>
                      {editingTenantId && <div className="col-md-3"><label className="form-label" htmlFor="tenant-status">Subscription status</label><select id="tenant-status" className="form-select" value={tenantForm.subscription_status} onChange={(event) => setTenantForm({ ...tenantForm, subscription_status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option></select></div>}
                    </div>
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingTenantId ? 'Save tenant' : 'Create tenant'}</button>{editingTenantId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingTenantId(null); setTenantForm(emptyTenant); }}>Cancel</button>}</div>
                  </form>
                  </div>
                </div>
              </div>}

              {!superAdmin && activeView === 'patients' && <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body">
                  <h4 className="mb-3">{editingPatientId ? 'Edit patient' : 'Register patient'}</h4>
                  <form onSubmit={handlePatientSubmit}>
                    <div className="row g-3">
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-name">Full name</label><input id="patient-name" className="form-control" required minLength="2" value={patientForm.name} onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })} /></div>
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-phone">Phone</label><input id="patient-phone" className="form-control" required value={patientForm.phone} onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })} /></div>
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-email">Email</label><input id="patient-email" type="email" className="form-control" value={patientForm.email || ''} onChange={(event) => setPatientForm({ ...patientForm, email: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="patient-age">Age</label><input id="patient-age" type="number" min="0" max="125" className="form-control" value={patientForm.age} onChange={(event) => setPatientForm({ ...patientForm, age: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="patient-status">Status</label><select id="patient-status" className="form-select" value={patientForm.status} onChange={(event) => setPatientForm({ ...patientForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="patient-notes">Notes</label><input id="patient-notes" className="form-control" value={patientForm.notes || ''} onChange={(event) => setPatientForm({ ...patientForm, notes: event.target.value })} /></div>
                    </div>
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{editingPatientId ? 'Save changes' : 'Add patient'}</button>{editingPatientId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setPatientForm(emptyPatient); setEditingPatientId(null); }}>Cancel</button>}</div>
                  </form>
                </div>
              </div>}

              {!superAdmin && activeView === 'appointments' && <div className="card border-0 shadow-sm rounded-4 mb-4" id="booking-form">
                <div className="card-body">
                  <h4 className="mb-1">Book an appointment</h4>
                  <p className="text-muted mb-3">Requests are processed by the Python booking agents.</p>
                  <form onSubmit={handleBookingSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6"><label className="form-label" htmlFor="booking-patient">Patient name</label><input id="booking-patient" className="form-control" required minLength="2" value={bookingForm.patient_name} onChange={(event) => setBookingForm({ ...bookingForm, patient_name: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="booking-phone">Phone number</label><input id="booking-phone" type="tel" className="form-control" required minLength="7" value={bookingForm.phone_number} onChange={(event) => setBookingForm({ ...bookingForm, phone_number: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="booking-doctor">Doctor</label><select id="booking-doctor" className="form-select" value={bookingForm.doctor_name} onChange={(event) => setBookingForm({ ...bookingForm, doctor_name: event.target.value })}><option>Dr. Sarah Chen</option><option>Dr. James Patel</option><option>Dr. Elena Gomez</option></select></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="booking-date">Date</label><input id="booking-date" type="date" className="form-control" required value={bookingForm.appointment_date} onChange={(event) => setBookingForm({ ...bookingForm, appointment_date: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="booking-time">Time</label><input id="booking-time" type="time" className="form-control" required value={bookingForm.appointment_time} onChange={(event) => setBookingForm({ ...bookingForm, appointment_time: event.target.value })} /></div>
                      <div className="col-12"><label className="form-label" htmlFor="booking-reason">Reason for visit</label><input id="booking-reason" className="form-control" value={bookingForm.reason} onChange={(event) => setBookingForm({ ...bookingForm, reason: event.target.value })} /></div>
                    </div>
                    <button className="btn btn-primary mt-3" disabled={busy}>{busy ? 'Agent processing…' : 'Run booking agents'}</button>
                  </form>
                </div>
              </div>}

              {!superAdmin && activeView === 'reports' && <div className="tenant-report-stack">
                <section className="tenant-insight-panel">
                  <div className="admin-panel-heading"><div><h3>Clinic performance export</h3><p>Download current tenant records for finance, operations, and follow-up reviews.</p></div></div>
                  <div className="report-export-row">
                    <div><strong>Patient directory</strong><span>{patients.length} patient records · contact and status fields</span></div>
                    <button className="btn btn-outline-primary" onClick={() => exportTenantCsv('patients')}>Download CSV</button>
                  </div>
                  <div className="report-export-row">
                    <div><strong>Appointment register</strong><span>{bookings.length} appointments · doctor, scheduled time, reason, and status</span></div>
                    <button className="btn btn-outline-primary" onClick={() => exportTenantCsv('bookings')}>Download CSV</button>
                  </div>
                </section>
                <div className="row g-4">
                  <div className="col-lg-6"><section className="tenant-insight-panel h-100"><div className="admin-panel-heading"><div><h3>Upcoming schedule</h3><p>Next 7 days by appointment date</p></div></div><div className="report-schedule-list">{analytics.schedule.map((day) => <div key={day.date}><span>{day.label} <small>{day.date.slice(5)}</small></span><strong>{day.count} {day.count === 1 ? 'visit' : 'visits'}</strong></div>)}</div></section></div>
                  <div className="col-lg-6"><section className="tenant-insight-panel h-100"><div className="admin-panel-heading"><div><h3>Doctor workload</h3><p>Upcoming non-cancelled appointments</p></div></div>{analytics.doctor_workload.length ? analytics.doctor_workload.map((item) => <div className="doctor-row report-doctor-row" key={item.doctor}><span>{item.doctor}</span><div className="admin-bar-track"><span className="doctor-fill" style={{ width: `${(item.count / maxDoctorCount) * 100}%` }} /></div><strong>{item.count}</strong></div>) : <div className="empty-insight">No upcoming appointment workload to report.</div>}</section></div>
                </div>
              </div>}

              {!superAdmin && (activeView === 'overview' || activeView === 'patients' || activeView === 'appointments') && <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3"><div><h4 className="mb-1">{activeView === 'appointments' ? 'Appointment register' : activeView === 'overview' ? 'Recent patients' : 'Patient directory'}</h4>{activeView === 'appointments' && <p className="text-muted small mb-0">Update outcomes here; changes recalculate clinic analytics.</p>}</div>{activeView === 'patients' && <button className="btn btn-sm btn-outline-primary" onClick={() => exportTenantCsv('patients')}>Export patients</button>}</div>
                  {activeView === 'appointments' && <div className="row g-2 align-items-end mb-3">
                    <div className="col-md-6"><label className="form-label small" htmlFor="appointment-search">Search appointments</label><input id="appointment-search" className="form-control" placeholder="Patient, doctor, phone, or reference" value={appointmentQuery} onChange={(event) => setAppointmentQuery(event.target.value)} /></div>
                    <div className="col-md-3"><label className="form-label small" htmlFor="appointment-status-filter">Status</label><select id="appointment-status-filter" className="form-select" value={appointmentStatusFilter} onChange={(event) => setAppointmentStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></div>
                    <div className="col-md-3 d-grid"><button className="btn btn-outline-secondary" onClick={() => exportTenantCsv('bookings')}>Export appointments</button></div>
                  </div>}
                  <div className="table-responsive">
                    <table className="table align-middle">
                      {activeView === 'appointments' ? <thead><tr><th>Appointment</th><th>Patient</th><th>Doctor</th><th>Date &amp; time</th><th>Status</th><th>Update</th></tr></thead> : <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Status</th>
                          {activeView === 'patients' && <th className="text-end">Actions</th>}
                        </tr>
                      </thead>}
                      <tbody>
                        {activeView === 'appointments' ? filteredBookings.length === 0 ? (
                          <tr><td colSpan="6" className="text-muted py-4">{bookings.length ? 'No appointments match those filters.' : 'No appointments booked yet.'}</td></tr>
                        ) : filteredBookings.map((booking) => (
                          <tr key={booking.id}><td className="fw-semibold">{booking.id}</td><td>{booking.patient_name}<small className="d-block text-muted">{booking.phone_number}</small></td><td>{booking.doctor_name}</td><td>{booking.appointment_date}<small className="d-block text-muted">{booking.appointment_time}</small></td><td><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></td><td><select className="form-select form-select-sm appointment-status-select" aria-label={`Update ${booking.id} status`} value={booking.status} onChange={(event) => updateAppointmentStatus(booking.id, event.target.value)}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></td></tr>
                        )) : patients.length === 0 ? (
                          <tr>
                            <td colSpan={activeView === 'patients' ? 6 : 5} className="text-muted">No patients yet.</td>
                          </tr>
                        ) : (
                          patients.map((patient) => (
                            <tr key={patient.id}>
                              <td>{patient.id}</td>
                              <td>{patient.name}</td>
                              <td>{patient.phone}</td>
                              <td>{patient.email || '-'}</td>
                              <td>
                                <span className="badge bg-success-subtle text-success rounded-pill">{patient.status}</span>
                              </td>
                              {activeView === 'patients' && <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editPatient(patient)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => deletePatient(patient.id)}>Delete</button></td>}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>}
            </main>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {page === 'landing' && renderLanding()}
      {page === 'login' && renderLogin()}
      {page === 'dashboard' && renderDashboard()}
    </>
  );
}

export default App;
