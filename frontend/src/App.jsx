import { useEffect, useMemo, useRef, useState } from 'react';
import carestackMark from './carestack-mark.svg';

const PUBLIC_APP_URL = 'https://carestack-uat-web.onrender.com';
const PUBLIC_API_URL = 'https://carestack-6psq.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname === new URL(PUBLIC_APP_URL).hostname
    ? PUBLIC_API_URL
    : 'http://localhost:3001'
);
const emptyPatient = { name: '', phone: '', email: '', age: '', notes: '', status: 'active' };
const emptyBooking = { patient_name: '', phone_number: '', doctor_name: '', appointment_date: '', appointment_time: '', reason: 'General consultation' };
const emptyTenant = { tenant_name: '', tenant_domain: '', admin_name: '', admin_email: '', admin_phone: '', plan: 'growth', billing_cycle: 'monthly', subscription_status: 'active', region: 'India' };
const emptyPlan = { id: '', name: '', monthly_price: '', annual_price: '', clinic_limit: '', user_limit: '' };
const defaultVoiceAgent = { enabled: true, availability: 'business_hours', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: { address: '', services: [], doctors: [], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] } };
const emptyTelephony = { phone_number: '', account_sid: '', app_id: '', region: 'mumbai', enabled: false, exotel_api_key: '', exotel_api_token: '', sarvam_org_id: '', sarvam_workspace_id: '', sarvam_agent_id: '', sarvam_agent_version: '', sarvam_connection_id: '' };
const telephonyConfigFields = ['phone_number', 'account_sid', 'app_id', 'region', 'enabled', 'exotel_voicebot_id', 'sarvam_org_id', 'sarvam_workspace_id', 'sarvam_agent_id', 'sarvam_agent_version', 'sarvam_connection_id'];
const emptyProviderTelephony = Object.fromEntries(telephonyConfigFields.map((key) => [key, key === 'region' ? 'mumbai' : key === 'enabled' ? false : '']));
const providerTelephonyDefaults = { sarvam: { ...emptyProviderTelephony }, exotel_voicebot: { ...emptyProviderTelephony } };
const emptyClinicInterest = { clinic_name: '', contact_name: '', email: '', phone: '', plan: 'growth' };
const STAFF_PERMISSION_GROUPS = [
  { label: 'Overview', view: 'overview:view' },
  { label: 'AI workflow', view: 'agents:view' },
  { label: 'Doctors', view: 'doctors:view', manage: 'doctors:manage' },
  { label: 'Patients', view: 'patients:view', manage: 'patients:manage' },
  { label: 'Appointments', view: 'appointments:view', manage: 'appointments:manage' },
  { label: 'Reports', view: 'reports:view' },
];
const availableClinicViews = (user) => {
  if (!user || user.role === 'tenant_admin') return ['overview', 'agents', 'doctors', 'patients', 'appointments', 'reports'];
  const permissions = new Set(user.permissions || []);
  return [
    permissions.has('overview:view') && 'overview',
    permissions.has('agents:view') && 'agents',
    (permissions.has('doctors:view') || permissions.has('doctors:manage')) && 'doctors',
    (permissions.has('patients:view') || permissions.has('patients:manage')) && 'patients',
    (permissions.has('appointments:view') || permissions.has('appointments:manage')) && 'appointments',
    permissions.has('reports:view') && 'reports',
  ].filter(Boolean);
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function useListPagination(items, resetKey = '') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(10);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;

  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page: currentPage,
    pageCount,
    pageSize,
    total: items.length,
    start: items.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, items.length),
    setPage,
    setPageSize: (value) => {
      setPage(1);
      setPageSizeState(Number(value));
    },
  };
}

function ListPagination({ pagination, label = 'records' }) {
  if (pagination.total <= 10) return null;

  return <div className="list-pagination" aria-label={`${label} pagination`}>
    <span className="list-pagination-range">Showing {pagination.start}–{pagination.end} of {pagination.total} {label}</span>
    <div className="list-pagination-controls">
      <label className="list-pagination-size">Rows per page
        <select className="form-select form-select-sm" value={pagination.pageSize} onChange={(event) => pagination.setPageSize(event.target.value)} aria-label={`Rows per page for ${label}`}>
          {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      {pagination.pageCount > 1 && <div className="list-pagination-pages">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => pagination.setPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
        <span>Page {pagination.page} of {pagination.pageCount}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => pagination.setPage(pagination.page + 1)} disabled={pagination.page >= pagination.pageCount}>Next</button>
      </div>}
    </div>
  </div>;
}

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
  const [sessionRestoring, setSessionRestoring] = useState(() => {
    try {
      const savedSession = JSON.parse(localStorage.getItem('carestack-session') || 'null');
      return Boolean(savedSession?.access_token && savedSession.token !== 'demo-token');
    } catch {
      return false;
    }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState('tenant');
  const [loginMode, setLoginMode] = useState('login');
  const [loginStatus, setLoginStatus] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [pendingPasswordSession, setPendingPasswordSession] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [session, setSession] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', employee_id: '', avatar_data_url: '' });
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profilePasswordConfirm, setProfilePasswordConfirm] = useState('');
  const [profilePasswordOpen, setProfilePasswordOpen] = useState(false);
  const [profilePasswordResetOpen, setProfilePasswordResetOpen] = useState(false);
  const [profilePasswordResetCode, setProfilePasswordResetCode] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
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
  const [passwordTenantId, setPasswordTenantId] = useState(null);
  const [tenantPassword, setTenantPassword] = useState('');
  const [tenantPasswordConfirm, setTenantPasswordConfirm] = useState('');
  const [tenantManagementFormOpen, setTenantManagementFormOpen] = useState(false);
  const [editingTenantPassword, setEditingTenantPassword] = useState('');
  const [editingTenantPasswordConfirm, setEditingTenantPasswordConfirm] = useState('');
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [patientFormOpen, setPatientFormOpen] = useState(false);
  const [doctorForm, setDoctorForm] = useState({ name: '', specialty: '' });
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [appointmentRegisterOpen, setAppointmentRegisterOpen] = useState(true);
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [appointmentQuery, setAppointmentQuery] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState('all');
  const [overviewActivityRange, setOverviewActivityRange] = useState('7d');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [confirmationDialog, setConfirmationDialog] = useState(null);
  const confirmationResolverRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [seenBookingIds, setSeenBookingIds] = useState([]);
  const [seenClinicInterestIds, setSeenClinicInterestIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('carestack-seen-clinic-interests') || '[]'); } catch { return []; }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationMenuRef = useRef(null);
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
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ id: null, name: '', email: '', password: '', permissions: STAFF_PERMISSION_GROUPS.flatMap(({ view, manage }) => [view, ...(manage ? [manage] : [])]) });
  const [staffFormOpen, setStaffFormOpen] = useState(false);

  const askForConfirmation = (dialog) => new Promise((resolve) => {
    confirmationResolverRef.current = resolve;
    setConfirmationDialog(dialog);
  });

  const resolveConfirmation = (confirmed) => {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setConfirmationDialog(null);
    resolve?.(confirmed);
  };
  const [clinicInterestForm, setClinicInterestForm] = useState(emptyClinicInterest);
  const [clinicInterestMessage, setClinicInterestMessage] = useState('');
  const [clinicInterestError, setClinicInterestError] = useState('');

  useEffect(() => {
    const handleExpiredSession = () => {
      localStorage.removeItem('carestack-session');
      setSession(null);
      setTenantData(null);
      setPatients([]);
      setBookings([]);
      setTenants([]);
      setPlans([]);
      setAdminDashboard(null);
      setClinicInterests([]);
      setVoiceToolSecret('');
      setTelephonyForm(emptyTelephony);
      setActiveView('overview');
      setNotice('');
      setPage('landing');
      setLoginRole('tenant');
      setLoginMode('login');
      setLoginStatus('');
      setPendingPasswordSession(null);
      setLoginForm({ email: `admin@${tenantBrand.domain}.in`, password: '' });
      setLoginOpen(true);
      setError('Your CareStack session expired. Sign in again to continue.');
    };
    window.addEventListener('carestack-auth-expired', handleExpiredSession);
    return () => window.removeEventListener('carestack-auth-expired', handleExpiredSession);
  }, [tenantBrand.domain]);

  useEffect(() => {
    request('/api/public/plans').then((data) => setPublicPlans(data.plans || [])).catch(() => {});
  }, []);

  const openLogin = (role = 'tenant') => {
    setLoginRole(role);
    setLoginMode('login');
    setLoginStatus('');
    setResetCode('');
    setResetPassword('');
    setResetPasswordConfirm('');
    setPendingPasswordSession(null);
    setLoginForm({
      email: role === 'super_admin' ? 'superadmin@hospital.ai' : `admin@${tenantBrand.domain}.in`,
      password: '',
    });
    setError('');
    setLoginOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        let parsed;
        try {
          parsed = JSON.parse(localStorage.getItem('carestack-session') || 'null');
        } catch {
          localStorage.removeItem('carestack-session');
          return;
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
          await loadAdminData();
          return;
        }
        if (!parsed.tenant_id) {
          localStorage.removeItem('carestack-session');
          return;
        }

        const hostTenant = await request(`/api/tenant/resolve/${encodeURIComponent(tenantBrand.domain)}`);
        if (hostTenant.id !== parsed.tenant_id || hostTenant.subscription_status !== 'active') {
          localStorage.removeItem('carestack-session');
          setPage('login');
          setError(`This session is not active for the ${tenantBrand.domain} clinic workspace. Sign in with this clinic's account.`);
          return;
        }
        setSession(parsed);
        setPage('dashboard');
        setActiveView(availableClinicViews(parsed)[0] || 'overview');
        await loadDashboard(parsed.tenant_id, true, true);
      } catch (loadError) {
        if (cancelled) return;
        setSession(null);
        setPage('login');
        setError(loadError.message || 'Your clinic workspace could not be restored. Please sign in again.');
      } finally {
        if (!cancelled) setSessionRestoring(false);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
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
      if (user.must_change_password) {
        setPendingPasswordSession(nextSession);
        setLoginMode('initial-password');
        setLoginStatus('Your one-time password was accepted. Set a new password to finish signing in.');
        setLoginForm((current) => ({ ...current, password: '' }));
        return;
      }
      localStorage.setItem('carestack-session', JSON.stringify(nextSession));
      setSession(nextSession);
      setLoginOpen(false);
      setPage('dashboard');
      setActiveView(nextSession.role === 'super_admin' ? 'overview' : availableClinicViews(nextSession)[0] || 'overview');
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

  const submitPasswordResetRequest = async (event) => {
    event.preventDefault();
    setError(''); setLoginStatus(''); setBusy(true);
    try {
      const response = await request('/api/auth/password-reset/request', {
        method: 'POST', body: JSON.stringify({ email: loginForm.email.trim() }),
      });
      setLoginStatus(response.message || 'If an account matches that email, a reset code has been sent.');
      setLoginMode('reset');
    } catch (resetError) { setError(resetError.message); }
    finally { setBusy(false); }
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    setError(''); setLoginStatus('');
    if (resetPassword !== resetPasswordConfirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await request('/api/auth/password-reset/confirm', {
        method: 'POST', body: JSON.stringify({ email: loginForm.email.trim(), code: resetCode, password: resetPassword }),
      });
      setLoginMode('login');
      setResetCode(''); setResetPassword(''); setResetPasswordConfirm('');
      setLoginForm((current) => ({ ...current, password: '' }));
      setLoginStatus(response.message || 'Password updated. You can now sign in.');
    } catch (resetError) { setError(resetError.message); }
    finally { setBusy(false); }
  };

  const submitFirstPassword = async (event) => {
    event.preventDefault();
    setError(''); setLoginStatus('');
    if (resetPassword !== resetPasswordConfirm) { setError('The passwords do not match.'); return; }
    if (!pendingPasswordSession?.access_token) { setError('Please sign in again with your one-time password.'); setLoginMode('login'); return; }
    setBusy(true);
    try {
      await request('/api/auth/password/change', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pendingPasswordSession.access_token}` },
        body: JSON.stringify({ password: resetPassword }),
      });
      const nextSession = { ...pendingPasswordSession, must_change_password: false };
      localStorage.setItem('carestack-session', JSON.stringify(nextSession));
      setSession(nextSession);
      setPendingPasswordSession(null);
      setLoginOpen(false);
      setLoginMode('login');
      setPage('dashboard');
      setActiveView(availableClinicViews(nextSession)[0] || 'overview');
      await loadDashboard(nextSession.tenant_id);
    } catch (changeError) { setError(changeError.message); }
    finally { setBusy(false); }
  };

  const loadDashboard = async (tenantId, throwOnError = false, silent = false, activityRange = overviewActivityRange) => {
    if (!tenantId) return;
    try {
      const dashboard = await request(`/api/tenant/${tenantId}/dashboard?activity_range=${encodeURIComponent(activityRange)}`);
      const dashboardBookings = dashboard.bookings || [];
      const seenBookingsStorageKey = `carestack-seen-bookings-${tenantId}`;
      let persistedSeenBookingIds;
      try {
        const persisted = localStorage.getItem(seenBookingsStorageKey);
        if (persisted === null) {
          // The first visit establishes a baseline so historical bookings do not appear as new alerts.
          persistedSeenBookingIds = dashboardBookings.map((booking) => String(booking.id));
          localStorage.setItem(seenBookingsStorageKey, JSON.stringify(persistedSeenBookingIds));
        } else {
          const parsed = JSON.parse(persisted);
          persistedSeenBookingIds = Array.isArray(parsed) ? parsed.map(String) : [];
        }
      } catch {
        persistedSeenBookingIds = [];
      }
      setSeenBookingIds(persistedSeenBookingIds);
      setTenantData(dashboard);
      setPatients(dashboard.patients || []);
      setBookings(dashboardBookings);
      setVoiceAgent({
        ...defaultVoiceAgent,
        ...(dashboard.voice_agent || {}),
        clinic_context: {
          ...defaultVoiceAgent.clinic_context,
          ...(dashboard.voice_agent?.clinic_context || {}),
          doctors: (dashboard.voice_agent?.clinic_context?.doctors || []).filter((doctor) =>
            !['na', 'n/a', 'none', 'unknown', 'not available'].includes(String(doctor).trim().toLocaleLowerCase())),
        },
      });
      setClinicCallingNumber(dashboard.telephony?.phone_number || '');
      setLastRefreshed(new Date());
    } catch (err) {
      if (!silent) setError(err.message || 'Dashboard could not be loaded.');
      if (throwOnError) throw err;
    }
  };

  const loadStaff = async () => {
    if (!session?.tenant_id || session.role !== 'tenant_admin') return;
    try {
      const response = await request(`/api/tenant/${session.tenant_id}/staff`);
      setStaff(response.staff || []);
    } catch (loadError) { setError(loadError.message); }
  };

  const submitStaffForm = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const { id, ...staffPayload } = staffForm;
      const response = await request(`/api/tenant/${session.tenant_id}/staff${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST', body: JSON.stringify(staffPayload),
      });
      setNotice(id ? 'Staff access updated.' : 'Staff account created.');
      setStaffForm({ id: null, name: '', email: '', password: '', permissions: STAFF_PERMISSION_GROUPS.flatMap(({ view, manage }) => [view, ...(manage ? [manage] : [])]) });
      setStaffFormOpen(false);
      await loadStaff();
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  };

  const removeStaff = async (staffMember) => {
    if (!window.confirm(`Remove ${staffMember.name}'s clinic access?`)) return;
    try {
      await request(`/api/tenant/${session.tenant_id}/staff/${staffMember.id}`, { method: 'DELETE' });
      setNotice('Staff account removed.');
      await loadStaff();
    } catch (removeError) { setError(removeError.message); }
  };

  useEffect(() => {
    const tenantId = session?.tenant_id;
    if (page !== 'dashboard' || activeView !== 'overview' || !tenantId || session?.role === 'super_admin') return undefined;

    let disposed = false;
    let inFlight = false;
    const refreshOverview = async () => {
      if (disposed || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        await loadDashboard(tenantId, false, true, overviewActivityRange);
      } finally {
        inFlight = false;
      }
    };

    refreshOverview();
    const intervalId = window.setInterval(refreshOverview, 5000);
    document.addEventListener('visibilitychange', refreshOverview);
    window.addEventListener('focus', refreshOverview);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshOverview);
      window.removeEventListener('focus', refreshOverview);
    };
  }, [page, activeView, session?.tenant_id, session?.role, overviewActivityRange]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!notificationMenuRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

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
    const confirmed = await askForConfirmation({
      title: 'Activate inbound calling?',
      message: 'This creates an active inbound Sarvam deployment for the clinic number. Calls may incur Sarvam and Exotel charges.',
      confirmLabel: 'Activate calling',
      tone: 'primary',
    });
    if (!confirmed) return;
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
    setLastRefreshed(new Date());
  };

  const refreshWorkspace = async () => {
    if (!session) return;
    setRefreshing(true);
    setError('');
    try {
      if (session.role === 'super_admin') await loadAdminData();
      else await loadDashboard(session.tenant_id, true, false, overviewActivityRange);
      setNotice('Workspace data is up to date.');
    } catch (refreshError) {
      setError(refreshError.message || 'Could not refresh workspace data.');
    } finally {
      setRefreshing(false);
    }
  };

  const unreadBookingNotifications = bookings.filter((booking) => !seenBookingIds.includes(String(booking.id)));
  const notificationBookings = [...unreadBookingNotifications]
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
    .slice(0, 8);
  const unreadClinicInterests = clinicInterests.filter((lead) => !seenClinicInterestIds.includes(String(lead.id)));
  const notificationClinicInterests = [...unreadClinicInterests]
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
    .slice(0, 8);
  const markClinicInterestsRead = () => {
    const nextSeenIds = [...new Set([...seenClinicInterestIds, ...clinicInterests.map((lead) => String(lead.id))])];
    setSeenClinicInterestIds(nextSeenIds);
    try { localStorage.setItem('carestack-seen-clinic-interests', JSON.stringify(nextSeenIds)); } catch { /* Keep the in-memory state usable when storage is unavailable. */ }
  };
  const markBookingNotificationsRead = () => {
    const nextSeenBookingIds = [...new Set([...seenBookingIds, ...bookings.map((booking) => String(booking.id))])];
    setSeenBookingIds(nextSeenBookingIds);
    if (session?.tenant_id) {
      const storageKey = `carestack-seen-bookings-${session.tenant_id}`;
      try { localStorage.setItem(storageKey, JSON.stringify(nextSeenBookingIds)); } catch { /* Keep the in-memory state usable when storage is unavailable. */ }
    }
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
    setNotice('');
    setError('');
    const isChangingTenantPassword = Boolean(editingTenantId && (editingTenantPassword || editingTenantPasswordConfirm));
    if (isChangingTenantPassword && (!editingTenantPassword || !editingTenantPasswordConfirm)) {
      setError('Enter and confirm the new administrator password.');
      return;
    }
    if (isChangingTenantPassword && editingTenantPassword !== editingTenantPasswordConfirm) {
      setError('The administrator passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await request(editingTenantId ? `/api/tenants/${editingTenantId}` : '/api/tenants/onboard', {
        method: editingTenantId ? 'PUT' : 'POST',
        body: JSON.stringify(tenantForm),
      });
      if (isChangingTenantPassword) {
        await request(`/api/tenants/${editingTenantId}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password: editingTenantPassword }),
        });
      }
      setNotice(editingTenantId
        ? `${data.tenant.name} was updated${isChangingTenantPassword ? ' and its administrator password was changed' : ''}.`
        : `${data.tenant.tenant_name} is ready at ${getTenantPortalUrl(data.tenant.domain)}. A one-time password was emailed to ${data.tenant.admin_email}; it expires in 24 hours and must be changed at first sign-in.`);
      setTenantForm(emptyTenant);
      setEditingTenantPassword('');
      setEditingTenantPasswordConfirm('');
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
    setTenantManagementFormOpen(true);
    setPasswordTenantId(null);
    setTenantPassword('');
    setTenantPasswordConfirm('');
    setEditingTenantPassword('');
    setEditingTenantPasswordConfirm('');
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

  const openTenantPasswordForm = (tenant) => {
    setPasswordTenantId(tenant.id);
    setTenantPassword('');
    setTenantPasswordConfirm('');
    setError('');
    setNotice('');
    window.setTimeout(() => document.getElementById('tenant-password-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const handleTenantPasswordSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (tenantPassword !== tenantPasswordConfirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await request(`/api/tenants/${passwordTenantId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: tenantPassword }),
      });
      const tenant = tenants.find((item) => item.id === passwordTenantId);
      setNotice(`${tenant?.name || 'Tenant'} administrator password was updated. Share the new password with the administrator securely.`);
      setPasswordTenantId(null);
      setTenantPassword('');
      setTenantPasswordConfirm('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
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
    const confirmed = await askForConfirmation({
      title: 'Delete clinic workspace?',
      message: `Delete ${tenant.name} and its tenant workspace? This cannot be undone.`,
      confirmLabel: 'Delete clinic',
      tone: 'danger',
    });
    if (!confirmed) return;
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
      setPlanFormOpen(false);
      await loadAdminData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const editPlan = (plan) => {
    setEditingPlanId(plan.id);
    setPlanFormOpen(true);
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
    const confirmed = await askForConfirmation({
      title: 'Delete plan?',
      message: `Delete the ${plan.name} plan? Plans assigned to tenants cannot be deleted.`,
      confirmLabel: 'Delete plan',
      tone: 'danger',
    });
    if (!confirmed) return;
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
      setPatientFormOpen(false);
      await loadDashboard(session.tenant_id);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDoctorSubmit = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const path = `/api/tenant/${session.tenant_id}/doctors${editingDoctorId ? `/${editingDoctorId}` : ''}`;
      await request(path, {
        method: editingDoctorId ? 'PATCH' : 'POST',
        body: JSON.stringify(doctorForm),
      });
      setNotice(editingDoctorId ? 'Doctor details updated.' : 'Doctor added to the clinic roster.');
      setDoctorForm({ name: '', specialty: '' });
      setEditingDoctorId(null);
      await loadDashboard(session.tenant_id);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const editDoctor = (doctor) => {
    setDoctorForm({ name: doctor.name, specialty: doctor.specialty || '' });
    setEditingDoctorId(doctor.id);
    setNotice('');
    setError('');
  };

  const toggleDoctorStatus = async (doctor) => {
    if (!session?.tenant_id) return;
    setError('');
    setNotice('');
    try {
      await request(`/api/tenant/${session.tenant_id}/doctors/${doctor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: doctor.status === 'active' ? 'inactive' : 'active' }),
      });
      setNotice(doctor.status === 'active' ? 'Doctor deactivated; new calls will no longer offer them.' : 'Doctor reactivated for calls and booking.');
      await loadDashboard(session.tenant_id);
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  const editPatient = (patient) => {
    setPatientForm({ ...emptyPatient, ...patient, age: patient.age || '' });
    setEditingPatientId(patient.id);
    setPatientFormOpen(true);
    setNotice('');
    window.setTimeout(() => document.getElementById('patient-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const deletePatient = async (patientId) => {
    if (!session?.tenant_id) return;
    const confirmed = await askForConfirmation({
      title: 'Delete patient record?',
      message: 'This removes the patient record from this clinic workspace.',
      confirmLabel: 'Delete patient',
      tone: 'danger',
    });
    if (!confirmed) return;
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
      const isClinicAdmin = session.role === 'tenant_admin';
      const result = isClinicAdmin
        ? await request('/api/agent/booking', { method: 'POST', body: JSON.stringify({ ...bookingForm, tenant_id: session.tenant_id }) })
        : await request(`/api/tenant/${session.tenant_id}/appointments`, { method: 'POST', body: JSON.stringify(bookingForm) });
      setNotice(isClinicAdmin ? `Appointment ${result.appointment.id} confirmed by Python booking agents.` : `Appointment ${result.appointment.id} booked.`);
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
    if (status === 'cancelled') {
      const appointment = bookings.find((booking) => String(booking.id) === String(appointmentId));
      const confirmed = await askForConfirmation({
        title: 'Cancel this appointment?',
        message: appointment
          ? `${appointment.patient_name} · ${appointment.appointment_date} at ${appointment.appointment_time}. The appointment will stay in the register with Cancelled status.`
          : 'The appointment will stay in the register with Cancelled status.',
        confirmLabel: 'Cancel appointment',
        tone: 'danger',
      });
      if (!confirmed) {
        await loadDashboard(session.tenant_id);
        return;
      }
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

  const openProfileDialog = async () => {
    if (profileBusy || profileLoading) return;
    setProfileForm({ name: session?.name || '', email: session?.email || '', phone: session?.phone || '', employee_id: session?.employee_id || '', avatar_data_url: session?.avatar_data_url || '' });
    setProfileCurrentPassword('');
    setProfileNewPassword('');
    setProfilePasswordConfirm('');
    setProfilePasswordOpen(false);
    setProfilePasswordResetOpen(false);
    setProfilePasswordResetCode('');
    setProfileNotice('');
    setProfileError('');
    setProfileDialogOpen(true);
    setNotificationsOpen(false);
    setProfileLoading(true);
    try {
      const result = await request('/api/auth/profile');
      const updatedSession = { ...session, ...result.user };
      localStorage.setItem('carestack-session', JSON.stringify(updatedSession));
      setSession(updatedSession);
      setProfileForm({ name: updatedSession.name || '', email: updatedSession.email || '', phone: updatedSession.phone || '', employee_id: updatedSession.employee_id || '', avatar_data_url: updatedSession.avatar_data_url || '' });
    } catch (loadError) {
      setProfileError(loadError.message || 'Your profile could not be loaded.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfilePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setProfileError('Choose a PNG, JPG, or WebP image.');
      setProfileNotice('');
      event.target.value = '';
      return;
    }
    if (file.size > 512 * 1024) {
      setProfileError('Choose an image smaller than 500 KB.');
      setProfileNotice('');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((current) => ({ ...current, avatar_data_url: String(reader.result || '') }));
      setProfileError('');
      setProfileNotice('');
    };
    reader.onerror = () => { setProfileError('The selected image could not be opened.'); setProfileNotice(''); };
    reader.readAsDataURL(file);
  };

  const saveOwnProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    setProfileBusy(true);
    try {
      const result = await request('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileForm.name.trim(),
          email: profileForm.email.trim().toLowerCase(),
          phone: profileForm.phone.trim() || null,
          avatar_data_url: profileForm.avatar_data_url || null,
        }),
      });
      const updatedSession = { ...session, ...result.user };
      localStorage.setItem('carestack-session', JSON.stringify(updatedSession));
      setSession(updatedSession);
      setProfileForm({ name: updatedSession.name, email: updatedSession.email, phone: updatedSession.phone || '', employee_id: updatedSession.employee_id || '', avatar_data_url: updatedSession.avatar_data_url || '' });
      setProfileNotice(result.message || 'Profile updated successfully.');
    } catch (saveError) {
      setProfileError(saveError.message || 'Your profile could not be saved.');
    } finally {
      setProfileBusy(false);
    }
  };

  const changeOwnProfilePassword = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    if (profileNewPassword !== profilePasswordConfirm) {
      setProfileError('The new passwords do not match.');
      return;
    }
    setProfileBusy(true);
    try {
      const result = await request('/api/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ current_password: profileCurrentPassword, password: profileNewPassword }),
      });
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfilePasswordConfirm('');
      setProfilePasswordResetCode('');
      setProfilePasswordResetOpen(false);
      setProfileNotice(result.message || 'Password updated successfully.');
    } catch (passwordError) {
      setProfileError(passwordError.message || 'Your password could not be updated.');
    } finally {
      setProfileBusy(false);
    }
  };

  const requestProfilePasswordReset = async () => {
    setProfileError('');
    setProfileNotice('');
    if (!session?.email) {
      setProfileError('Your account email is unavailable. Sign in again and retry.');
      return;
    }
    setProfileBusy(true);
    try {
      const result = await request('/api/auth/password-reset/request', {
        method: 'POST', body: JSON.stringify({ email: session.email }),
      });
      setProfilePasswordResetCode('');
      setProfilePasswordResetOpen(true);
      setProfileNotice(result.message || 'If an account matches that email, a reset code has been sent.');
    } catch (resetError) {
      setProfileError(resetError.message || 'A password reset code could not be sent.');
    } finally {
      setProfileBusy(false);
    }
  };

  const confirmProfilePasswordReset = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileNotice('');
    if (!session?.email) {
      setProfileError('Your account email is unavailable. Sign in again and retry.');
      return;
    }
    if (profileNewPassword !== profilePasswordConfirm) {
      setProfileError('The new passwords do not match.');
      return;
    }
    setProfileBusy(true);
    try {
      const result = await request('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ email: session.email, code: profilePasswordResetCode, password: profileNewPassword }),
      });
      setProfilePasswordResetCode('');
      setProfileNewPassword('');
      setProfilePasswordConfirm('');
      setProfilePasswordResetOpen(false);
      setProfileNotice(result.message || 'Password updated successfully.');
    } catch (resetError) {
      setProfileError(resetError.message || 'The password reset code could not be verified.');
    } finally {
      setProfileBusy(false);
    }
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
  const marketedPlanPagination = useListPagination(marketedPlans, `marketed-plans:${page}`);
  const maxPlanCount = Math.max(1, ...planBreakdown.map((item) => item.count));
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount || 0);
  const maxScheduleCount = Math.max(1, ...analytics.schedule.map((day) => day.count));
  const maxActivityCount = Math.max(1, ...analytics.activity.map((day) => Math.max(day.patients, day.bookings)));
  const maxStatusCount = Math.max(1, ...analytics.status_breakdown.map((item) => item.count));
  const maxDoctorCount = Math.max(1, ...analytics.doctor_workload.map((item) => item.count));
  const clinicToday = new Intl.DateTimeFormat('en-CA', { timeZone: voiceAgent.timezone || 'Asia/Kolkata' }).format(new Date());
  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = appointmentStatusFilter === 'all' || booking.status === appointmentStatusFilter;
    const query = appointmentQuery.trim().toLowerCase();
    const matchesQuery = !query || [booking.id, booking.patient_name, booking.phone_number, booking.doctor_name]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const matchesDate = appointmentDateFilter === 'all'
      || (appointmentDateFilter === 'today' && booking.appointment_date === clinicToday)
      || (appointmentDateFilter === 'upcoming' && booking.appointment_date >= clinicToday && !['cancelled', 'no_show'].includes(booking.status));
    return matchesStatus && matchesQuery && matchesDate;
  });
  const filteredPatients = patients.filter((patient) => {
    const query = patientQuery.trim().toLowerCase();
    const matchesQuery = !query || [patient.id, patient.name, patient.phone, patient.email]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (patientStatusFilter === 'all' || patient.status === patientStatusFilter);
  });
  const displayedPatients = activeView === 'patients' ? filteredPatients : patients.slice(0, 8);
  const clinicInterestPagination = useListPagination(clinicInterests, `leads:${activeView}`);
  const tenantPagination = useListPagination(tenants, `tenants:${activeView}`);
  const subscriptionTenantPagination = useListPagination(tenants, `subscriptions:${activeView}`);
  const planPagination = useListPagination(plans, `plans:${activeView}`);
  const staffPagination = useListPagination(staff, `staff:${activeView}:${session?.tenant_id || ''}`);
  const doctorPagination = useListPagination(tenantData?.doctors || [], `doctors:${activeView}:${session?.tenant_id || ''}`);
  const appointmentPagination = useListPagination(filteredBookings, `appointments:${activeView}:${appointmentQuery}:${appointmentStatusFilter}:${appointmentDateFilter}`);
  const patientPagination = useListPagination(filteredPatients, `patients:${activeView}:${patientQuery}:${patientStatusFilter}`);
  const doctorWorkloadPagination = useListPagination(analytics.doctor_workload, `doctor-workload:${activeView}`);
  const planBreakdownPagination = useListPagination(planBreakdown, `plan-breakdown:${activeView}`);
  const clinicDoctors = [...new Set([...(tenantData?.doctors || []).filter((doctor) => doctor.status === 'active').map((doctor) => doctor.name), bookingForm.doctor_name].filter(Boolean))];
  const upcomingBookings = bookings.filter((booking) => {
    const today = new Date().toISOString().slice(0, 10);
    return booking.appointment_date >= today && !['cancelled', 'no_show'].includes(booking.status);
  }).sort((left, right) => `${left.appointment_date} ${left.appointment_time}`.localeCompare(`${right.appointment_date} ${right.appointment_time}`)).slice(0, 5);
  const activityRangeLabel = overviewActivityRange === 'today' ? 'today' : overviewActivityRange === '30d' ? 'last 30 days' : 'last 7 days';
  const previousActivityRangeLabel = overviewActivityRange === 'today' ? 'previous day' : overviewActivityRange === '30d' ? 'previous 30 days' : 'previous 7 days';
  const activityComparison = (current = 0, previous = 0) => previous === 0
    ? `${current} ${activityRangeLabel} · no prior baseline`
    : `${current - previous > 0 ? '+' : ''}${current - previous} vs ${previousActivityRangeLabel}`;

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
          <div className="admin-panel-heading tenant-growth-heading"><div><h3>Clinic growth activity</h3><p>Patient records and appointment bookings created each day · {activityRangeLabel}</p></div><div className="tenant-growth-tools"><label className="overview-range-filter" title="Filter clinic growth activity by date range">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>
            <span className="visually-hidden">Filter overview activity</span>
            <select aria-label="Filter clinic growth activity" value={overviewActivityRange} onChange={(event) => setOverviewActivityRange(event.target.value)}>
              <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            </select>
          </label><div className="growth-legend"><span><i className="growth-swatch patient-swatch" />New patients</span><span><i className="growth-swatch booking-swatch" />Bookings</span></div></div></div>
          <div className="growth-chart-scroll"><div className="growth-chart" style={{ gridTemplateColumns: `repeat(${analytics.activity.length || 7}, minmax(0, 1fr))`, minWidth: analytics.activity.length > 7 ? `${analytics.activity.length * 28}px` : undefined }} role="img" aria-label={`Daily patient registrations compared with appointment bookings for ${activityRangeLabel}`}>
            {analytics.activity.map((day) => <div className="growth-day" key={day.date} title={`${day.date}: ${day.patients} new patients, ${day.bookings} bookings`}>
              <strong>{day.patients + day.bookings}</strong><div className="growth-track"><span className="growth-bar patient-growth" style={{ height: `${day.patients ? Math.max(7, (day.patients / maxActivityCount) * 100) : 0}%` }} /><span className="growth-bar booking-growth" style={{ height: `${day.bookings ? Math.max(7, (day.bookings / maxActivityCount) * 100) : 0}%` }} /></div><small>{day.label}</small>
            </div>)}
          </div></div>
          <div className="growth-comparison"><span>Patient registrations <strong>{analytics.summary.patient_activity?.current ?? 0}</strong> {activityRangeLabel} <span className="comparison-divider">vs</span> <strong>{analytics.summary.patient_activity?.previous ?? 0}</strong> {previousActivityRangeLabel}</span><span>Bookings created <strong>{analytics.summary.booking_activity?.current ?? 0}</strong> {activityRangeLabel} <span className="comparison-divider">vs</span> <strong>{analytics.summary.booking_activity?.previous ?? 0}</strong> {previousActivityRangeLabel}</span></div>
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
            {planBreakdownPagination.items.map((item, index) => <div className="admin-bar-row" key={item.id}>
              <span className="admin-bar-label">{item.name}</span>
              <div className="admin-bar-track"><span className={`admin-bar-fill tone-${index}`} style={{ width: `${Math.max(0, (item.count / maxPlanCount) * 100)}%` }} /></div>
              <strong>{item.count}</strong>
            </div>)}
          </div>
          <ListPagination pagination={planBreakdownPagination} label="plans" />
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
        {planPagination.items.map((plan, index) => <div className="col-md-4" key={plan.id}><section className={`plan-panel plan-tone-${index}`}>
          <div className="d-flex justify-content-between align-items-start"><div><small>CARE PLAN</small><h3>{plan.name}</h3></div><span className="plan-count">{tenants.filter((tenant) => tenant.plan === plan.id).length} tenants</span></div>
          <p className="plan-price">{formatCurrency(plan.monthly_price)}<span> / month</span></p>
          <p className="plan-annual">{formatCurrency(plan.annual_price)} billed annually</p>
          <div className="plan-limits">{plan.clinic_limit || 'Unlimited'} clinics <span>·</span> {plan.user_limit || 'Unlimited'} users</div>
          <div className="d-flex gap-2 mt-3"><button className="btn btn-sm btn-outline-primary" onClick={() => editPlan(plan)}>Edit plan</button><button className="btn btn-sm btn-outline-danger" onClick={() => removePlan(plan)}>Delete plan</button></div>
        </section></div>)}
      </div>
      <ListPagination pagination={planPagination} label="plans" />
      <section className="admin-panel mb-4" id="plan-management-form">
        <button type="button" className={`workspace-section-toggle ${planFormOpen ? 'is-open' : ''}`} aria-expanded={planFormOpen} aria-controls="plan-management-fields" onClick={() => setPlanFormOpen((open) => !open)}>
          <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">{editingPlanId ? 'Edit plan' : 'Create a plan'}</span><span className="workspace-section-toggle-description">Set plan rates and included workspace limits. Leave a limit blank for unlimited.</span></span>
          <span className="workspace-section-toggle-action">{planFormOpen ? 'Collapse −' : 'Expand +'}</span>
        </button>
        <div id="plan-management-fields" className="mt-3" hidden={!planFormOpen}>
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
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>Subscription register</h3><p>Plan and billing changes apply immediately.</p></div></div>
        <div className="table-responsive"><table className="table align-middle mb-0">
          <thead><tr><th>Clinic</th><th>Plan</th><th>Billing</th><th>Monthly value</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{subscriptionTenantPagination.items.map((tenant) => <tr key={tenant.id}>
            <td><div className="fw-semibold">{tenant.name}</div><small><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></small></td>
            <td><select className="form-select form-select-sm plan-select" aria-label={`Plan for ${tenant.name}`} value={tenant.plan} onChange={(event) => updateSubscription(tenant.id, { plan: event.target.value })}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></td>
            <td><select className="form-select form-select-sm cycle-select" aria-label={`Billing cycle for ${tenant.name}`} value={tenant.billing_cycle} onChange={(event) => updateSubscription(tenant.id, { billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></td>
            <td>{formatCurrency(tenant.monthly_price)}<small className="d-block text-muted">per month equivalent</small></td>
            <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
            <td><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : 'Activate'}</button></td>
          </tr>)}{tenants.length === 0 && <tr><td colSpan="6" className="text-muted py-4">No subscriptions to manage.</td></tr>}</tbody>
        </table></div>
        <ListPagination pagination={subscriptionTenantPagination} label="clinics" />
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
          <div className="subscription-cards">{marketedPlanPagination.items.map((plan) => <article className={`subscription-card ${plan.id === 'growth' ? 'subscription-card-featured' : ''}`} key={plan.id}>
            {plan.id === 'growth' && <span className="subscription-popular">MOST POPULAR</span>}
            <p className="section-kicker">{plan.name.toUpperCase()}</p><h3>{formatCurrency(plan.monthly_price)}<small> / month</small></h3><p className="subscription-yearly">{formatCurrency(plan.annual_price)} billed annually</p>
            <ul><li>{plan.clinic_limit || 'Unlimited'} {plan.clinic_limit === 1 ? 'clinic' : 'clinics'}</li><li>{plan.user_limit || 'Unlimited'} team members</li><li>Patient and appointment workspace</li><li>Agent workflow and clinic-hour controls</li><li>Reports and appointment exports</li></ul>
            <button className={plan.id === 'growth' ? 'button-dark' : 'button-outline'} onClick={() => { setClinicInterestForm({ ...emptyClinicInterest, plan: plan.id }); document.getElementById('clinic-request')?.scrollIntoView({ behavior: 'smooth' }); }}>Request {plan.name} <span aria-hidden="true">→</span></button>
          </article>)}</div>
          <ListPagination pagination={marketedPlanPagination} label="plans" />
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
          <div className="login-brand"><img src={carestackMark} alt="CareStack" /></div>
          <h2 id="login-heading">{loginMode === 'login' ? 'Welcome back.' : loginMode === 'forgot' ? 'Reset your password.' : loginMode === 'reset' ? 'Choose a new password.' : 'Secure your account.'}</h2>
          <p className="login-subtitle">{loginMode === 'login' ? 'Choose your workspace to continue.' : loginMode === 'forgot' ? 'We’ll email a short reset code if this account exists.' : loginMode === 'reset' ? 'Enter the code sent to your account email.' : 'Your one-time password has been used. Set a new password to continue.'}</p>
          {loginMode === 'login' && <>
            <div className="login-role-switch" role="tablist" aria-label="Choose sign-in type"><button role="tab" aria-selected={loginRole === 'tenant'} className={loginRole === 'tenant' ? 'selected' : ''} onClick={() => openLogin('tenant')}>Clinic admin or staff</button><button role="tab" aria-selected={loginRole === 'super_admin'} className={loginRole === 'super_admin' ? 'selected' : ''} onClick={() => openLogin('super_admin')}>Platform admin</button></div>
            <div className="login-clinic-label"><span>{loginRole === 'tenant' ? 'CLINIC WORKSPACE' : 'PLATFORM CONTROL'}</span><strong>{loginRole === 'tenant' ? tenantBrand.name : 'CareStack platform'}</strong>{loginRole === 'tenant' && <small>{tenantBrand.domain}</small>}</div>
            <form onSubmit={handleLogin}>
              <label htmlFor="site-login-email">Work email</label><input id="site-login-email" type="email" autoComplete="username" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
              <label htmlFor="site-login-password">Password or one-time password</label><input id="site-login-password" type="password" autoComplete="current-password" required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
              {error && <div className="login-error" role="alert">{error}</div>}
              {loginStatus && <div className="login-success" role="status">{loginStatus}</div>}
              <button className="button-dark login-submit" disabled={busy}>{busy ? 'Signing in…' : loginRole === 'tenant' ? 'Open clinic workspace' : 'Open platform console'} <span aria-hidden="true">→</span></button>
            </form>
            <button type="button" className="login-text-button" onClick={() => { setLoginMode('forgot'); setError(''); setLoginStatus(''); }}>Forgot password?</button>
          </>}
          {loginMode === 'forgot' && <form onSubmit={submitPasswordResetRequest}>
            <label htmlFor="reset-email">Account email</label><input id="reset-email" type="email" autoComplete="email" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} />
            {error && <div className="login-error" role="alert">{error}</div>}{loginStatus && <div className="login-success" role="status">{loginStatus}</div>}
            <button className="button-dark login-submit" disabled={busy}>{busy ? 'Sending code…' : 'Email reset code'} <span aria-hidden="true">→</span></button>
            <button type="button" className="login-text-button" onClick={() => { setLoginMode('login'); setError(''); setLoginStatus(''); }}>Back to sign in</button>
          </form>}
          {loginMode === 'reset' && <form onSubmit={submitPasswordReset}>
            {loginStatus && <div className="login-success" role="status">{loginStatus}</div>}
            <label htmlFor="reset-code">6-digit reset code</label><input id="reset-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            <label htmlFor="reset-new-password">New password</label><input id="reset-new-password" type="password" autoComplete="new-password" minLength="10" maxLength="72" required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <label htmlFor="reset-confirm-password">Confirm new password</label><input id="reset-confirm-password" type="password" autoComplete="new-password" minLength="10" maxLength="72" required value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} />
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="button-dark login-submit" disabled={busy}>{busy ? 'Updating password…' : 'Reset password'} <span aria-hidden="true">→</span></button>
            <button type="button" className="login-text-button" onClick={() => { setLoginMode('forgot'); setError(''); }}>Request another code</button>
          </form>}
          {loginMode === 'initial-password' && <form onSubmit={submitFirstPassword}>
            <label htmlFor="first-new-password">New password</label><input id="first-new-password" type="password" autoComplete="new-password" minLength="10" maxLength="72" required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <label htmlFor="first-confirm-password">Confirm new password</label><input id="first-confirm-password" type="password" autoComplete="new-password" minLength="10" maxLength="72" required value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} />
            {loginStatus && <div className="login-success" role="status">{loginStatus}</div>}{error && <div className="login-error" role="alert">{error}</div>}
            <button className="button-dark login-submit" disabled={busy}>{busy ? 'Securing account…' : 'Set password and continue'} <span aria-hidden="true">→</span></button>
          </form>}
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
                  <img className="auth-logo" src={carestackMark} alt="CareStack" />
                  <h2 className="fw-bold mt-3">{tenantBrand.name}</h2>
                  <p className="text-muted mb-0">Tenant admin / super admin access · {tenantBrand.hostname}</p>
                </div>

                {loginMode === 'login' && <form onSubmit={handleLogin}>
                  <div className="mb-3"><label className="form-label">Email</label><input type="email" className="form-control form-control-lg" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} /></div>
                  <div className="mb-3"><label className="form-label">Password or one-time password</label><input type="password" className="form-control form-control-lg" required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></div>
                  {error && <div className="alert alert-danger">{error}</div>}{loginStatus && <div className="login-success" role="status">{loginStatus}</div>}
                  <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
                  <button type="button" className="login-text-button" onClick={() => { setLoginMode('forgot'); setError(''); setLoginStatus(''); }}>Forgot password?</button>
                </form>}
                {loginMode === 'forgot' && <form onSubmit={submitPasswordResetRequest}>
                  <div className="mb-3"><label className="form-label">Account email</label><input type="email" className="form-control form-control-lg" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} /></div>
                  {error && <div className="alert alert-danger">{error}</div>}{loginStatus && <div className="login-success" role="status">{loginStatus}</div>}
                  <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Sending code…' : 'Email reset code'}</button><button type="button" className="login-text-button" onClick={() => setLoginMode('login')}>Back to sign in</button>
                </form>}
                {loginMode === 'reset' && <form onSubmit={submitPasswordReset}>
                  {loginStatus && <div className="login-success mb-3" role="status">{loginStatus}</div>}
                  <div className="mb-3"><label className="form-label">6-digit reset code</label><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required className="form-control form-control-lg" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
                  <div className="mb-3"><label className="form-label">New password</label><input type="password" autoComplete="new-password" minLength="10" maxLength="72" required className="form-control form-control-lg" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></div>
                  <div className="mb-3"><label className="form-label">Confirm new password</label><input type="password" autoComplete="new-password" minLength="10" maxLength="72" required className="form-control form-control-lg" value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} /></div>
                  {error && <div className="alert alert-danger">{error}</div>}
                  <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Updating password…' : 'Reset password'}</button><button type="button" className="login-text-button" onClick={() => setLoginMode('forgot')}>Request another code</button>
                </form>}
                {loginMode === 'initial-password' && <form onSubmit={submitFirstPassword}>
                  <p className="text-muted">Your one-time password was accepted. Set a new password to continue.</p>
                  <div className="mb-3"><label className="form-label">New password</label><input type="password" autoComplete="new-password" minLength="10" maxLength="72" required className="form-control form-control-lg" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></div>
                  <div className="mb-3"><label className="form-label">Confirm new password</label><input type="password" autoComplete="new-password" minLength="10" maxLength="72" required className="form-control form-control-lg" value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} /></div>
                  {error && <div className="alert alert-danger">{error}</div>}
                  <button type="submit" className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Securing account…' : 'Set password and continue'}</button>
                </form>}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (!session) return null;
    const clinicAdmin = session.role === 'tenant_admin';
    const grantedPermissions = new Set(session.permissions || []);
    const canManage = (module) => clinicAdmin || grantedPermissions.has(`${module}:manage`);
    const workspaceNavigation = superAdmin
      ? [['overview', 'Overview', '⌂'], ['leads', 'Clinic requests', '✳'], ['tenants', 'Tenants', '▦'], ['subscriptions', 'Plans & subscriptions', '◈']]
      : [
        ['overview', 'Overview', '⌂', 'overview:view'], ['agents', 'AI receptionist', '◉', 'agents:view'],
        ['doctors', 'Doctors', '✚', 'doctors:view', 'doctors:manage'], ['patients', 'Patients', '♙', 'patients:view', 'patients:manage'],
        ['appointments', 'Appointments', '▣', 'appointments:view', 'appointments:manage'], ['reports', 'Reports', '▥', 'reports:view'],
      ].filter(([, , , viewPermission, managePermission]) => clinicAdmin || grantedPermissions.has(viewPermission) || (managePermission && grantedPermissions.has(managePermission)))
        .map(([view, label, icon]) => [view, label, icon])
        .concat(clinicAdmin ? [['staff', 'Staff access', '♧']] : []);
    const pageTitle = superAdmin
      ? activeView === 'overview' ? 'Platform overview' : activeView === 'subscriptions' ? 'Plans & subscriptions' : activeView === 'leads' ? 'Clinic requests' : 'Tenant management'
      : activeView === 'overview' ? 'Good to see you' : activeView === 'reports' ? 'Clinic reports' : activeView === 'agents' ? 'AI receptionist' : activeView === 'doctors' ? 'Doctor directory' : activeView === 'patients' ? 'Patient directory' : activeView === 'staff' ? 'Staff access' : 'Appointments';
    const workspacePlan = String(tenantData?.plan || '').replace(/\b\w/g, (char) => char.toUpperCase());
    const workspaceRegion = String(tenantData?.region || '').trim();
    const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: voiceAgent.timezone || 'Asia/Kolkata' }).format(new Date());

    return (
      <div className={`page-shell dashboard-shell ${superAdmin ? 'admin-workspace' : 'clinic-workspace'}`}>
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <a className="workspace-brand" href="#workspace-home" aria-label={`${superAdmin ? 'CareStack' : tenantBrand.shortName} workspace home`}><span className="workspace-brand-mark">{superAdmin ? 'C' : tenantBrand.shortName.charAt(0).toUpperCase()}</span><span>{superAdmin ? 'CareStack' : tenantBrand.shortName}<small>{superAdmin ? 'PLATFORM WORKSPACE' : 'CLINIC WORKSPACE'}</small></span></a>
            <div className="sidebar-clinic-card"><span className="clinic-avatar">{superAdmin ? 'C' : tenantBrand.shortName.charAt(0)}</span><span><strong title={superAdmin ? 'CareStack platform' : displayedTenant}>{superAdmin ? 'CareStack platform' : displayedTenant}</strong><small>{superAdmin ? 'Super admin workspace' : workspacePlan ? `${workspacePlan} plan${workspaceRegion ? ` · ${workspaceRegion}` : ''}` : `${workspaceRegion || 'Clinic'} workspace`}</small></span><i aria-hidden="true">⌄</i></div>
            <p className="sidebar-section-label">WORKSPACE</p>
            <nav className="workspace-nav" aria-label="Workspace navigation">
              {workspaceNavigation.map(([view, label, icon]) => (
                <button key={view} className={`workspace-nav-link ${activeView === view ? 'active' : ''}`} aria-current={activeView === view ? 'page' : undefined} onClick={() => { setActiveView(view); setError(''); setNotice(''); if (view === 'staff') loadStaff(); }}>
                  <span className="workspace-nav-icon" aria-hidden="true">{icon}</span><span className="workspace-nav-label">{label}</span>
                  {!superAdmin && view === 'appointments' && upcomingBookings.length > 0 && <span className="workspace-nav-count">{upcomingBookings.length}</span>}
                </button>
              ))}
            </nav>
            <div className="sidebar-spacer" />
            <div className="sidebar-help-card"><span className="help-orb">✦</span><strong>{superAdmin ? 'Platform controls' : 'Need a hand?'}</strong><small>{superAdmin ? 'Manage clinics, requests, and subscription plans.' : 'Your clinic workspace is ready for today.'}</small><button onClick={() => { setActiveView(superAdmin ? 'tenants' : 'agents'); }}>{superAdmin ? 'Manage clinics' : 'Explore workspace'} <span>→</span></button></div>
          </aside>

          <main className="workspace-main">
            <header className="workspace-topbar">
              <div className="workspace-location"><span className="location-dot" />{superAdmin ? 'CareStack platform' : displayedTenant}<span className="location-divider">/</span><span>{workspaceNavigation.find(([view]) => view === activeView)?.[1]}</span></div>
              <div className="workspace-top-actions">
                {!superAdmin && <span className="tenant-live-badge"><span />Clinic active</span>}
                <div className="workspace-notification-wrap" ref={notificationMenuRef}>
                  <button className={`workspace-icon-button workspace-notification-trigger ${notificationsOpen ? 'open' : ''}`} onClick={() => setNotificationsOpen((open) => !open)} aria-label={`Notifications, ${superAdmin ? unreadClinicInterests.length : unreadBookingNotifications.length} unread`} aria-expanded={notificationsOpen} aria-haspopup="dialog" title={superAdmin ? 'Clinic request notifications' : 'Booking notifications'}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                    {(superAdmin ? unreadClinicInterests.length : unreadBookingNotifications.length) > 0 && <span className="workspace-notification-count">{(superAdmin ? unreadClinicInterests.length : unreadBookingNotifications.length) > 99 ? '99+' : superAdmin ? unreadClinicInterests.length : unreadBookingNotifications.length}</span>}
                  </button>
                  {notificationsOpen && (superAdmin ? <section className="workspace-notification-popover" role="dialog" aria-label="Clinic request notifications">
                    <div className="notification-popover-heading"><div><strong>Notifications</strong><small>{unreadClinicInterests.length ? `${unreadClinicInterests.length} new clinic request${unreadClinicInterests.length === 1 ? '' : 's'}` : 'You’re all caught up'}</small></div><button type="button" onClick={markClinicInterestsRead} disabled={!unreadClinicInterests.length}>Mark all read</button></div>
                    {notificationClinicInterests.length ? <div className="notification-list">{notificationClinicInterests.map((lead) => <button className="notification-item" key={lead.id} onClick={() => { markClinicInterestsRead(); setNotificationsOpen(false); setActiveView('leads'); }}>
                      <span className="notification-unread-dot" aria-hidden="true" />
                      <span className="notification-item-copy"><strong>{lead.clinic_name || 'New clinic request'}</strong><small>{lead.contact_name || lead.email || 'Contact details submitted'} · {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : 'Recently received'}</small></span>
                      <span className="notification-item-arrow" aria-hidden="true">→</span>
                    </button>)}</div> : <div className="notification-empty"><span aria-hidden="true">✓</span><strong>No new clinic requests</strong><small>New clinic requests will appear here.</small></div>}
                    <button type="button" className="notification-view-all" onClick={() => { markClinicInterestsRead(); setNotificationsOpen(false); setActiveView('leads'); }}>View clinic requests <span aria-hidden="true">→</span></button>
                  </section> : <section className="workspace-notification-popover" role="dialog" aria-label="Booking notifications">
                    <div className="notification-popover-heading"><div><strong>Notifications</strong><small>{unreadBookingNotifications.length ? `${unreadBookingNotifications.length} new booking${unreadBookingNotifications.length === 1 ? '' : 's'}` : 'You’re all caught up'}</small></div><button type="button" onClick={markBookingNotificationsRead} disabled={!unreadBookingNotifications.length}>Mark all read</button></div>
                    {notificationBookings.length ? <div className="notification-list">{notificationBookings.map((booking) => <button className="notification-item" key={booking.id} onClick={() => { markBookingNotificationsRead(); setNotificationsOpen(false); setActiveView('appointments'); }}>
                      <span className="notification-unread-dot" aria-hidden="true" />
                      <span className="notification-item-copy"><strong>{booking.patient_name || 'New patient booking'}</strong><small>{booking.doctor_name || 'Clinic appointment'} · {booking.appointment_date ? new Date(`${booking.appointment_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : 'Date not set'}{booking.appointment_time ? ` at ${booking.appointment_time}` : ''}</small></span>
                      <span className="notification-item-arrow" aria-hidden="true">→</span>
                    </button>)}</div> : <div className="notification-empty"><span aria-hidden="true">✓</span><strong>No new bookings</strong><small>New appointment bookings will appear here.</small></div>}
                    <button type="button" className="notification-view-all" onClick={() => { markBookingNotificationsRead(); setNotificationsOpen(false); setActiveView('appointments'); }}>View appointments <span aria-hidden="true">→</span></button>
                  </section>)}
                </div>
                <button className="workspace-refresh" onClick={refreshWorkspace} disabled={refreshing} title={lastRefreshed ? `Last refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh workspace'}><span className={refreshing ? 'refresh-spinning' : ''} aria-hidden="true">↻</span><span className="workspace-refresh-label">{refreshing ? 'Updating' : 'Refresh'}</span></button>
                {!superAdmin && clinicAdmin && <button className="btn btn-primary workspace-new-booking" onClick={() => { setActiveView('appointments'); setBookingFormOpen(true); window.setTimeout(() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>＋ <span>New appointment</span></button>}
              {superAdmin && activeView === 'tenants' && <button className="btn btn-primary" onClick={() => { setTenantManagementFormOpen(true); document.getElementById('tenant-management-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>＋ Add clinic</button>}
                <div className="workspace-user-actions">
                  {['tenant_admin', 'super_admin'].includes(session.role) ? <button type="button" className="workspace-user-profile is-editable" onClick={openProfileDialog} aria-label="Open profile settings" title="Profile settings">
                    {session.avatar_data_url ? <img className="profile-avatar profile-avatar-image" src={session.avatar_data_url} alt="" /> : <span className="profile-avatar">{String(session.name || session.email || 'U').charAt(0).toUpperCase()}</span>}
                    <span className="profile-copy"><strong>{session.name || (superAdmin ? 'Platform admin' : 'Clinic admin')}</strong><small>{session.email}</small></span>
                  </button> : <div className="workspace-user-profile">
                    <span className="profile-avatar">{String(session.name || session.email || 'U').charAt(0).toUpperCase()}</span>
                    <span className="profile-copy"><strong>{session.name || 'Receptionist'}</strong><small>{session.email}</small></span>
                  </div>}
                  <button className="profile-logout" onClick={logout} aria-label="Log out" title="Log out"><span aria-hidden="true">↗</span><span>Logout</span></button>
                </div>
              </div>
            </header>

            <div className="workspace-content">
              <div className="workspace-page-heading">
                <div><p className="workspace-date">{todayLabel}</p><h1>{pageTitle}{!superAdmin && activeView === 'overview' ? `, ${String(session.name || 'team').split(' ')[0]}` : ''}<span className="heading-period">.</span></h1><p>{superAdmin ? 'A clear view of your clinic network and operations.' : activeView === 'overview' ? 'Here’s what’s happening across your clinic today.' : activeView === 'appointments' ? 'Manage the day, keep visits moving, and stay on top of follow-ups.' : activeView === 'patients' ? 'Search and manage your clinic’s patient records.' : activeView === 'doctors' ? 'Manage the clinic roster used by availability checks and the voice agent.' : activeView === 'agents' ? 'Tune the information and voice experience your patients receive.' : 'Track clinic activity and export the records your team needs.'}</p></div>
              </div>

              {(notice || error) && <div className={`alert ${error ? 'alert-danger' : 'alert-success'} alert-dismissible`} role="status">
                {error || notice}
                <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => { setError(''); setNotice(''); }} />
              </div>}

              {!superAdmin && activeView === 'overview' && renderTenantOverview()}

              {!superAdmin && activeView === 'agents' && (clinicAdmin ? <div className="row g-4">
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
                    <div className="col-md-6"><label className="form-label" htmlFor="agent-doctors">Doctors and specialties (one per line)</label><textarea id="agent-doctors" className="form-control" rows="4" readOnly value={(tenantData?.doctors || []).filter((doctor) => doctor.status === 'active').map((doctor) => doctor.specialty ? `${doctor.name} — ${doctor.specialty}` : doctor.name).join('\n')} placeholder="Add doctors in the Doctors section" /><small className="text-muted">This read-only list syncs from the clinic database doctor roster.</small><button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={() => setActiveView('doctors')}>Manage clinic doctors</button></div>
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
              </div> : <div className="row g-4">
                <div className="col-12"><section className="tenant-insight-panel"><div className="admin-panel-heading"><div><h3>AI receptionist workflow</h3><p>View the clinic-approved information and call schedule. Editing is reserved for the clinic administrator.</p></div><span className="status-pill confirmed">View only</span></div>
                  <div className="row g-3"><div className="col-md-6"><strong>Call availability</strong><p className="text-muted mb-0">{voiceAgent.availability === 'all_day' ? 'All day, every day' : `${voiceAgent.open_time}–${voiceAgent.close_time}`} · {voiceAgent.timezone}</p></div><div className="col-md-6"><strong>Appointment length</strong><p className="text-muted mb-0">{voiceAgent.appointment_duration_minutes || 30} minutes</p></div><div className="col-md-6"><strong>Clinic address</strong><p className="text-muted mb-0">{voiceAgent.clinic_context?.address || 'Not set'}</p></div><div className="col-md-6"><strong>Services</strong><p className="text-muted mb-0">{(voiceAgent.clinic_context?.services || []).join(', ') || 'Not set'}</p></div><div className="col-12"><strong>Frequently asked questions</strong>{(voiceAgent.clinic_context?.faqs || []).filter((faq) => faq.question || faq.answer).length ? <ul className="mt-2">{voiceAgent.clinic_context.faqs.filter((faq) => faq.question || faq.answer).map((faq, index) => <li key={index}><strong>{faq.question}</strong>{faq.answer && <span className="d-block text-muted">{faq.answer}</span>}</li>)}</ul> : <p className="text-muted mb-0">No FAQs configured.</p>}</div></div>
                </section></div>
              </div>)}

              {superAdmin && activeView === 'overview' && renderAdminOverview()}
              {superAdmin && activeView === 'subscriptions' && renderSubscriptions()}
              {superAdmin && activeView === 'leads' && <div className="card border-0 shadow-sm rounded-4 mb-4"><div className="card-body"><h4 className="mb-1">New clinic interest</h4><p className="text-muted mb-3">Follow up with clinics that requested subscription information or a demo.</p><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Clinic</th><th>Contact</th><th>Phone</th><th>Plan</th><th>Received</th></tr></thead><tbody>{clinicInterests.length ? clinicInterestPagination.items.map((lead) => <tr key={lead.id}><td className="fw-semibold">{lead.clinic_name}<small className="d-block text-muted">{lead.email}</small></td><td>{lead.contact_name}</td><td><a href={`tel:${lead.phone}`}>{lead.phone}</a></td><td className="text-capitalize">{lead.plan}</td><td>{new Date(lead.created_at).toLocaleDateString('en-IN')}</td></tr>) : <tr><td colSpan="5" className="text-muted py-4">No clinic requests yet.</td></tr>}</tbody></table></div><ListPagination pagination={clinicInterestPagination} label="clinic requests" /></div></div>}

              {superAdmin && activeView === 'tenants' && <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body">
                  <h4 className="mb-3">Tenant organizations</h4>
                  {voiceToolSecret && <div className="alert alert-info" role="status"><strong>Connect this clinic’s Exotel IVR to CareStack booking</strong><p className="mb-2">This clinic-scoped secret lets the Exotel Voicebot call its CareStack tools. Copy it into the Exotel tool’s <code>x-voice-tool-secret</code> header. If Exotel has no header value field, add POST body parameter tool_secret and set it as a Constant Value in the attached tool, never an LLM prompt. The API validates it for the URL tenant and strips it before processing; use HTTPS.</p><label className="form-label">Exotel reachable API base URL</label><input className="form-control font-monospace mb-2" value={voiceToolApiBaseUrl} onChange={(event) => { const value = event.target.value.trim().replace(/\/+$/, ''); setVoiceToolApiBaseUrl(value); try { localStorage.setItem('carestack-voice-tool-api-base-url', value); } catch {} }} placeholder={API_URL} /><small className="d-block text-muted mb-2">The default uses the configured CareStack API URL. For local testing use <code>http://localhost:3001</code>; Exotel calls require the API service's public HTTPS URL.</small><label className="form-label">Clinic voice tool endpoint</label><input className="form-control font-monospace mb-2" readOnly value={`${voiceToolApiBaseUrl.replace(/\/+$/, '')}/api/voice/tools/${telephonyTenantId}`} onFocus={(event) => event.target.select()} />{/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(voiceToolApiBaseUrl) && <p className="alert alert-warning py-2">Exotel cloud cannot reach localhost. The local endpoint works for testing on this machine; calls from Exotel need a public HTTPS URL.</p>}<label className="form-label">Clinic tool secret</label><input className="form-control font-monospace" readOnly value={voiceToolSecret} onFocus={(event) => event.target.select()} /><div className="mt-3"><strong>Exotel console setup</strong><ol className="mb-2 mt-2"><li>In <b>Build Bot → Tool Integration</b>, create three active POST tools using the endpoint above and JSON request bodies below. Set the clinic secret as a constant x-voice-tool-secret header. If this UI has no header value field, add POST body parameter tool_secret and map it as a Constant Value (never an LLM prompt).</li><li>Attach the tools to the clinic’s published Voicebot and map each value from the caller’s speech. The API accepts dates such as today/tomorrow and times such as 10 AM; normalize relative dates in the clinic timezone.</li><li>In App Bazaar, connect <b>Greeting → IVR Menu</b>. Set “Press 1 for appointment booking” to the published booking Voicebot applet. Assign the saved app flow to this clinic’s ExoPhone.</li><li>Tell the bot to collect the patient’s name, callback number, date, time and optional reason, asking for a doctor preference only if the caller has one. Check availability; if no doctor was requested, pass doctor_name as an empty string. After availability returns, continue the same conversation and preserve details already collected; do not end the turn or restart intake. Tell the caller the exact doctor/date/time returned, ask only for missing required details, read everything back and get clear final confirmation, then immediately call carestack_book_appointment in that conversation. If the caller chooses an alternative slot, check that exact slot again. Never book without confirmation. Read the confirmed booking ID back.</li></ol><details><summary>Tool request bodies</summary><p className="small mt-2 mb-1">Create a <code>carestack_clinic_info</code> tool with this body:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'clinic_info' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_check_availability</code> tool with four string fields: action is the constant availability; map date, time and doctor_name from speech. If no doctor preference was given, send doctor_name as an empty string:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'availability', date: 'aaj', time: '11 baje', doctor_name: '' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_book_appointment</code> tool. Map request_id to a unique ID per call; use the doctor_name returned by availability after telling the caller and getting approval. Set confirmed to true only after the caller approves all details:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'book', request_id: 'unique-call-id', confirmed: true, patient_name: 'patient name', phone_number: '+919876543210', doctor_name: 'doctor name', date: 'YYYY-MM-DD', time: 'HH:mm', reason: 'visit reason' }, null, 2)}</pre></details><p className="small mb-0"><b>Important:</b> Exotel must be able to reach this endpoint over public HTTPS. A localhost URL will not work from an Exotel call. A successful appointment appears immediately in this clinic’s CareStack appointments; booking hours, future dates, duplicate slots and caller confirmation are checked by the API.</p></div></div>}
                  <div className="table-responsive mb-4"><table className="table align-middle">
                    <thead><tr><th>Clinic</th><th>Portal</th><th>Administrator</th><th>Plan</th><th>AI phone</th><th>Subscription</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>{tenants.length ? tenantPagination.items.map((tenant) => <tr key={tenant.id}>
                      <td><div className="fw-semibold">{tenant.name}</div><small className="text-muted">{tenant.region}</small></td>
                      <td><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></td>
                      <td>{tenant.admin_email}</td>
                      <td className="text-capitalize">{tenant.plan}<small className="d-block text-muted">{tenant.billing_cycle}</small></td>
                      <td><div>{telephonyTenantId === tenant.id ? (telephonyForm.phone_number || 'Not assigned') : (tenant.telephony?.phone_number || 'Not assigned')}</div><small className="text-muted">{telephonyTenantId === tenant.id ? `${telephonyForm.voice_provider === 'exotel_voicebot' ? 'Exotel Voicebot' : 'Sarvam'} · editing (unsaved)` : tenant.telephony?.voice_provider === 'exotel_voicebot' ? (tenant.telephony?.enabled ? 'Exotel Voicebot · live' : 'Exotel Voicebot · console setup') : tenant.telephony?.deployment_status === 'active' ? 'Sarvam inbound active' : 'Not deployed'}</small></td>
                      <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
                      <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => configureClinicTelephony(tenant)}>Configure calling</button><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editTenant(tenant)}>Edit</button><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openTenantPasswordForm(tenant)}>Set password</button><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'} me-2`} onClick={() => updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : 'Activate'}</button><button className="btn btn-sm btn-outline-danger" onClick={() => removeTenant(tenant)}>Delete</button></td>
                    </tr>) : <tr><td colSpan="6" className="text-muted">No tenants yet.</td></tr>}</tbody>
                  </table></div>
                  <ListPagination pagination={tenantPagination} label="clinics" />
                  {passwordTenantId && <div id="tenant-password-form" className="border rounded-4 p-3 p-md-4 mb-4 bg-light">
                    <h4 className="mb-1">Set administrator password</h4>
                    <p className="text-muted">{tenants.find((tenant) => tenant.id === passwordTenantId)?.admin_email}. The password is stored as a secure hash in the application database and is not returned by the server.</p>
                    <form onSubmit={handleTenantPasswordSubmit}>
                      <div className="row g-3">
                        <div className="col-md-6"><label className="form-label" htmlFor="tenant-new-password">New password</label><input id="tenant-new-password" className="form-control" type="password" autoComplete="new-password" required minLength="10" maxLength="72" value={tenantPassword} onChange={(event) => setTenantPassword(event.target.value)} /><small className="text-muted">10–72 characters; password length is limited by bcrypt.</small></div>
                        <div className="col-md-6"><label className="form-label" htmlFor="tenant-confirm-password">Confirm password</label><input id="tenant-confirm-password" className="form-control" type="password" autoComplete="new-password" required minLength="10" maxLength="72" value={tenantPasswordConfirm} onChange={(event) => setTenantPasswordConfirm(event.target.value)} /></div>
                      </div>
                      <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button><button type="button" className="btn btn-outline-secondary" onClick={() => { setPasswordTenantId(null); setTenantPassword(''); setTenantPasswordConfirm(''); }}>Cancel</button></div>
                    </form>
                  </div>}
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
                  <div id="tenant-management-form">
                  <button type="button" className={`workspace-section-toggle ${tenantManagementFormOpen ? 'is-open' : ''}`} aria-expanded={tenantManagementFormOpen} aria-controls="tenant-management-fields" onClick={() => setTenantManagementFormOpen((open) => !open)}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">{editingTenantId ? 'Edit tenant' : 'Onboard a clinic'}</span><span className="workspace-section-toggle-description">{editingTenantId ? 'Update clinic identity, plan, billing cycle, or subscription state.' : 'Create its tenant identity; the administrator receives a one-time password by email.'}</span></span>
                    <span className="workspace-section-toggle-action">{tenantManagementFormOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button>
                  <div id="tenant-management-fields" className="mt-3" hidden={!tenantManagementFormOpen}>
                  <form onSubmit={handleTenantSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6"><label className="form-label" htmlFor="tenant-name">Clinic name</label><input id="tenant-name" className="form-control" required minLength="2" value={tenantForm.tenant_name} onChange={(event) => setTenantForm({ ...tenantForm, tenant_name: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="tenant-domain">Tenant slug</label><div className="input-group"><input id="tenant-domain" className="form-control" pattern="[a-z0-9]+(-[a-z0-9]+)*" required minLength="2" value={tenantForm.tenant_domain} onChange={(event) => setTenantForm({ ...tenantForm, tenant_domain: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /><span className="input-group-text">slug</span></div><small className="text-muted">Used to identify this clinic in the shared sign-in portal.</small></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-name">Admin name</label><input id="admin-name" className="form-control" required value={tenantForm.admin_name} onChange={(event) => setTenantForm({ ...tenantForm, admin_name: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-email">Admin email</label><input id="admin-email" type="email" className="form-control" required value={tenantForm.admin_email} onChange={(event) => setTenantForm({ ...tenantForm, admin_email: event.target.value })} /></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="admin-phone">Admin phone</label><input id="admin-phone" type="tel" className="form-control" required value={tenantForm.admin_phone} onChange={(event) => setTenantForm({ ...tenantForm, admin_phone: event.target.value })} /></div>
                      {!editingTenantId && <div className="col-12"><div className="alert alert-info mb-0">CareStack will generate a one-time password and email it to the administrator. They must choose a new password the first time they sign in.</div></div>}
                      {editingTenantId && <div className="col-12 border-top pt-3 mt-2"><h5 className="mb-1">Tenant administrator password</h5><p className="text-muted">Enter a new password here to change it. Leave both fields blank to keep the current password.</p><div className="row g-3"><div className="col-md-6"><label className="form-label" htmlFor="edit-tenant-password">New password</label><input id="edit-tenant-password" className="form-control" type="password" autoComplete="new-password" minLength="10" maxLength="72" value={editingTenantPassword} onChange={(event) => setEditingTenantPassword(event.target.value)} /></div><div className="col-md-6"><label className="form-label" htmlFor="confirm-edit-tenant-password">Confirm new password</label><input id="confirm-edit-tenant-password" className="form-control" type="password" autoComplete="new-password" minLength="10" maxLength="72" value={editingTenantPasswordConfirm} onChange={(event) => setEditingTenantPasswordConfirm(event.target.value)} /></div></div></div>}
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-plan">Plan</label><select id="tenant-plan" className="form-select" value={tenantForm.plan} onChange={(event) => setTenantForm({ ...tenantForm, plan: event.target.value })}>{(plans.length ? plans : [{ id: 'starter', name: 'Starter' }, { id: 'growth', name: 'Growth' }, { id: 'enterprise', name: 'Enterprise' }]).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-cycle">Billing cycle</label><select id="tenant-cycle" className="form-select" value={tenantForm.billing_cycle} onChange={(event) => setTenantForm({ ...tenantForm, billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="tenant-region">Region</label><input id="tenant-region" className="form-control" required value={tenantForm.region} onChange={(event) => setTenantForm({ ...tenantForm, region: event.target.value })} /></div>
                      {editingTenantId && <div className="col-md-3"><label className="form-label" htmlFor="tenant-status">Subscription status</label><select id="tenant-status" className="form-select" value={tenantForm.subscription_status} onChange={(event) => setTenantForm({ ...tenantForm, subscription_status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option></select></div>}
                    </div>
                      <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingTenantId ? (editingTenantPassword || editingTenantPasswordConfirm ? 'Save tenant & password' : 'Save tenant') : 'Create tenant'}</button>{editingTenantId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingTenantId(null); setTenantForm(emptyTenant); setTenantLogoError(''); setEditingTenantPassword(''); setEditingTenantPasswordConfirm(''); }}>Cancel</button>}{!editingTenantId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setTenantForm(emptyTenant); setTenantLogoError(''); }}>Clear form</button>}</div>
                  </form>
                  </div>
                  </div>
                </div>
              </div>}

              {!superAdmin && clinicAdmin && activeView === 'staff' && <div className="row g-4 mb-4">
                <div className="col-12"><section className="admin-panel">
                  <div className="admin-panel-heading"><div><h3>Clinic staff access</h3><p>Create receptionist accounts and choose which clinic sections each account can view or manage.</p></div><span className="status-pill confirmed">Role based access</span></div>
                  <button type="button" className={`workspace-section-toggle ${staffFormOpen ? 'is-open' : ''}`} aria-expanded={staffFormOpen} aria-controls="staff-account-fields" onClick={() => { setStaffFormOpen((open) => !open); if (!staffForm.id) setStaffForm({ id: null, name: '', email: '', password: '', permissions: STAFF_PERMISSION_GROUPS.flatMap(({ view, manage }) => [view, ...(manage ? [manage] : [])]) }); }}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">{staffForm.id ? 'Edit staff access' : 'Add clinic staff'}</span><span className="workspace-section-toggle-description">Each staff member signs in with their own email and password.</span></span><span className="workspace-section-toggle-action">{staffFormOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button>
                  <div id="staff-account-fields" className="mt-3" hidden={!staffFormOpen}>
                    <form onSubmit={submitStaffForm}>
                      <div className="row g-3 mb-4">
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-name">Staff name</label><input id="staff-name" className="form-control" required minLength="2" maxLength="120" value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} /></div>
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-email">Login email</label><input id="staff-email" className="form-control" type="email" required value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></div>
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-password">{staffForm.id ? 'New password (optional)' : 'Temporary password'}</label><input id="staff-password" className="form-control" type="password" autoComplete="new-password" minLength="10" maxLength="72" required={!staffForm.id} value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /><small className="text-muted">At least 10 characters. Share it securely with this staff member.</small></div>
                      </div>
                      <h5 className="mb-1">Permissions</h5><p className="small text-muted">AI workflow is always view only for receptionist accounts. Staff access and billing controls remain clinic admin only.</p>
                      <div className="row g-2">{STAFF_PERMISSION_GROUPS.map(({ label, view, manage }) => <div className="col-md-6 col-xl-4" key={view}><div className="border rounded-3 p-3 h-100 d-flex align-items-center justify-content-between gap-3"><strong>{label}</strong><div className="d-flex gap-3">{[[view, 'View']].concat(manage ? [[manage, 'Manage']] : []).map(([permission, permissionLabel]) => <label className="d-flex align-items-center gap-1 small" key={permission}><input className="form-check-input mt-0" type="checkbox" checked={staffForm.permissions.includes(permission)} disabled={view === 'agents:view' && permission === 'agents:view'} onChange={(event) => { const next = new Set(staffForm.permissions); if (event.target.checked) { next.add(permission); if (permission.endsWith(':manage')) next.add(view); } else { next.delete(permission); if (permission === view && manage) next.delete(manage); } setStaffForm({ ...staffForm, permissions: [...next] }); }} /><span>{permissionLabel}</span></label>)}</div></div></div>)}</div>
                      <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : staffForm.id ? 'Save staff access' : 'Create staff account'}</button>{staffForm.id && <button type="button" className="btn btn-outline-secondary" onClick={() => { setStaffForm({ id: null, name: '', email: '', password: '', permissions: STAFF_PERMISSION_GROUPS.flatMap(({ view, manage }) => [view, ...(manage ? [manage] : [])]) }); setStaffFormOpen(false); }}>Cancel edit</button>}</div>
                    </form>
                  </div>
                </section></div>
                <div className="col-12"><section className="admin-panel"><div className="admin-panel-heading"><div><h3>Staff accounts</h3><p>{staff.length} receptionist {staff.length === 1 ? 'account' : 'accounts'} for this clinic</p></div></div>
                  <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Name</th><th>Login</th><th>Granted access</th><th className="text-end">Actions</th></tr></thead><tbody>{staff.length ? staffPagination.items.map((member) => <tr key={member.id}><td className="fw-semibold">{member.name}<small className="d-block text-muted">Receptionist</small></td><td>{member.email}</td><td>{member.permissions.length ? member.permissions.map((permission) => permission.split(':').join(' ')).join(' · ') : <span className="text-muted">No sections assigned</span>}</td><td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => { setStaffForm({ id: member.id, name: member.name, email: member.email, password: '', permissions: member.permissions || [] }); setStaffFormOpen(true); window.setTimeout(() => document.getElementById('staff-account-fields')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>Edit access</button><button className="btn btn-sm btn-outline-danger" onClick={() => removeStaff(member)}>Remove</button></td></tr>) : <tr><td colSpan="4" className="text-muted py-4">No staff accounts yet. Add a receptionist above.</td></tr>}</tbody></table></div>
                  <ListPagination pagination={staffPagination} label="staff accounts" />
                </section></div>
              </div>}

              {!superAdmin && activeView === 'doctors' && <div className="row g-4 mb-4">
                <div className="col-lg-4"><div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
                  <h4 className="mb-1">{editingDoctorId ? 'Edit doctor' : 'Add clinic doctor'}</h4>
                  <p className="text-muted small">Active doctors appear in the AI receptionist and appointment availability checks.</p>
                  {!canManage('doctors') && <p className="alert alert-info py-2">You have view-only access to the clinic doctor roster.</p>}
                  <fieldset disabled={!canManage('doctors')}>
                  <form onSubmit={handleDoctorSubmit}>
                    <label className="form-label" htmlFor="doctor-name">Doctor name</label>
                    <input id="doctor-name" className="form-control mb-3" required minLength="2" maxLength="120" value={doctorForm.name} onChange={(event) => setDoctorForm({ ...doctorForm, name: event.target.value })} placeholder="Dr. Anjali Sharma" />
                    <label className="form-label" htmlFor="doctor-specialty">Specialty</label>
                    <input id="doctor-specialty" className="form-control" maxLength="160" value={doctorForm.specialty} onChange={(event) => setDoctorForm({ ...doctorForm, specialty: event.target.value })} placeholder="General medicine" />
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{editingDoctorId ? 'Save doctor' : 'Add doctor'}</button>{editingDoctorId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setDoctorForm({ name: '', specialty: '' }); setEditingDoctorId(null); }}>Cancel</button>}</div>
                  </form>
                  </fieldset>
                </div></div></div>
                <div className="col-lg-8"><div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body">
                  <div className="d-flex justify-content-between align-items-center gap-3 mb-3"><div><h4 className="mb-1">Clinic doctor roster</h4><p className="small text-muted mb-0">{(tenantData?.doctors || []).filter((doctor) => doctor.status === 'active').length} active · saved in this clinic database</p></div></div>
                  {(tenantData?.doctors || []).length ? <div className="list-group list-group-flush">{doctorPagination.items.map((doctor) => <div className="list-group-item px-0 d-flex justify-content-between align-items-center gap-3" key={doctor.id}>
                    <div><strong>{doctor.name}</strong>{doctor.specialty && <span className="text-muted"> · {doctor.specialty}</span>}<small className="d-block"><span className={`status-pill ${doctor.status === 'active' ? 'confirmed' : 'cancelled'}`}>{doctor.status}</span></small></div>
                    {canManage('doctors') && <div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editDoctor(doctor)}>Edit</button><button type="button" className={`btn btn-sm ${doctor.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => toggleDoctorStatus(doctor)}>{doctor.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div>}
                  </div>)}</div> : <div className="empty-insight">No doctors added yet. Add your clinic’s verified doctors to enable real availability checks and voice bookings.</div>}
                  <ListPagination pagination={doctorPagination} label="doctors" />
                </div></div></div>
              </div>}

              {!superAdmin && activeView === 'patients' && canManage('patients') && <div className="card border-0 shadow-sm rounded-4 mb-4" id="patient-form">
                <div className="card-body">
                  <button type="button" className={`workspace-section-toggle ${patientFormOpen ? 'is-open' : ''}`} aria-expanded={patientFormOpen} aria-controls="patient-form-fields" onClick={() => setPatientFormOpen((open) => !open)}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">{editingPatientId ? 'Edit patient' : 'Register patient'}</span><span className="workspace-section-toggle-description">{editingPatientId ? 'Update this patient’s contact and status details.' : 'Add a patient record to this clinic.'}</span></span>
                    <span className="workspace-section-toggle-action">{patientFormOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button>
                  <div id="patient-form-fields" className="mt-3" hidden={!patientFormOpen}>
                  <form onSubmit={handlePatientSubmit}>
                    <div className="row g-3">
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-name">Full name</label><input id="patient-name" className="form-control" required minLength="2" value={patientForm.name} onChange={(event) => setPatientForm({ ...patientForm, name: event.target.value })} /></div>
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-phone">Phone</label><input id="patient-phone" className="form-control" required value={patientForm.phone} onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })} /></div>
                      <div className="col-md-4"><label className="form-label" htmlFor="patient-email">Email</label><input id="patient-email" type="email" className="form-control" value={patientForm.email || ''} onChange={(event) => setPatientForm({ ...patientForm, email: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="patient-age">Age</label><input id="patient-age" type="number" min="0" max="125" className="form-control" value={patientForm.age} onChange={(event) => setPatientForm({ ...patientForm, age: event.target.value })} /></div>
                      <div className="col-md-3"><label className="form-label" htmlFor="patient-status">Status</label><select id="patient-status" className="form-select" value={patientForm.status} onChange={(event) => setPatientForm({ ...patientForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                      <div className="col-md-6"><label className="form-label" htmlFor="patient-notes">Notes</label><input id="patient-notes" className="form-control" value={patientForm.notes || ''} onChange={(event) => setPatientForm({ ...patientForm, notes: event.target.value })} /></div>
                    </div>
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{editingPatientId ? 'Save changes' : 'Add patient'}</button>{editingPatientId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setPatientForm(emptyPatient); setEditingPatientId(null); setPatientFormOpen(false); }}>Cancel</button>}</div>
                  </form>
                  </div>
                </div>
              </div>}

              {!superAdmin && activeView === 'appointments' && canManage('appointments') && <div className="card border-0 shadow-sm rounded-4 mb-4" id="booking-form">
                <div className="card-body">
                  <button type="button" className={`workspace-section-toggle ${bookingFormOpen ? 'is-open' : ''}`} aria-expanded={bookingFormOpen} aria-controls="booking-form-fields" onClick={() => setBookingFormOpen((open) => !open)}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">Book an appointment</span><span className="workspace-section-toggle-description">Enter the patient and appointment details.</span></span>
                    <span className="workspace-section-toggle-action">{bookingFormOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button>
                  <div id="booking-form-fields" className="mt-3" hidden={!bookingFormOpen}>
                    <form onSubmit={handleBookingSubmit}>
                      <div className="row g-3">
                        <div className="col-md-6"><label className="form-label" htmlFor="booking-patient">Patient name</label><input id="booking-patient" className="form-control" required minLength="2" value={bookingForm.patient_name} onChange={(event) => setBookingForm({ ...bookingForm, patient_name: event.target.value })} /></div>
                        <div className="col-md-6"><label className="form-label" htmlFor="booking-phone">Phone number</label><input id="booking-phone" type="tel" className="form-control" required minLength="7" value={bookingForm.phone_number} onChange={(event) => setBookingForm({ ...bookingForm, phone_number: event.target.value })} /></div>
                        <div className="col-md-6"><label className="form-label" htmlFor="booking-doctor">Doctor</label><select id="booking-doctor" className="form-select" value={bookingForm.doctor_name} onChange={(event) => setBookingForm({ ...bookingForm, doctor_name: event.target.value })}><option value="">Choose a configured clinic doctor</option>{clinicDoctors.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}</select></div>
                        <div className="col-md-3"><label className="form-label" htmlFor="booking-date">Date</label><input id="booking-date" type="date" className="form-control" required value={bookingForm.appointment_date} onChange={(event) => setBookingForm({ ...bookingForm, appointment_date: event.target.value })} /></div>
                        <div className="col-md-3"><label className="form-label" htmlFor="booking-time">Time</label><input id="booking-time" type="time" className="form-control" required value={bookingForm.appointment_time} onChange={(event) => setBookingForm({ ...bookingForm, appointment_time: event.target.value })} /></div>
                        <div className="col-12"><label className="form-label" htmlFor="booking-reason">Reason for visit</label><input id="booking-reason" className="form-control" value={bookingForm.reason} onChange={(event) => setBookingForm({ ...bookingForm, reason: event.target.value })} /></div>
                      </div>
                      <button className="btn btn-primary mt-3" disabled={busy}>{busy ? 'Agent processing…' : 'Run booking agents'}</button>
                    </form>
                  </div>
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
                  <div className="col-lg-6"><section className="tenant-insight-panel h-100"><div className="admin-panel-heading"><div><h3>Doctor workload</h3><p>Upcoming non-cancelled appointments</p></div></div>{analytics.doctor_workload.length ? doctorWorkloadPagination.items.map((item) => <div className="doctor-row report-doctor-row" key={item.doctor}><span>{item.doctor}</span><div className="admin-bar-track"><span className="doctor-fill" style={{ width: `${(item.count / maxDoctorCount) * 100}%` }} /></div><strong>{item.count}</strong></div>) : <div className="empty-insight">No upcoming appointment workload to report.</div>}<ListPagination pagination={doctorWorkloadPagination} label="doctors" /></section></div>
                </div>
              </div>}

              {!superAdmin && (activeView === 'overview' || activeView === 'patients' || activeView === 'appointments') && <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body">
                  {activeView === 'appointments' ? <button type="button" className={`workspace-section-toggle mb-3 ${appointmentRegisterOpen ? 'is-open' : ''}`} aria-expanded={appointmentRegisterOpen} aria-controls="appointment-register-fields" onClick={() => setAppointmentRegisterOpen((open) => !open)}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">Appointment register</span><span className="workspace-section-toggle-description">Showing {filteredBookings.length} of {bookings.length} records. Status changes stay saved on the appointment.</span></span>
                    <span className="workspace-section-toggle-action">{appointmentRegisterOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button> : <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3"><div><h4 className="mb-1">{activeView === 'overview' ? 'Recent patients' : 'Patient directory'}</h4></div>{activeView === 'patients' && <button className="btn btn-sm btn-outline-primary" onClick={() => exportTenantCsv('patients')}>Export patients</button>}</div>}
                  <div id="appointment-register-fields" hidden={activeView === 'appointments' && !appointmentRegisterOpen}>
                  {activeView === 'appointments' && <div className="workspace-table-tools">
                    <div className="workspace-search"><label className="visually-hidden" htmlFor="appointment-search">Search appointments</label><span aria-hidden="true">⌕</span><input id="appointment-search" className="form-control" placeholder="Search patient, doctor, phone, or reference" value={appointmentQuery} onChange={(event) => setAppointmentQuery(event.target.value)} /></div>
                    <div className="workspace-filter-pills" role="group" aria-label="Appointment date range">{[['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All dates']].map(([value, label]) => <button type="button" key={value} className={appointmentDateFilter === value ? 'active' : ''} aria-pressed={appointmentDateFilter === value} onClick={() => setAppointmentDateFilter(value)}>{label}</button>)}</div>
                    <label className="visually-hidden" htmlFor="appointment-status-filter">Filter by status</label><select id="appointment-status-filter" className="form-select workspace-status-filter" value={appointmentStatusFilter} onChange={(event) => setAppointmentStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select>
                    <button className="btn btn-outline-secondary" onClick={() => exportTenantCsv('bookings')}>Export</button>
                  </div>}
                  {activeView === 'patients' && <div className="workspace-table-tools">
                    <div className="workspace-search"><label className="visually-hidden" htmlFor="patient-search">Search patients</label><span aria-hidden="true">⌕</span><input id="patient-search" className="form-control" placeholder="Search name, phone, email, or patient ID" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} /></div>
                    <label className="visually-hidden" htmlFor="patient-status-filter">Filter patients by status</label><select id="patient-status-filter" className="form-select workspace-status-filter" value={patientStatusFilter} onChange={(event) => setPatientStatusFilter(event.target.value)}><option value="all">All patients</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                    <span className="workspace-result-count">{filteredPatients.length} of {patients.length} patients</span>
                  </div>}
                  <div className="table-responsive">
                    <table className="table align-middle">
                      {activeView === 'appointments' ? <thead><tr><th>Appointment</th><th>Patient</th><th>Doctor</th><th>Date &amp; time</th><th>Status</th>{canManage('appointments') && <th>Update</th>}</tr></thead> : <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Status</th>
                          {activeView === 'patients' && canManage('patients') && <th className="text-end">Actions</th>}
                        </tr>
                      </thead>}
                      <tbody>
                        {activeView === 'appointments' ? filteredBookings.length === 0 ? (
                          <tr><td colSpan={canManage('appointments') ? 6 : 5} className="text-muted py-4">{bookings.length ? 'No appointments match those filters.' : 'No appointments booked yet.'}</td></tr>
                        ) : appointmentPagination.items.map((booking) => (
                          <tr key={booking.id}><td className="fw-semibold">{booking.id}</td><td>{booking.patient_name}<small className="d-block text-muted">{booking.phone_number}</small></td><td>{booking.doctor_name}</td><td>{booking.appointment_date}<small className="d-block text-muted">{booking.appointment_time}</small></td><td><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></td>{canManage('appointments') && <td><select className="form-select form-select-sm appointment-status-select" aria-label={`Update ${booking.id} status`} value={booking.status} onChange={(event) => updateAppointmentStatus(booking.id, event.target.value)}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></td>}</tr>
                        )) : displayedPatients.length === 0 ? (
                          <tr>
                            <td colSpan={activeView === 'patients' && canManage('patients') ? 6 : 5} className="text-muted py-4">{patients.length ? 'No patients match those filters.' : 'No patients yet.'}</td>
                          </tr>
                        ) : (
                          (activeView === 'patients' ? patientPagination.items : displayedPatients).map((patient) => (
                            <tr key={patient.id}>
                              <td>{patient.id}</td>
                              <td>{patient.name}</td>
                              <td>{patient.phone}</td>
                              <td>{patient.email || '-'}</td>
                              <td>
                                <span className="badge bg-success-subtle text-success rounded-pill">{patient.status}</span>
                              </td>
                              {activeView === 'patients' && canManage('patients') && <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editPatient(patient)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => deletePatient(patient.id)}>Delete</button></td>}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {activeView === 'appointments' && <ListPagination pagination={appointmentPagination} label="appointments" />}
                  {activeView === 'patients' && <ListPagination pagination={patientPagination} label="patients" />}
                  </div>
                </div>
              </div>}
              </div>
            </main>
          </div>
          {profileDialogOpen && <div className="workspace-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !profileBusy && !profileLoading) setProfileDialogOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape' && !profileBusy && !profileLoading) setProfileDialogOpen(false); }}>
            <section className="workspace-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-profile-title">
              <div className="workspace-profile-heading">
                <div><p className="workspace-confirm-eyebrow">ACCOUNT SETTINGS</p><h2 id="workspace-profile-title">Your profile</h2><p>Update the details shown in your workspace header.</p></div>
                <button type="button" className="workspace-profile-close" onClick={() => setProfileDialogOpen(false)} disabled={profileBusy || profileLoading} aria-label="Close profile settings">×</button>
              </div>
              <div className="workspace-profile-photo-row">
                {profileForm.avatar_data_url ? <img className="workspace-profile-photo" src={profileForm.avatar_data_url} alt="Profile preview" /> : <span className="workspace-profile-photo workspace-profile-photo-placeholder">{String(profileForm.name || profileForm.email || 'U').charAt(0).toUpperCase()}</span>}
                <div className="workspace-profile-photo-actions"><strong>Profile photo</strong><small>PNG, JPG, or WebP · up to 500 KB</small><div><label className="workspace-profile-upload">Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfilePhotoChange} /></label>{profileForm.avatar_data_url && <button type="button" className="workspace-profile-remove" onClick={() => setProfileForm((current) => ({ ...current, avatar_data_url: '' }))}>Remove</button>}</div></div>
              </div>
              <form className="workspace-profile-form" onSubmit={saveOwnProfile}>
                <div className="workspace-profile-fields">
                  <label>Name<input className="form-control" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={100} autoComplete="name" /></label>
                  <label>Email address<input className="form-control" type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} required maxLength={254} autoComplete="email" /></label>
                  <label>Phone number<input className="form-control" type="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} maxLength={20} pattern="\+?[0-9\s()-]{7,20}" autoComplete="tel" placeholder="+91 98765 43210" /></label>
                  <label>Employee ID<input className="form-control workspace-profile-readonly" value={profileForm.employee_id} readOnly aria-readonly="true" /><small>Assigned automatically and cannot be edited.</small></label>
                </div>
                <div className="workspace-profile-actions"><button type="submit" className="workspace-confirm-accept" disabled={profileBusy || profileLoading}>{profileLoading ? 'Loading…' : profileBusy ? 'Saving…' : 'Save profile'}</button></div>
              </form>
              <div className="workspace-profile-divider" />
              <div className="workspace-profile-form">
                <button type="button" className={`workspace-section-toggle ${profilePasswordOpen ? 'is-open' : ''}`} aria-expanded={profilePasswordOpen} aria-controls="workspace-profile-password-fields" onClick={() => setProfilePasswordOpen((open) => !open)}>
                  <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">Change password</span><span className="workspace-section-toggle-description">Update the password for your account.</span></span>
                  <span className="workspace-section-toggle-action">{profilePasswordOpen ? 'Collapse −' : 'Expand +'}</span>
                </button>
                {profilePasswordOpen && !profilePasswordResetOpen && <form id="workspace-profile-password-fields" className="workspace-profile-form" onSubmit={changeOwnProfilePassword}>
                  <div className="workspace-profile-section-heading"><p>Use your current password to set a new one.</p></div>
                  <div className="workspace-profile-fields workspace-profile-password-fields">
                    <label>Current password<input className="form-control" type="password" value={profileCurrentPassword} onChange={(event) => setProfileCurrentPassword(event.target.value)} required autoComplete="current-password" /></label>
                    <label>New password<input className="form-control" type="password" value={profileNewPassword} onChange={(event) => setProfileNewPassword(event.target.value)} required minLength={10} maxLength={72} autoComplete="new-password" /></label>
                    <label>Confirm new password<input className="form-control" type="password" value={profilePasswordConfirm} onChange={(event) => setProfilePasswordConfirm(event.target.value)} required minLength={10} maxLength={72} autoComplete="new-password" /></label>
                  </div>
                  <div className="workspace-profile-actions"><button type="submit" className="workspace-confirm-cancel" disabled={profileBusy || profileLoading || !profileCurrentPassword || !profileNewPassword}>{profileLoading ? 'Loading…' : profileBusy ? 'Updating…' : 'Update password'}</button></div>
                </form>}
                {profilePasswordOpen && <div className="workspace-profile-form">
                  <div className="workspace-profile-section-heading"><p>Forgot your current password? Verify your account by email instead.</p></div>
                  {!profilePasswordResetOpen && <div className="workspace-profile-actions"><button type="button" className="workspace-confirm-cancel" onClick={requestProfilePasswordReset} disabled={profileBusy || profileLoading}>{profileBusy ? 'Sending code…' : 'Send reset code to email'}</button></div>}
                  {profilePasswordResetOpen && <form className="workspace-profile-form" onSubmit={confirmProfilePasswordReset}>
                    <div className="workspace-profile-fields workspace-profile-password-fields">
                      <label>Email reset code<input className="form-control" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={profilePasswordResetCode} onChange={(event) => setProfilePasswordResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
                      <label>New password<input className="form-control" type="password" value={profileNewPassword} onChange={(event) => setProfileNewPassword(event.target.value)} required minLength={10} maxLength={72} autoComplete="new-password" /></label>
                      <label>Confirm new password<input className="form-control" type="password" value={profilePasswordConfirm} onChange={(event) => setProfilePasswordConfirm(event.target.value)} required minLength={10} maxLength={72} autoComplete="new-password" /></label>
                    </div>
                    <div className="workspace-profile-actions"><button type="button" className="workspace-confirm-cancel" onClick={requestProfilePasswordReset} disabled={profileBusy || profileLoading}>{profileBusy ? 'Sending code…' : 'Resend code'}</button><button type="button" className="workspace-confirm-cancel" onClick={() => { setProfilePasswordResetOpen(false); setProfilePasswordResetCode(''); setProfileNewPassword(''); setProfilePasswordConfirm(''); }} disabled={profileBusy || profileLoading}>Use current password</button><button type="submit" className="workspace-confirm-accept" disabled={profileBusy || profileLoading || profilePasswordResetCode.length !== 6 || !profileNewPassword}>{profileBusy ? 'Updating…' : 'Verify code & update password'}</button></div>
                  </form>}
                </div>}
              </div>
              {(profileError || profileNotice) && <div className="workspace-profile-feedback" aria-live="polite">{profileError && <p className="workspace-profile-message error" role="alert">{profileError}</p>}{profileNotice && <p className="workspace-profile-message success" role="status">{profileNotice}</p>}</div>}
            </section>
          </div>}
          {confirmationDialog && <div className="workspace-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resolveConfirmation(false); }} onKeyDown={(event) => { if (event.key === 'Escape') resolveConfirmation(false); }}>
            <section className={`workspace-confirm-dialog ${confirmationDialog.tone === 'danger' ? 'danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="workspace-confirm-title" aria-describedby="workspace-confirm-message">
              <span className={`workspace-confirm-mark ${confirmationDialog.tone === 'danger' ? 'danger' : ''}`} aria-hidden="true">{confirmationDialog.tone === 'danger' ? '!' : '?'}</span>
              <p className="workspace-confirm-eyebrow">CONFIRM ACTION</p>
              <h2 id="workspace-confirm-title">{confirmationDialog.title}</h2>
              <p id="workspace-confirm-message">{confirmationDialog.message}</p>
              <div className="workspace-confirm-actions">
                <button type="button" className="workspace-confirm-cancel" onClick={() => resolveConfirmation(false)}>Go back</button>
                <button type="button" autoFocus className={`workspace-confirm-accept ${confirmationDialog.tone === 'danger' ? 'danger' : ''}`} onClick={() => resolveConfirmation(true)}>{confirmationDialog.confirmLabel || 'Continue'}</button>
              </div>
            </section>
          </div>}
      </div>
    );
  };

  if (sessionRestoring) {
    return <div className="workspace-restore-screen" role="status" aria-live="polite">
      <span className="workspace-restore-mark">C</span>
      <span className="workspace-restore-spinner" aria-hidden="true" />
      <strong>Opening your clinic workspace</strong>
      <small>Restoring your session and dashboard…</small>
    </div>;
  }

  return (
    <>
      {page === 'landing' && renderLanding()}
      {page === 'login' && renderLogin()}
      {page === 'dashboard' && renderDashboard()}
    </>
  );
}

export default App;
