import { useEffect, useMemo, useRef, useState } from 'react';
import carestacMark from './carestac-mark.svg';

const PUBLIC_APP_URL = 'https://carestack-uat-web.onrender.com';
const PUBLIC_API_URL = 'https://carestack-6psq.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname === new URL(PUBLIC_APP_URL).hostname
    ? PUBLIC_API_URL
    : 'http://localhost:3001'
);
const emptyPatient = { name: '', phone: '', email: '', age: '', notes: '', status: 'active' };
const emptyBooking = { patient_name: '', phone_number: '', doctor_name: '', appointment_date: '', appointment_time: '', reason: 'General consultation' };
const emptyWaitlistEntry = { name: '', phone: '', doctor_name: '', preferred_date: '', preferred_time: '', notes: '' };
const emptyTenant = { tenant_name: '', tenant_domain: '', admin_name: '', admin_email: '', admin_phone: '', plan: 'growth', billing_cycle: 'monthly', subscription_status: 'active', region: 'India' };
const emptyPlan = { id: '', name: '', monthly_price: '', annual_price: '', clinic_limit: '', user_limit: '', features: ['dashboard'] };
const BILLING_PRODUCT_FEATURES = [
  { id: 'payment_transactions', label: 'Payments & transactions', description: 'Completed-visit billing ledger, payment details, and outstanding balances.' },
  { id: 'fee_reconciliation', label: 'Fees & ledger reconciliation', description: 'Daily and monthly completed-visit reconciliation with admin-approved billing corrections.' },
];
const defaultVoiceAgent = { enabled: true, availability: 'business_hours', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: { address: '', services: [], doctors: [], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] } };
const emptyTelephony = { phone_number: '', account_sid: '', app_id: '', region: 'mumbai', enabled: false, exotel_api_key: '', exotel_api_token: '', sarvam_org_id: '', sarvam_workspace_id: '', sarvam_agent_id: '', sarvam_agent_version: '', sarvam_connection_id: '' };
const telephonyConfigFields = ['phone_number', 'account_sid', 'app_id', 'region', 'enabled', 'exotel_voicebot_id', 'sarvam_org_id', 'sarvam_workspace_id', 'sarvam_agent_id', 'sarvam_agent_version', 'sarvam_connection_id'];
const emptyProviderTelephony = Object.fromEntries(telephonyConfigFields.map((key) => [key, key === 'region' ? 'mumbai' : key === 'enabled' ? false : '']));
const providerTelephonyDefaults = { sarvam: { ...emptyProviderTelephony }, exotel_voicebot: { ...emptyProviderTelephony } };
const emptyClinicInterest = { clinic_name: '', contact_name: '', email: '', phone: '', plan: 'growth' };
const STAFF_PERMISSION_GROUPS = [
  { label: 'Overview', view: 'overview:view' },
  { label: 'Today’s clinic plan', view: 'overview:today_plan' },
  { label: 'AI workflow', view: 'agents:view' },
  { label: 'Doctors', view: 'doctors:view', manage: 'doctors:manage' },
  { label: 'Patients', view: 'patients:view', manage: 'patients:manage' },
  { label: 'Appointments', view: 'appointments:view', manage: 'appointments:manage' },
  { label: 'Payments & transactions', view: 'payments:view', manage: 'payments:manage', reconcile: 'payments:reconcile' },
  { label: 'Reports', view: 'reports:view' },
];
const emptyClinicRole = { id: '', name: '', permissions: [] };
const emptyPermissionOverrides = { allow: [], deny: [] };
const availableClinicViews = (user, planFeatures) => {
  const included = (feature) => !Array.isArray(planFeatures) || planFeatures.includes(feature);
  if (!user || user.role === 'tenant_admin') return [
    'overview', included('ai_receptionist') && 'agents', included('doctors') && 'doctors', included('patients') && 'patients', included('appointments') && 'appointments', included('appointments') && included('payment_transactions') && 'payments', included('appointments') && included('fee_reconciliation') && 'fees', included('reports') && 'reports',
  ].filter(Boolean);
  const permissions = new Set(user.permissions || []);
  return [
    (permissions.has('overview:view') || permissions.has('overview:today_plan')) && 'overview',
    included('ai_receptionist') && permissions.has('agents:view') && 'agents',
    included('doctors') && (permissions.has('doctors:view') || permissions.has('doctors:manage')) && 'doctors',
    included('patients') && (permissions.has('patients:view') || permissions.has('patients:manage')) && 'patients',
    included('appointments') && (permissions.has('appointments:view') || permissions.has('appointments:manage')) && 'appointments',
    included('appointments') && included('payment_transactions') && (permissions.has('payments:view') || permissions.has('payments:manage')) && 'payments',
    included('appointments') && included('fee_reconciliation') && (permissions.has('payments:reconcile') || permissions.has('payments:manage')) && 'fees',
    included('reports') && permissions.has('reports:view') && 'reports',
  ].filter(Boolean);
};
const subscriptionEndDate = (startDate, billingCycle) => {
  const [year, month, day] = startDate.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, month - 1 + (billingCycle === 'annual' ? 12 : 1), 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  nextMonth.setUTCDate(Math.min(day, lastDay) - 1);
  return nextMonth.toISOString().slice(0, 10);
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const PATIENT_TABLE_COLUMNS = [
  { key: 'id', label: 'ID', value: (patient) => patient.id },
  { key: 'name', label: 'Name', value: (patient) => patient.name },
  { key: 'phone', label: 'Phone', value: (patient) => patient.phone },
  { key: 'email', label: 'Email', value: (patient) => patient.email },
  { key: 'age', label: 'Age', value: (patient) => patient.age },
  { key: 'status', label: 'Status', value: (patient) => patient.status },
];
const STAFF_TABLE_COLUMNS = [
  { key: 'id', label: 'ID', value: (member) => member.id },
  { key: 'name', label: 'Name', value: (member) => member.name },
  { key: 'email', label: 'Login email', value: (member) => member.email },
  { key: 'role', label: 'Role', value: (member) => member.role },
];
const TRANSACTION_TABLE_COLUMNS = [
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'appointment_id', label: 'Appointment ID' },
  { key: 'patient_name', label: 'Patient' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'doctor_name', label: 'Doctor' },
  { key: 'appointment_date', label: 'Visit date' },
  { key: 'appointment_time', label: 'Visit time' },
  { key: 'reason', label: 'Visit reason' },
  { key: 'consultation_fee', label: 'Consultation fee' },
  { key: 'discount_amount', label: 'Discount' },
  { key: 'additional_charges', label: 'Extra charges' },
  { key: 'total_amount', label: 'Total bill' },
  { key: 'amount_paid', label: 'Received' },
  { key: 'balance_due', label: 'Balance due' },
  { key: 'payment_method', label: 'Payment method' },
  { key: 'payment_status', label: 'Payment status' },
  { key: 'payment_reference', label: 'Payment reference' },
  { key: 'payment_proof_name', label: 'Payment document' },
  { key: 'recorded_by', label: 'Recorded by' },
  { key: 'updated_at', label: 'Recorded / updated at' },
  { key: 'completion_notes', label: 'Checkout notes' },
  { key: 'reconciled_by', label: 'Reconciled by' },
  { key: 'reconciled_at', label: 'Reconciled at' },
];
const DEFAULT_TRANSACTION_COLUMNS = ['transaction_id', 'patient_name', 'appointment_date', 'total_amount', 'amount_paid', 'balance_due', 'payment_status', 'recorded_by', 'updated_at'];

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
    throw new Error('Your Carestac session expired. Sign in again to continue.');
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
  const [transactions, setTransactions] = useState([]);
  const [transactionQuery, setTransactionQuery] = useState('');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [transactionMethodFilter, setTransactionMethodFilter] = useState('all');
  const [transactionDateFilter, setTransactionDateFilter] = useState('all');
  const [transactionColumns, setTransactionColumns] = useState(DEFAULT_TRANSACTION_COLUMNS);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [paymentChangeRequests, setPaymentChangeRequests] = useState([]);
  const [feePeriod, setFeePeriod] = useState('today');
  const [tenants, setTenants] = useState([]);
  const [subscriptionDateEdits, setSubscriptionDateEdits] = useState({});
  const [plans, setPlans] = useState([]);
  const [productFeatures, setProductFeatures] = useState([]);
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
  const [roles, setRoles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyClinicRole);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [permissionUserId, setPermissionUserId] = useState('');
  const [permissionOverridesForm, setPermissionOverridesForm] = useState(emptyPermissionOverrides);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [patientFormOpen, setPatientFormOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState([]);
  const [doctorForm, setDoctorForm] = useState({ name: '', specialty: '' });
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [appointmentRegisterOpen, setAppointmentRegisterOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [completionAppointment, setCompletionAppointment] = useState(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [billingRequestFor, setBillingRequestFor] = useState(null);
  const [billingRequestMessage, setBillingRequestMessage] = useState('');
  const [completionForm, setCompletionForm] = useState({ consultation_fee: '', discount_amount: '0', additional_charges: '0', amount_paid: '', payment_method: 'cash', payment_reference: '', completion_notes: '', payment_proof_data_url: '', payment_proof_name: '' });
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [appointmentQuery, setAppointmentQuery] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState('all');
  const [reportMonth, setReportMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7));
  const [waitlistForm, setWaitlistForm] = useState(emptyWaitlistEntry);
  const [waitlistFormOpen, setWaitlistFormOpen] = useState(false);
  const [overviewActivityRange, setOverviewActivityRange] = useState('7d');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [patientDateFilter, setPatientDateFilter] = useState('all');
  const [patientOverviewColumns, setPatientOverviewColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('carestack-patient-overview-columns') || 'null');
      const validSaved = Array.isArray(saved) ? saved.filter((key) => PATIENT_TABLE_COLUMNS.some((column) => column.key === key)) : [];
      return validSaved.length ? validSaved : ['id', 'name', 'phone', 'email', 'status'];
    } catch {
      return ['id', 'name', 'phone', 'email', 'status'];
    }
  });
  const [confirmationDialog, setConfirmationDialog] = useState(null);
  const confirmationResolverRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  useEffect(() => setSelectedPatientIds([]), [session?.tenant_id]);
  useEffect(() => setSelectedAppointmentIds([]), [session?.tenant_id]);
  useEffect(() => setSelectedTransactionIds([]), [session?.tenant_id]);
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
  const [faqDrafts, setFaqDrafts] = useState([]);
  const [faqDraftsBusy, setFaqDraftsBusy] = useState(false);
  const [publicPlans, setPublicPlans] = useState([]);
  const [clinicInterests, setClinicInterests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  const [staffColumns, setStaffColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('carestack-staff-table-columns') || 'null');
      const valid = Array.isArray(saved) ? saved.filter((key) => STAFF_TABLE_COLUMNS.some((column) => column.key === key)) : [];
      return valid.length ? valid : ['name', 'email', 'role'];
    } catch {
      return ['name', 'email', 'role'];
    }
  });
  const [staffForm, setStaffForm] = useState({ id: null, name: '', email: '', password: '', role: 'receptionist' });
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
    try {
      localStorage.setItem('carestack-patient-overview-columns', JSON.stringify(patientOverviewColumns));
    } catch {
      // Keep the current selection for this session if browser storage is unavailable.
    }
  }, [patientOverviewColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('carestack-staff-table-columns', JSON.stringify(staffColumns));
    } catch {
      // Keep the current selection for this session if browser storage is unavailable.
    }
  }, [staffColumns]);

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
      setError('Your Carestac session expired. Sign in again to continue.');
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
        setActiveView(availableClinicViews(parsed, tenantData?.plan_features)[0] || 'overview');
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
      setActiveView(nextSession.role === 'super_admin' ? 'overview' : availableClinicViews(nextSession, tenantData?.plan_features)[0] || 'overview');
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
      setActiveView(availableClinicViews(nextSession, tenantData?.plan_features)[0] || 'overview');
      await loadDashboard(nextSession.tenant_id);
    } catch (changeError) { setError(changeError.message); }
    finally { setBusy(false); }
  };

  const loadDashboard = async (tenantId, throwOnError = false, silent = false, activityRange = overviewActivityRange) => {
    if (!tenantId) return;
    try {
      const dashboard = await request(`/api/tenant/${tenantId}/dashboard?activity_range=${encodeURIComponent(activityRange)}`);
      if (session?.tenant_id === tenantId && session.role !== 'super_admin' && !availableClinicViews(session, dashboard.plan_features).includes(activeView)) {
        setActiveView(availableClinicViews(session, dashboard.plan_features)[0] || 'overview');
      }
      const dashboardBookings = dashboard.bookings || [];
      setTransactions(dashboard.transactions || []);
      setPaymentChangeRequests(dashboard.payment_change_requests || []);
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
      const [response, roleResponse] = await Promise.all([
        request(`/api/tenant/${session.tenant_id}/staff`),
        request(`/api/tenant/${session.tenant_id}/roles`),
      ]);
      setStaff(response.staff || []);
      setRoles(roleResponse.roles || []);
      const availableStaff = response.staff || [];
      const selectedUser = availableStaff.find((member) => member.id === permissionUserId) || availableStaff[0];
      if (selectedUser) {
        setPermissionUserId(selectedUser.id);
        setPermissionOverridesForm(selectedUser.permission_overrides || emptyPermissionOverrides);
      } else {
        setPermissionUserId('');
        setPermissionOverridesForm(emptyPermissionOverrides);
      }
    } catch (loadError) { setError(loadError.message); }
  };

  const submitRoleForm = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await request(`/api/tenant/${session.tenant_id}/roles${editingRoleId ? `/${editingRoleId}` : ''}`, {
        method: editingRoleId ? 'PUT' : 'POST', body: JSON.stringify(roleForm),
      });
      setNotice(`${response.role.name} role ${editingRoleId ? 'updated' : 'created'}.`);
      setRoleForm(emptyClinicRole); setEditingRoleId(null); setRoleFormOpen(false);
      await loadStaff();
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  };

  const editClinicRole = (role) => {
    setRoleForm({ id: role.id, name: role.name, permissions: [...(role.permissions || [])] });
    setEditingRoleId(role.id); setRoleFormOpen(true); setError(''); setNotice('');
  };

  const removeClinicRole = async (role) => {
    if (role.built_in || role.id === 'receptionist') return;
    if (!window.confirm(`Delete ${role.name}? Staff accounts must be moved to another role first.`)) return;
    try {
      await request(`/api/tenant/${session.tenant_id}/roles/${role.id}`, { method: 'DELETE' });
      setNotice(`${role.name} role deleted.`);
      await loadStaff();
    } catch (deleteError) { setError(deleteError.message); }
  };

  const selectPermissionUser = (userId) => {
    const member = staff.find((item) => item.id === userId);
    setPermissionUserId(userId);
    setPermissionOverridesForm(member?.permission_overrides || emptyPermissionOverrides);
  };

  const savePermissionOverrides = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id || !permissionUserId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await request(`/api/tenant/${session.tenant_id}/staff/${permissionUserId}`, {
        method: 'PATCH', body: JSON.stringify({ permission_overrides: permissionOverridesForm }),
      });
      setStaff((current) => current.map((member) => member.id === permissionUserId ? response.staff : member));
      setPermissionOverridesForm(response.staff.permission_overrides || emptyPermissionOverrides);
      setNotice(`User-level access saved for ${response.staff.name}.`);
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
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
      setStaffForm({ id: null, name: '', email: '', password: '', role: 'receptionist' });
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

  const generateFaqDrafts = async () => {
    if (!session?.tenant_id) return;
    setFaqDraftsBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/voice-agent/faq-suggestions`, { method: 'POST' });
      setFaqDrafts(result.faqs || []);
      if (!result.faqs?.length) setNotice('AI did not find a new FAQ supported by the saved clinic information.');
    } catch (draftError) { setError(draftError.message || 'FAQ drafts could not be generated.'); }
    finally { setFaqDraftsBusy(false); }
  };

  const addFaqDraftToClinicContext = (faq) => {
    const context = voiceAgent.clinic_context || defaultVoiceAgent.clinic_context;
    const existingFaqs = context.faqs || [];
    if (existingFaqs.length >= 25) {
      setError('The clinic FAQ limit has been reached. Remove an existing FAQ before adding another.');
      return;
    }
    setVoiceAgent({ ...voiceAgent, clinic_context: { ...context, faqs: [...existingFaqs, faq] } });
    setFaqDrafts((drafts) => drafts.filter((draft) => draft !== faq));
    setNotice('Draft added to the clinic FAQ editor. Review it and save the clinic context to publish it.');
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
    setSubscriptionDateEdits(Object.fromEntries((tenantDataResponse.tenants || []).map((tenant) => [tenant.id, {
      start: tenant.subscription_start_date || '', end: tenant.subscription_end_date || '',
    }])));
    setPlans(planDataResponse.plans || []);
    const apiFeatures = planDataResponse.features || [];
    setProductFeatures([...apiFeatures, ...BILLING_PRODUCT_FEATURES.filter((feature) => !apiFeatures.some((item) => item.id === feature.id))]);
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

  const saveSubscriptionDates = async (tenant) => {
    const dates = subscriptionDateEdits[tenant.id] || {};
    if (!dates.start || !dates.end || dates.end < dates.start) {
      setError('Subscription end date must be on or after its start date.');
      return;
    }
    await updateSubscription(tenant.id, { subscription_start_date: dates.start, subscription_end_date: dates.end });
  };

  const renewSubscription = async (tenant) => {
    const start = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    await updateSubscription(tenant.id, {
      subscription_status: 'active', subscription_start_date: start, subscription_end_date: subscriptionEndDate(start, tenant.billing_cycle),
    });
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
        features: [...new Set(planForm.features || [])],
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
      features: [...(plan.features || [])],
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
        body: JSON.stringify({
          name: patientForm.name,
          phone: patientForm.phone,
          email: patientForm.email?.trim() || '',
          age: patientForm.age ? Number(patientForm.age) : null,
          status: patientForm.status,
          notes: patientForm.notes || '',
        }),
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
    setPatientForm({
      ...emptyPatient,
      name: patient.name || '',
      phone: patient.phone || '',
      email: patient.email || '',
      age: patient.age || '',
      notes: patient.notes || '',
      status: patient.status || 'active',
    });
    setEditingPatientId(patient.id);
    setPatientFormOpen(true);
    setNotice('');
    window.setTimeout(() => document.getElementById('patient-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openAppointmentForPatient = (patient) => {
    setBookingForm({ ...emptyBooking, patient_name: patient.name || '', phone_number: patient.phone || '' });
    setBookingFormOpen(true);
    setActiveView('appointments');
    window.setTimeout(() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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

  const deleteSelectedPatients = async () => {
    if (!session?.tenant_id || !selectedPatientIds.length || (session.role !== 'tenant_admin' && !session.permissions?.includes('patients:manage'))) return;
    const confirmed = await askForConfirmation({
      title: `Delete ${selectedPatientIds.length} patient records?`,
      message: 'The selected patient records will be removed from this clinic workspace.',
      confirmLabel: 'Delete selected patients',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const patientIds = [...selectedPatientIds];
      await Promise.all(patientIds.map((patientId) => request(`/api/tenant/${session.tenant_id}/patients/${encodeURIComponent(patientId)}`, { method: 'DELETE' })));
      setSelectedPatientIds([]);
      setNotice(`${patientIds.length} patient records deleted.`);
      await loadDashboard(session.tenant_id);
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusy(false); }
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
    if (status === 'completed') {
      const appointment = bookings.find((booking) => String(booking.id) === String(appointmentId));
      if (!appointment) return;
      setBillingRequestFor(null);
      const billing = appointment.billing || {};
      setCompletionAppointment(appointment);
      setCompletionForm({
        consultation_fee: billing.consultation_fee ?? '',
        discount_amount: billing.discount_amount ?? '0',
        additional_charges: billing.additional_charges ?? '0',
        amount_paid: billing.amount_paid ?? '',
        payment_method: billing.payment_method || 'cash',
        payment_reference: billing.payment_reference || '',
        completion_notes: billing.completion_notes || '',
        payment_proof_data_url: billing.payment_proof_data_url || '',
        payment_proof_name: billing.payment_proof_name || '',
      });
      setError('');
      setCompletionDialogOpen(true);
      return;
    }
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

  const editTransactionBilling = (transaction) => {
    if (session?.role !== 'tenant_admin' && !session?.permissions?.includes('payments:manage')) return;
    const billing = {
      consultation_fee: transaction.consultation_fee,
      discount_amount: transaction.discount_amount || 0,
      additional_charges: transaction.additional_charges || 0,
      amount_paid: transaction.amount_paid || 0,
      payment_method: transaction.payment_method || 'unpaid',
      payment_reference: transaction.payment_reference || '',
      completion_notes: transaction.completion_notes || '',
      payment_proof_data_url: transaction.payment_proof_data_url || '',
      payment_proof_name: transaction.payment_proof_name || '',
    };
    setCompletionAppointment({ ...transaction, id: transaction.appointment_id, status: 'completed', billing });
    setBillingRequestFor(null);
    setCompletionForm({
      consultation_fee: billing.consultation_fee,
      discount_amount: billing.discount_amount,
      additional_charges: billing.additional_charges,
      amount_paid: billing.amount_paid,
      payment_method: billing.payment_method,
      payment_reference: billing.payment_reference,
      completion_notes: billing.completion_notes,
      payment_proof_data_url: billing.payment_proof_data_url,
      payment_proof_name: billing.payment_proof_name,
    });
    setError('');
    setCompletionDialogOpen(true);
  };

  const deleteTransaction = async (transaction) => {
    if (session?.role !== 'tenant_admin' && !session?.permissions?.includes('payments:manage')) return;
    const confirmed = await askForConfirmation({
      title: 'Delete this payment record?',
      message: `${transaction.transaction_id || 'Unpaid visit'} · ${transaction.patient_name}. The appointment will remain completed, but its billing record will be removed.`,
      confirmLabel: 'Delete payment',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/tenant/${session.tenant_id}/payments/${encodeURIComponent(transaction.appointment_id)}`, { method: 'DELETE' });
      setNotice(`Payment record for appointment ${transaction.appointment_id} was deleted.`);
      await loadDashboard(session.tenant_id);
    } catch (deleteError) { setError(deleteError.message); }
    finally { setBusy(false); }
  };

  const submitAppointmentCompletion = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id || !completionAppointment) return;
    const billing = {
      consultation_fee: Number(completionForm.consultation_fee),
      discount_amount: Number(completionForm.discount_amount || 0),
      additional_charges: Number(completionForm.additional_charges || 0),
      amount_paid: Number(completionForm.amount_paid || 0),
      payment_method: completionForm.payment_method,
      payment_reference: completionForm.payment_reference.trim(),
      completion_notes: completionForm.completion_notes.trim(),
      payment_proof_data_url: completionForm.payment_proof_data_url,
      payment_proof_name: completionForm.payment_proof_name,
    };
    const total = Math.max(0, billing.consultation_fee - billing.discount_amount + billing.additional_charges);
    if (billing.discount_amount > billing.consultation_fee || billing.amount_paid > total) {
      setError(billing.discount_amount > billing.consultation_fee ? 'Discount cannot exceed the consultation fee.' : 'Amount received cannot exceed the final bill.');
      return;
    }
    if (billingRequestFor) {
      setBusy(true); setError(''); setNotice('');
      try {
        await request(`/api/tenant/${session.tenant_id}/payment-change-requests`, { method: 'POST', body: JSON.stringify({
          appointment_id: billingRequestFor.appointment_id,
          message: billingRequestMessage.trim() || 'Please review this requested billing correction.',
          billing,
        }) });
        setCompletionDialogOpen(false); setCompletionAppointment(null); setBillingRequestFor(null); setBillingRequestMessage('');
        setNotice(`Billing change request for ${billingRequestFor.appointment_id} sent to the clinic admin for approval.`);
        await loadDashboard(session.tenant_id);
      } catch (requestError) { setError(requestError.message || 'Could not send the billing change request.'); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/tenant/${session.tenant_id}/appointments/${completionAppointment.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'completed', billing }),
      });
      setCompletionDialogOpen(false);
      setCompletionAppointment(null);
      setNotice(`Appointment ${completionAppointment.id} completed and billing saved.`);
      await loadDashboard(session.tenant_id);
    } catch (completionError) { setError(completionError.message); }
    finally { setBusy(false); }
  };

  const openBillingChangeRequest = (transaction) => {
    const billing = {
      consultation_fee: transaction.consultation_fee,
      discount_amount: transaction.discount_amount || 0,
      additional_charges: transaction.additional_charges || 0,
      amount_paid: transaction.amount_paid || 0,
      payment_method: transaction.payment_method || 'unpaid',
      payment_reference: transaction.payment_reference || '',
      completion_notes: transaction.completion_notes || '',
      payment_proof_data_url: transaction.payment_proof_data_url || '',
      payment_proof_name: transaction.payment_proof_name || '',
    };
    setBillingRequestFor(transaction);
    setBillingRequestMessage('');
    setCompletionAppointment({ ...transaction, id: transaction.appointment_id, status: 'completed' });
    setCompletionForm({ ...billing });
    setError(''); setCompletionDialogOpen(true);
  };

  const reconcilePayment = async (transaction) => {
    if (!session?.tenant_id || transaction.reconciled_at) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/tenant/${session.tenant_id}/payments/${encodeURIComponent(transaction.appointment_id)}/reconcile`, { method: 'PATCH' });
      setNotice(`Ledger entry for ${transaction.appointment_id} matched.`);
      await loadDashboard(session.tenant_id);
    } catch (reconcileError) { setError(reconcileError.message || 'Could not match this ledger entry.'); }
    finally { setBusy(false); }
  };

  const reviewPaymentChangeRequest = async (changeRequest, status) => {
    if (!session?.tenant_id || session?.role !== 'tenant_admin') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/payment-change-requests/${encodeURIComponent(changeRequest.id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(result.message || 'Billing request reviewed.');
      await loadDashboard(session.tenant_id);
    } catch (reviewError) { setError(reviewError.message || 'Could not review this billing request.'); }
    finally { setBusy(false); }
  };

  const addWaitlistEntry = async (event) => {
    event.preventDefault();
    if (!session?.tenant_id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/waitlist`, { method: 'POST', body: JSON.stringify(waitlistForm) });
      setTenantData((current) => ({ ...current, waitlist: [...(current?.waitlist || []), result.entry] }));
      setWaitlistForm(emptyWaitlistEntry);
      setWaitlistFormOpen(false);
      setNotice(`${result.entry.name} added to the cancellation waitlist.`);
    } catch (waitlistError) { setError(waitlistError.message || 'Could not add this patient to the waitlist.'); }
    finally { setBusy(false); }
  };

  const updateWaitlistEntryStatus = async (entryId, status) => {
    if (!session?.tenant_id) return;
    setError(''); setNotice('');
    try {
      const result = await request(`/api/tenant/${session.tenant_id}/waitlist/${entryId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setTenantData((current) => ({ ...current, waitlist: (current?.waitlist || []).map((entry) => entry.id === entryId ? result.entry : entry) }));
      setNotice('Waitlist status updated.');
    } catch (waitlistError) { setError(waitlistError.message || 'Could not update the waitlist status.'); }
  };

  const exportTenantCsv = (kind, appointmentRows = bookings, patientRows = patients) => {
    const rows = kind === 'patients'
      ? [['Patient ID', 'Name', 'Phone', 'Email', 'Age', 'Status'], ...patientRows.map((patient) => [patient.id, patient.name, patient.phone, patient.email || '', patient.age || '', patient.status])]
      : [['Appointment ID', 'Patient', 'Phone', 'Doctor', 'Date', 'Time', 'Reason', 'Status'], ...appointmentRows.map((booking) => [booking.id, booking.patient_name, booking.phone_number, booking.doctor_name, booking.appointment_date, booking.appointment_time, booking.reason || '', booking.status])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const exportPeriod = kind === 'bookings' && appointmentRows !== bookings ? reportMonth : new Date().toISOString().slice(0, 10);
    link.download = `${tenantBrand.domain}-${kind}-${exportPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCsv = (rows = transactions) => {
    const columns = [
      ['Transaction ID', (item) => item.transaction_id || 'Unpaid'], ['Appointment ID', (item) => item.appointment_id],
      ['Patient', (item) => item.patient_name], ['Phone', (item) => item.phone_number], ['Doctor', (item) => item.doctor_name],
      ['Visit date', (item) => item.appointment_date], ['Visit time', (item) => item.appointment_time], ['Visit reason', (item) => item.reason],
      ['Consultation fee', (item) => item.consultation_fee], ['Discount', (item) => item.discount_amount], ['Extra charges', (item) => item.additional_charges],
      ['Total bill', (item) => item.total_amount], ['Received', (item) => item.amount_paid], ['Balance due', (item) => item.balance_due],
      ['Payment method', (item) => item.payment_method], ['Payment status', (item) => item.payment_status], ['Payment reference', (item) => item.payment_reference],
      ['Payment document', (item) => item.payment_proof_data_url ? item.payment_proof_name || 'Attached' : ''],
      ['Recorded by', (item) => item.recorded_by || 'Not captured for this entry'], ['Recorded / updated at', (item) => item.updated_at],
      ['Checkout notes', (item) => item.completion_notes], ['Reconciled by', (item) => item.reconciled_by], ['Reconciled at', (item) => item.reconciled_at],
    ];
    const csvRows = [columns.map(([label]) => label), ...rows.map((item) => columns.map(([, value]) => value(item) ?? ''))];
    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tenantBrand.domain}-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const handlePaymentProofChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WebP payment screenshot.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const qualities = [0.86, 0.78, 0.7, 0.62];
        const dataUrl = qualities.map((quality) => canvas.toDataURL('image/jpeg', quality)).find((value) => value.length <= 650000);
        if (!dataUrl) {
          setError('This screenshot is too large. Choose a smaller image (under 650 KB after compression).');
          return;
        }
        setCompletionForm((current) => ({ ...current, payment_proof_data_url: dataUrl, payment_proof_name: file.name.slice(0, 150) }));
        setError('');
      };
      image.onerror = () => setError('The selected screenshot could not be opened.');
      image.src = String(reader.result || '');
    };
    reader.onerror = () => setError('The selected screenshot could not be opened.');
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
  const todayBookings = bookings.filter((booking) => booking.appointment_date === clinicToday && !['cancelled', 'no_show'].includes(booking.status))
    .sort((left, right) => left.appointment_time.localeCompare(right.appointment_time));
  const todayPlanEntries = session?.role === 'tenant_admin' ? todayBookings : (tenantData?.today_plan?.bookings || []);
  const todayPlanSummary = session?.role === 'tenant_admin' ? {
    scheduled: summary.today_appointments || 0,
    completed: summary.today_completed || 0,
    cancelled: summary.today_cancelled || 0,
  } : (tenantData?.today_plan?.summary || {});
  const clinicWaitlist = tenantData?.waitlist || [];
  const reopenedSlots = bookings.filter((booking) => booking.status === 'cancelled' && booking.appointment_date >= clinicToday)
    .map((booking) => ({
      booking,
      matches: clinicWaitlist.filter((entry) => entry.status === 'waiting'
        && (!entry.preferred_date || entry.preferred_date === booking.appointment_date)
        && (!entry.preferred_time || entry.preferred_time === booking.appointment_time)
        && (!entry.doctor_name || entry.doctor_name.trim().toLocaleLowerCase() === booking.doctor_name.trim().toLocaleLowerCase())),
    }))
    .filter((slot) => slot.matches.length)
    .sort((left, right) => `${left.booking.appointment_date} ${left.booking.appointment_time}`.localeCompare(`${right.booking.appointment_date} ${right.booking.appointment_time}`));
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
  const monthlyBookings = bookings.filter((booking) => String(booking.appointment_date || '').startsWith(reportMonth))
    .sort((left, right) => `${right.appointment_date} ${right.appointment_time}`.localeCompare(`${left.appointment_date} ${left.appointment_time}`));
  const monthlyBookingStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'].map((status) => ({
    status,
    count: monthlyBookings.filter((booking) => booking.status === status).length,
  }));
  const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount) || 0);
  const transactionTotals = transactions.reduce((totals, transaction) => ({
    billed: totals.billed + Number(transaction.total_amount || 0),
    received: totals.received + Number(transaction.amount_paid || 0),
    due: totals.due + Number(transaction.balance_due || 0),
  }), { billed: 0, received: 0, due: 0 });
  const filteredTransactions = transactions.filter((transaction) => {
    const query = transactionQuery.trim().toLowerCase();
    const matchesQuery = !query || [transaction.transaction_id, transaction.appointment_id, transaction.patient_name, transaction.phone_number, transaction.doctor_name, transaction.reason, transaction.payment_reference, transaction.recorded_by]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const matchesStatus = transactionStatusFilter === 'all' || transaction.payment_status === transactionStatusFilter;
    const matchesMethod = transactionMethodFilter === 'all' || (transaction.payment_method || 'unpaid') === transactionMethodFilter;
    const matchesDate = transactionDateFilter === 'all'
      || (transactionDateFilter === 'today' && transaction.appointment_date === clinicToday)
      || (transactionDateFilter === 'month' && String(transaction.appointment_date || '').startsWith(clinicToday.slice(0, 7)));
    return matchesQuery && matchesStatus && matchesMethod && matchesDate;
  });
  const feeTransactions = transactions.filter((transaction) => feePeriod === 'today'
    ? transaction.appointment_date === clinicToday
    : String(transaction.appointment_date || '').startsWith(clinicToday.slice(0, 7)));
  const feeTotals = feeTransactions.reduce((totals, transaction) => ({
    billed: totals.billed + Number(transaction.total_amount || 0),
    received: totals.received + Number(transaction.amount_paid || 0),
    due: totals.due + Number(transaction.balance_due || 0),
    matched: totals.matched + (transaction.reconciled_at ? Number(transaction.amount_paid || 0) : 0),
  }), { billed: 0, received: 0, due: 0, matched: 0 });
  const bookingsForPatient = (patient) => bookings.filter((booking) => {
    const bookingPatientId = String(booking.patient_id || '');
    if (bookingPatientId) return bookingPatientId === String(patient.id);
    const patientPhone = String(patient.phone || '').replace(/\D/g, '');
    const bookingPhone = String(booking.phone_number || '').replace(/\D/g, '');
    if (patientPhone && bookingPhone) return patientPhone === bookingPhone;
    return String(booking.patient_name || '').trim().toLocaleLowerCase() === String(patient.name || '').trim().toLocaleLowerCase();
  });
  const selectedPatient = patients.find((patient) => String(patient.id) === String(selectedPatientId));
  const selectedPatientBookings = selectedPatient
    ? bookingsForPatient(selectedPatient).sort((left, right) => `${right.appointment_date} ${right.appointment_time}`.localeCompare(`${left.appointment_date} ${left.appointment_time}`))
    : [];
  const selectedPatientUpcoming = selectedPatientBookings.filter((booking) => booking.appointment_date >= clinicToday && !['cancelled', 'no_show'].includes(booking.status)).sort((left, right) => `${left.appointment_date} ${left.appointment_time}`.localeCompare(`${right.appointment_date} ${right.appointment_time}`))[0];
  const formatPatientDate = (value) => {
    if (!value) return '—';
    const parsedDate = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const filteredPatients = patients.filter((patient) => {
    const query = patientQuery.trim().toLowerCase();
    const searchableValues = [patient.id, patient.name, patient.phone, patient.email, patient.age, patient.status];
    const matchesQuery = !query || searchableValues
      .some((value) => String(value || '').toLowerCase().includes(query));
    const patientBookings = bookingsForPatient(patient);
    const hasTodayBooking = patientBookings.some((booking) => booking.appointment_date === clinicToday && !['cancelled', 'no_show'].includes(booking.status));
    const hasUpcomingBooking = patientBookings.some((booking) => booking.appointment_date >= clinicToday && !['cancelled', 'no_show'].includes(booking.status));
    const matchesDate = activeView !== 'overview' || patientDateFilter === 'all'
      || (patientDateFilter === 'today' && hasTodayBooking)
      || (patientDateFilter === 'upcoming' && hasUpcomingBooking);
    return matchesQuery && matchesDate && (patientStatusFilter === 'all' || String(patient.status || '').toLowerCase() === patientStatusFilter);
  });
  const filteredStaff = staff.filter((member) => {
    const query = staffQuery.trim().toLowerCase();
    const searchable = STAFF_TABLE_COLUMNS.filter((column) => staffColumns.includes(column.key)).map((column) => column.value(member));
    const matchesQuery = !query || searchable.some((value) => String(value || '').toLowerCase().includes(query));
    const matchesRole = staffRoleFilter === 'all' || member.role === staffRoleFilter;
    return matchesQuery && matchesRole;
  });
  const displayedPatients = [...filteredPatients].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
  const clinicInterestPagination = useListPagination(clinicInterests, `leads:${activeView}`);
  const tenantPagination = useListPagination(tenants, `tenants:${activeView}`);
  const subscriptionTenantPagination = useListPagination(tenants, `subscriptions:${activeView}`);
  const planPagination = useListPagination(plans, `plans:${activeView}`);
  const staffPagination = useListPagination(filteredStaff, `staff:${activeView}:${session?.tenant_id || ''}:${staffQuery}:${staffRoleFilter}:${staffColumns.join(',')}`);
  const doctorPagination = useListPagination(tenantData?.doctors || [], `doctors:${activeView}:${session?.tenant_id || ''}`);
  const appointmentPagination = useListPagination(filteredBookings, `appointments:${activeView}:${appointmentQuery}:${appointmentStatusFilter}:${appointmentDateFilter}`);
  const monthlyBookingPagination = useListPagination(monthlyBookings, `monthly-bookings:${reportMonth}`);
  const patientPagination = useListPagination(activeView === 'overview' ? displayedPatients : filteredPatients, `patients:${activeView}:${patientQuery}:${patientStatusFilter}:${patientDateFilter}:${patientOverviewColumns.join(',')}`);
  const transactionPagination = useListPagination(filteredTransactions, `transactions:${activeView}:${transactionQuery}:${transactionStatusFilter}:${transactionMethodFilter}:${transactionDateFilter}`);
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

  const renderRecentPatients = () => {
    const recentRows = patientPagination.items;
    const canManagePatients = session?.role === 'tenant_admin' || session?.permissions?.includes('patients:manage');
    const canViewPatients = session?.role === 'tenant_admin' || session?.permissions?.some((permission) => ['patients:view', 'patients:manage', 'reports:view'].includes(permission));
    if (!canViewPatients) return null;
    const selectedRows = patients.filter((patient) => selectedPatientIds.includes(String(patient.id)));
    const allPageSelected = recentRows.length > 0 && recentRows.every((patient) => selectedPatientIds.includes(String(patient.id)));
    const togglePatientSelection = (patientId) => setSelectedPatientIds((current) => current.includes(String(patientId)) ? current.filter((id) => id !== String(patientId)) : [...current, String(patientId)]);
    const togglePageSelection = () => setSelectedPatientIds((current) => allPageSelected
      ? current.filter((id) => !recentRows.some((patient) => String(patient.id) === id))
      : [...new Set([...current, ...recentRows.map((patient) => String(patient.id))])]);

    return <section className="tenant-insight-panel recent-patients-panel" aria-labelledby="recent-patients-heading">
      <div className="admin-panel-heading"><div><h3 id="recent-patients-heading">Recent patients</h3><p>{filteredPatients.length} patients match the current filters.</p></div><div className="d-flex flex-wrap gap-2">
        {canManagePatients && <button type="button" className="btn btn-sm btn-primary" onClick={() => { setPatientForm(emptyPatient); setEditingPatientId(null); setPatientFormOpen(true); setActiveView('patients'); }}>＋ Add patient</button>}
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setActiveView('patients')}>Patient directory</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!selectedRows.length} onClick={() => exportTenantCsv('patients', bookings, selectedRows)}>Export selected</button>
        {canManagePatients && <button type="button" className="btn btn-sm btn-outline-danger" disabled={!selectedRows.length || busy} onClick={deleteSelectedPatients}>Delete selected</button>}
      </div></div>
      <div className="workspace-table-tools recent-patients-tools">
        <div className="workspace-search"><label className="visually-hidden" htmlFor="recent-patient-search">Search recent patients</label><span aria-hidden="true">⌕</span><input id="recent-patient-search" className="form-control" placeholder="Search patients" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} /></div>
        <select className="form-select workspace-status-filter" aria-label="Filter recent patients by status" value={patientStatusFilter} onChange={(event) => setPatientStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <div className="workspace-filter-pills" role="group" aria-label="Recent patient visit filter">{[['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All patients']].map(([value, label]) => <button type="button" key={value} className={patientDateFilter === value ? 'active' : ''} aria-pressed={patientDateFilter === value} onClick={() => setPatientDateFilter(value)}>{label}</button>)}</div>
        <details className="patient-column-picker"><summary className="btn btn-sm btn-outline-secondary patient-icon-trigger" aria-label="Choose columns" title="Choose columns"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="5" height="14" rx="1"/><rect x="10" y="5" width="4" height="14" rx="1"/><rect x="15" y="5" width="5" height="14" rx="1"/></svg></summary><div className="patient-column-picker-menu" role="group" aria-label="Choose recent patient columns">{PATIENT_TABLE_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={patientOverviewColumns.includes(column.key)} disabled={patientOverviewColumns.length === 1 && patientOverviewColumns.includes(column.key)} onChange={() => setPatientOverviewColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} /> {column.label}</label>)}</div></details>
        <button type="button" className={`btn btn-sm btn-outline-secondary patient-icon-trigger ${selectedRows.length ? 'has-active-selection' : ''}`} aria-label="Clear selection" title="Clear selection" disabled={!selectedRows.length} onClick={() => setSelectedPatientIds([])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 17 17M17 7 7 17"/><circle cx="12" cy="12" r="9"/></svg></button>
      </div>
      <div className="recent-patient-bulk-actions" aria-live="polite"><span>{selectedPatientIds.length} selected</span></div>
      <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th><input className="form-check-input" type="checkbox" aria-label="Select all patients on this page" checked={allPageSelected} onChange={togglePageSelection} /></th>{PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>
        {recentRows.length ? recentRows.map((patient) => <tr key={patient.id} className={selectedPatientIds.includes(String(patient.id)) ? 'recent-patient-selected' : ''}><td><input className="form-check-input" type="checkbox" aria-label={`Select ${patient.name}`} checked={selectedPatientIds.includes(String(patient.id))} onChange={() => togglePatientSelection(patient.id)} /></td>{PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)).map((column) => <td key={column.key}>{column.key === 'status' ? <span className={`status-pill ${patient.status === 'active' ? 'confirmed' : 'cancelled'}`}>{patient.status || 'active'}</span> : column.value(patient) || '—'}</td>)}<td className="text-nowrap"><button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => { setSelectedPatientId(String(patient.id)); setActiveView('patients'); }}>View</button>{canManagePatients && <><button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => { editPatient(patient); setActiveView('patients'); }}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deletePatient(patient.id)}>Delete</button></>}</td></tr>) : <tr><td colSpan={PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)).length + 2} className="text-muted py-4">{patients.length ? 'No patients match those filters.' : 'No patients yet.'}</td></tr>}
      </tbody></table></div>
      <ListPagination pagination={patientPagination} label="patients" />
    </section>;
  };

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
      {session?.role !== 'tenant_admin' && (session?.permissions || []).includes('overview:today_plan') && <div className="row g-4 mb-4">
        <div className="col-12"><section className="tenant-insight-panel">
          <div className="admin-panel-heading"><div><h3>Today’s clinic plan</h3><p>{todayPlanSummary.scheduled || 0} scheduled visits · {todayPlanSummary.completed || 0} completed · {todayPlanSummary.cancelled || 0} cancelled</p></div>{availableClinicViews(session, tenantData?.plan_features).includes('appointments') && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setAppointmentDateFilter('today'); setActiveView('appointments'); }}>Open today’s schedule</button>}</div>
          {todayPlanEntries.length ? <div className="agenda-list">{todayPlanEntries.slice(0, 8).map((booking, index) => <div className="agenda-row" key={booking.id || `${booking.patient_name}-${booking.appointment_time}-${index}`}><div className="agenda-date"><strong>{booking.appointment_time}</strong><small>{booking.doctor_name}</small></div><div className="agenda-details"><strong>{booking.patient_name}</strong></div><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div>)}{todayPlanEntries.length > 8 && <p className="small text-muted mb-0 mt-2">Showing 8 of {todayPlanEntries.length} visits. Open today’s schedule to see the full list.</p>}</div> : <div className="empty-insight">No visits are scheduled for today.</div>}
        </section></div>
      </div>}
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
      <div className="row g-4 mb-4"><div className="col-12">{renderRecentPatients()}</div></div>
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
          <div className="small mt-2">Includes: {(plan.features || []).map((feature) => productFeatures.find((item) => item.id === feature)?.label || feature).join(' · ') || 'No product modules'}</div>
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
          <fieldset className="border rounded-3 p-3 mt-3"><legend className="float-none w-auto px-2 fs-6 fw-semibold">Included features</legend><div className="row g-2">{productFeatures.map((feature) => <div className="col-md-6 col-xl-4" key={feature.id}><label className="border rounded-3 p-3 h-100 d-flex align-items-start gap-2"><input className="form-check-input mt-1" type="checkbox" disabled={feature.id === 'dashboard'} checked={planForm.features.includes(feature.id)} onChange={(event) => { const next = new Set(planForm.features); if (event.target.checked) next.add(feature.id); else next.delete(feature.id); setPlanForm({ ...planForm, features: [...next] }); }} /><span><strong>{feature.label}{feature.id === 'dashboard' ? ' · Included' : ''}</strong><small className="d-block text-muted">{feature.description}</small></span></label></div>)}</div></fieldset>
          <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingPlanId ? 'Save plan' : 'Create plan'}</button>{editingPlanId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingPlanId(null); setPlanForm(emptyPlan); }}>Cancel</button>}</div>
        </form>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h3>Subscription register</h3><p>Plan and billing changes apply immediately.</p></div></div>
        <div className="table-responsive"><table className="table align-middle mb-0">
          <thead><tr><th>Clinic</th><th>Plan</th><th>Billing</th><th>Start date</th><th>End date</th><th>Monthly value</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{subscriptionTenantPagination.items.map((tenant) => <tr key={tenant.id}>
            <td><div className="fw-semibold">{tenant.name}</div><small><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></small></td>
            <td><select className="form-select form-select-sm plan-select" aria-label={`Plan for ${tenant.name}`} value={tenant.plan} onChange={(event) => updateSubscription(tenant.id, { plan: event.target.value })}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></td>
            <td><select className="form-select form-select-sm cycle-select" aria-label={`Billing cycle for ${tenant.name}`} value={tenant.billing_cycle} onChange={(event) => updateSubscription(tenant.id, { billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></td>
            <td><input aria-label={`Subscription start date for ${tenant.name}`} className="form-control form-control-sm" type="date" value={subscriptionDateEdits[tenant.id]?.start || ''} onChange={(event) => setSubscriptionDateEdits((current) => ({ ...current, [tenant.id]: { ...(current[tenant.id] || {}), start: event.target.value } }))} /></td>
            <td><div className="d-flex gap-1"><input aria-label={`Subscription end date for ${tenant.name}`} className="form-control form-control-sm" type="date" value={subscriptionDateEdits[tenant.id]?.end || ''} onChange={(event) => setSubscriptionDateEdits((current) => ({ ...current, [tenant.id]: { ...(current[tenant.id] || {}), end: event.target.value } }))} /><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => saveSubscriptionDates(tenant)}>Save</button></div></td>
            <td>{formatCurrency(tenant.monthly_price)}<small className="d-block text-muted">per month equivalent</small></td>
            <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
            <td>{tenant.subscription_status === 'active' ? <button className="btn btn-sm btn-outline-warning" onClick={() => updateSubscription(tenant.id, { subscription_status: 'paused' })}>Pause</button> : tenant.subscription_status === 'paused' && (!tenant.subscription_end_date || tenant.subscription_end_date >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) ? <button className="btn btn-sm btn-outline-success" onClick={() => updateSubscription(tenant.id, { subscription_status: 'active' })}>Resume</button> : <button className="btn btn-sm btn-outline-success" onClick={() => renewSubscription(tenant)}>Renew</button>}</td>
          </tr>)}{tenants.length === 0 && <tr><td colSpan="8" className="text-muted py-4">No subscriptions to manage.</td></tr>}</tbody>
        </table></div>
        <ListPagination pagination={subscriptionTenantPagination} label="clinics" />
      </section>
    </>
  );

  const renderAdminPayments = () => {
    const paymentRows = tenants.map((tenant) => {
      const plan = plans.find((item) => item.id === tenant.plan);
      const cycle = tenant.billing_cycle === 'annual' ? 'annual' : 'monthly';
      const amount = Number(cycle === 'annual' ? plan?.annual_price : plan?.monthly_price) || 0;
      return { tenant, plan, cycle, amount };
    }).sort((left, right) => String(left.tenant.name).localeCompare(String(right.tenant.name)));
    const activeRows = paymentRows.filter(({ tenant }) => tenant.subscription_status === 'active');
    const monthlyEquivalent = activeRows.reduce((sum, { amount, cycle }) => sum + (cycle === 'annual' ? amount / 12 : amount), 0);
    const yearlyCommitment = activeRows.reduce((sum, { amount, cycle }) => sum + (cycle === 'annual' ? amount : amount * 12), 0);
    return <>
      <div className="admin-panel-heading subscription-title"><div><h3>Clinic subscription payments</h3><p>Review each clinic’s plan price, billing cycle, and subscription period.</p></div><button className="btn btn-sm btn-outline-primary" onClick={() => setActiveView('subscriptions')}>Manage plans</button></div>
      <div className="row g-3 mb-4">
        {[['Active monthly equivalent', formatCurrency(monthlyEquivalent), 'Active subscriptions; annual plans normalized monthly'], ['Active annual commitment', formatCurrency(yearlyCommitment), 'Monthly subscriptions projected over 12 months'], ['Clinics with subscriptions', paymentRows.length, `${activeRows.length} active · ${paymentRows.length - activeRows.length} paused or inactive`]].map(([label, value, hint]) => <div className="col-md-4" key={label}><div className="admin-metric"><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></div>)}
      </div>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h3>Subscription ledger</h3><p>Plan pricing is the subscription amount. Payment collection and invoice history are not recorded in this system.</p></div></div>
        <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Clinic / tenant</th><th>Plan</th><th>Billing cycle</th><th>Subscription amount</th><th>Monthly equivalent</th><th>Period</th><th>Status</th><th>Manage</th></tr></thead><tbody>
          {paymentRows.length ? paymentRows.map(({ tenant, plan, cycle, amount }) => <tr key={tenant.id}>
            <td className="fw-semibold">{tenant.name}<small className="d-block text-muted">{tenant.domain} · {tenant.admin_email}</small></td>
            <td>{plan?.name || tenant.plan || '—'}</td><td className="text-capitalize">{cycle}</td>
            <td>{formatCurrency(amount)}<small className="d-block text-muted">{cycle === 'annual' ? 'billed yearly' : 'billed monthly'}</small></td>
            <td>{formatCurrency(cycle === 'annual' ? amount / 12 : amount)}</td>
            <td>{tenant.subscription_start_date || '—'}<small className="d-block text-muted">to {tenant.subscription_end_date || '—'}</small></td>
            <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status || 'inactive'}</span></td>
            <td className="text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => { setActiveView('tenants'); editTenant(tenant); }}>Edit subscription</button><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => tenant.subscription_status === 'expired' ? renewSubscription(tenant) : updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : tenant.subscription_status === 'expired' ? 'Renew' : 'Activate'}</button></td>
          </tr>) : <tr><td colSpan="8" className="text-muted py-4">No tenant subscriptions yet.</td></tr>}
        </tbody></table></div>
      </section>
    </>;
  };

  const renderLanding = () => (
    <div className="site-shell">
      <nav className="site-nav">
        <a className="site-wordmark" href="#top" aria-label="Carestac home"><span className="wordmark-symbol">C</span><span>care<span>stac</span></span></a>
        <div className="site-nav-links"><a href="#platform">Platform</a><a href="#intelligence">AI workflow</a><a href="#plans">Plans</a><a href="#for-clinics">For clinics</a></div>
        <div className="site-nav-actions"><button className="nav-login" onClick={() => openLogin('tenant')}>Clinic sign in</button><button className="nav-admin" onClick={() => openLogin('super_admin')}>Platform admin <span aria-hidden="true">↗</span></button></div>
      </nav>

      <main id="top">
        <section className="brand-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> CLINIC OPERATIONS, IN SYNC</div>
            <h1>More time for care.<br /><em>Less time</em> between the call and the clinic.</h1>
            <p className="hero-description">Carestac brings patient intake, appointment coordination and clinic operations into one calm, connected workspace, with AI agents helping turn conversations into confirmed visits.</p>
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
          <p className="section-kicker">THE CARESTAC APPROACH</p>
          <div className="intro-grid"><h2>One thoughtful system.<br /><span>From first hello to follow-up.</span></h2><p>Clinics shouldn’t have to stitch together phone notes, patient lists and appointment calendars. Carestac gives each organization a branded home for the work, while a shared platform keeps the operation clear.</p></div>
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
            <ul><li>{plan.clinic_limit || 'Unlimited'} {plan.clinic_limit === 1 ? 'clinic' : 'clinics'}</li><li>{plan.user_limit || 'Unlimited'} team members</li>{(plan.features || []).map((feature) => <li key={feature}>{productFeatures.find((item) => item.id === feature)?.label || feature}</li>)}</ul>
            <button className={plan.id === 'growth' ? 'button-dark' : 'button-outline'} onClick={() => { setClinicInterestForm({ ...emptyClinicInterest, plan: plan.id }); document.getElementById('clinic-request')?.scrollIntoView({ behavior: 'smooth' }); }}>Request {plan.name} <span aria-hidden="true">→</span></button>
          </article>)}</div>
          <ListPagination pagination={marketedPlanPagination} label="plans" />
          <div className="clinic-request-card" id="clinic-request">
            <div><p className="section-kicker">GET YOUR CLINIC STARTED</p><h3>See how Carestac fits your front desk.</h3><p>Send a short request and our team can help set up your clinic workspace and calling line.</p></div>
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

      <footer className="site-footer"><a className="site-wordmark" href="#top"><span className="wordmark-symbol">C</span><span>care<span>stac</span></span></a><span>AI-assisted clinic operations · India · © {new Date().getFullYear()} Carestac. All rights reserved.</span><button onClick={() => openLogin('super_admin')}>Platform admin</button></footer>

      {loginOpen && <div className="login-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false); }}>
        <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-heading">
          <button className="login-close" aria-label="Close sign in" onClick={() => setLoginOpen(false)}>×</button>
          <div className="login-brand"><img src={carestacMark} alt="Carestac" /></div>
          <h2 id="login-heading">{loginMode === 'login' ? 'Welcome back.' : loginMode === 'forgot' ? 'Reset your password.' : loginMode === 'reset' ? 'Choose a new password.' : 'Secure your account.'}</h2>
          <p className="login-subtitle">{loginMode === 'login' ? 'Choose your workspace to continue.' : loginMode === 'forgot' ? 'We’ll email a short reset code if this account exists.' : loginMode === 'reset' ? 'Enter the code sent to your account email.' : 'Your one-time password has been used. Set a new password to continue.'}</p>
          {loginMode === 'login' && <>
            <div className="login-role-switch" role="tablist" aria-label="Choose sign-in type"><button role="tab" aria-selected={loginRole === 'tenant'} className={loginRole === 'tenant' ? 'selected' : ''} onClick={() => openLogin('tenant')}>Clinic admin or staff</button><button role="tab" aria-selected={loginRole === 'super_admin'} className={loginRole === 'super_admin' ? 'selected' : ''} onClick={() => openLogin('super_admin')}>Platform admin</button></div>
            <div className="login-clinic-label"><span>{loginRole === 'tenant' ? 'CLINIC WORKSPACE' : 'PLATFORM CONTROL'}</span><strong>{loginRole === 'tenant' ? tenantBrand.name : 'Carestac platform'}</strong>{loginRole === 'tenant' && <small>{tenantBrand.domain}</small>}</div>
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
                  <img className="auth-logo" src={carestacMark} alt="Carestac" />
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
    const canReconcilePayments = clinicAdmin || grantedPermissions.has('payments:reconcile') || grantedPermissions.has('payments:manage');
    const selectedTransactionRows = transactions.filter((transaction) => selectedTransactionIds.includes(String(transaction.appointment_id)));
    const allTransactionPageSelected = transactionPagination.items.length > 0 && transactionPagination.items.every((transaction) => selectedTransactionIds.includes(String(transaction.appointment_id)));
    const toggleTransactionSelection = (appointmentId) => setSelectedTransactionIds((current) => current.includes(String(appointmentId)) ? current.filter((id) => id !== String(appointmentId)) : [...current, String(appointmentId)]);
    const toggleTransactionPageSelection = () => setSelectedTransactionIds((current) => allTransactionPageSelected
      ? current.filter((id) => !transactionPagination.items.some((transaction) => String(transaction.appointment_id) === id))
      : [...new Set([...current, ...transactionPagination.items.map((transaction) => String(transaction.appointment_id))])]);
    const transactionCell = (transaction, key) => {
      if (['consultation_fee', 'discount_amount', 'additional_charges', 'total_amount', 'amount_paid', 'balance_due'].includes(key)) return formatINR(transaction[key]);
      if (key === 'recorded_by') return transaction.recorded_by || 'Not captured';
      if (key === 'payment_proof_name') return transaction.payment_proof_data_url ? transaction.payment_proof_name || 'Attached' : '—';
      if (key === 'transaction_id') return transaction.transaction_id || 'Unpaid';
      if (key === 'payment_method') return String(transaction.payment_method || 'unpaid').replaceAll('_', ' ');
      if (key === 'payment_status') return <span className={`status-pill ${transaction.payment_status === 'paid' ? 'completed' : transaction.payment_status === 'partial' ? 'confirmed' : 'cancelled'}`}>{transaction.payment_status || 'unpaid'}</span>;
      if (key === 'updated_at' || key === 'reconciled_at') return transaction[key] ? new Date(transaction[key]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';
      if (key === 'reconciled_by') return transaction.reconciled_by || '—';
      return transaction[key] || '—';
    };
    const selectedAppointmentRows = bookings.filter((booking) => selectedAppointmentIds.includes(String(booking.id)));
    const allAppointmentPageSelected = appointmentPagination.items.length > 0 && appointmentPagination.items.every((booking) => selectedAppointmentIds.includes(String(booking.id)));
    const toggleAppointmentSelection = (appointmentId) => setSelectedAppointmentIds((current) => current.includes(String(appointmentId)) ? current.filter((id) => id !== String(appointmentId)) : [...current, String(appointmentId)]);
    const toggleAppointmentPageSelection = () => setSelectedAppointmentIds((current) => allAppointmentPageSelected
      ? current.filter((id) => !appointmentPagination.items.some((booking) => String(booking.id) === id))
      : [...new Set([...current, ...appointmentPagination.items.map((booking) => String(booking.id))])]);
    const planFeatureSet = new Set(tenantData?.plan_features || []);
    const hasPlanFeature = (feature) => !Array.isArray(tenantData?.plan_features) || planFeatureSet.has(feature);
    const workspaceNavigation = superAdmin
      ? [['overview', 'Overview', '⌂'], ['leads', 'Clinic requests', '✳'], ['tenants', 'Tenants', '▦'], ['payments', 'Payments', '₹'], ['subscriptions', 'Plans & subscriptions', '◈']]
      : [
        ['overview', 'Overview', '⌂', 'overview:view'], ['agents', 'AI receptionist', '◉', 'agents:view'],
        ['doctors', 'Doctors', '✚', 'doctors:view', 'doctors:manage'], ['patients', 'Patients', '♙', 'patients:view', 'patients:manage'],
        ['appointments', 'Appointments', '▣', 'appointments:view', 'appointments:manage'], ['payments', 'Payments & transactions', '₹', 'payments:view', 'payments:manage'], ['fees', 'Fees reconciliation', '⇄', '', 'payments:manage', 'payments:reconcile'], ['reports', 'Reports', '▥', 'reports:view'],
      ].filter(([view, , , viewPermission, managePermission, reconcilePermission]) => {
        const requiredFeature = { agents: 'ai_receptionist', doctors: 'doctors', patients: 'patients', appointments: 'appointments', payments: 'payment_transactions', fees: 'fee_reconciliation', reports: 'reports' }[view];
        const requiredFeaturesIncluded = hasPlanFeature(requiredFeature) && (['payments', 'fees'].includes(view) ? hasPlanFeature('appointments') : true);
        return view === 'overview' || (requiredFeaturesIncluded && (clinicAdmin || (viewPermission && grantedPermissions.has(viewPermission)) || (managePermission && grantedPermissions.has(managePermission)) || (reconcilePermission && grantedPermissions.has(reconcilePermission)) || grantedPermissions.has('overview:today_plan')));
      })
        .map(([view, label, icon]) => [view, label, icon])
        .concat(clinicAdmin && hasPlanFeature('staff_accounts') ? [['staff', 'Staff accounts', '♧'], ['permissions', 'Roles & permissions', '☷']] : []);
    const pageTitle = superAdmin
      ? activeView === 'overview' ? 'Platform overview' : activeView === 'subscriptions' ? 'Plans & subscriptions' : activeView === 'leads' ? 'Clinic requests' : activeView === 'payments' ? 'Clinic payments' : 'Tenant management'
      : activeView === 'overview' ? 'Good to see you' : activeView === 'reports' ? 'Clinic reports' : activeView === 'agents' ? 'AI receptionist' : activeView === 'doctors' ? 'Doctor directory' : activeView === 'patients' ? 'Patient directory' : activeView === 'payments' ? 'Payments & transactions' : activeView === 'fees' ? 'Fees reconciliation' : activeView === 'staff' ? 'Staff accounts' : activeView === 'permissions' ? 'Staff permissions' : 'Appointments';
    const workspacePlan = String(tenantData?.plan || '').replace(/\b\w/g, (char) => char.toUpperCase());
    const workspaceRegion = String(tenantData?.region || '').trim();
    const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: voiceAgent.timezone || 'Asia/Kolkata' }).format(new Date());

    return (
      <div className={`page-shell dashboard-shell ${superAdmin ? 'admin-workspace' : 'clinic-workspace'}`}>
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <a className="workspace-brand" href="/" onClick={(event) => { event.preventDefault(); setActiveView('overview'); }} aria-label={`${superAdmin ? 'Carestac' : tenantBrand.shortName} workspace home`}><span className="workspace-brand-mark">{superAdmin ? 'C' : tenantBrand.shortName.charAt(0).toUpperCase()}</span><span>{superAdmin ? 'Carestac' : tenantBrand.shortName}<small>{superAdmin ? 'PLATFORM WORKSPACE' : 'CLINIC WORKSPACE'}</small></span></a>
            <div className="sidebar-clinic-card"><span className="clinic-avatar">{superAdmin ? 'C' : tenantBrand.shortName.charAt(0)}</span><span><strong title={superAdmin ? 'Carestac platform' : displayedTenant}>{superAdmin ? 'Carestac platform' : displayedTenant}</strong><small>{superAdmin ? 'Super admin workspace' : workspacePlan ? `${workspacePlan} plan${workspaceRegion ? ` · ${workspaceRegion}` : ''}` : `${workspaceRegion || 'Clinic'} workspace`}</small></span><i aria-hidden="true">⌄</i></div>
            <p className="sidebar-section-label">WORKSPACE</p>
            <nav className="workspace-nav" aria-label="Workspace navigation">
              {workspaceNavigation.map(([view, label, icon]) => (
                <button key={view} className={`workspace-nav-link ${activeView === view ? 'active' : ''}`} aria-current={activeView === view ? 'page' : undefined} onClick={() => { setActiveView(view); setError(''); setNotice(''); if (view === 'staff' || view === 'permissions') loadStaff(); }}>
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
              <div className="workspace-location"><span className="location-dot" /><span className="workspace-location-tenant" title={superAdmin ? 'Carestac platform' : displayedTenant}>{superAdmin ? 'Carestac platform' : displayedTenant}</span><span className="location-divider">/</span><span>{workspaceNavigation.find(([view]) => view === activeView)?.[1]}</span></div>
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
                <div><p className="workspace-date">{todayLabel}</p><h1>{pageTitle}<span className="heading-period">.</span></h1><p>{superAdmin ? 'A clear view of your clinic network and operations.' : activeView === 'overview' ? 'Here’s what’s happening across your clinic today.' : activeView === 'appointments' ? 'Manage the day, keep visits moving, and stay on top of follow-ups.' : activeView === 'patients' ? 'Search and manage your clinic’s patient records.' : activeView === 'doctors' ? 'Manage the clinic roster used by availability checks and the voice agent.' : activeView === 'agents' ? 'Tune the information and voice experience your patients receive.' : activeView === 'payments' ? 'Review completed visits, payment methods, and outstanding balances.' : activeView === 'fees' ? 'Match completed visit payments against the daily or monthly clinic ledger.' : 'Track clinic activity and export the records your team needs.'}</p></div>
              </div>

              {(notice || error) && <div className={`alert ${error ? 'alert-danger' : 'alert-success'} alert-dismissible`} role="status">
                {error || notice}
                <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => { setError(''); setNotice(''); }} />
              </div>}

              {!superAdmin && activeView === 'overview' && renderTenantOverview()}

              {!superAdmin && activeView === 'agents' && (clinicAdmin ? <div className="row g-4">
                <div className="col-12"><section className="tenant-insight-panel">
                  <div className="admin-panel-heading"><div><h3>AI clinic FAQ assistant</h3><p>Draft helpful caller questions and answers from this clinic’s saved information.</p></div><span className="status-pill confirmed">AI assisted</span></div>
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3"><p className="small text-muted mb-0">Suggestions are drafts. AI uses clinic facts only—no patient data or call transcripts—and will not publish anything automatically. Uses the server’s Groq free tier, with a daily clinic limit.</p><button type="button" className="btn btn-primary" disabled={faqDraftsBusy} onClick={generateFaqDrafts}>{faqDraftsBusy ? 'Drafting FAQs…' : 'Generate FAQ drafts'}</button></div>
                  {faqDrafts.length > 0 && <div className="agenda-list mt-3">{faqDrafts.map((faq, index) => <div className="agenda-row align-items-start" key={`${faq.question}-${index}`}>
                    <span className="agenda-index" aria-hidden="true">Q</span><div><strong>{faq.question}</strong><small>{faq.answer}</small></div><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addFaqDraftToClinicContext(faq)}>Add draft</button>
                  </div>)}</div>}
                  <p className="small text-muted mt-3 mb-0">Review each answer for accuracy. Added drafts appear in the FAQ editor below; click “Save clinic agent context” to make them available to your booking agent.</p>
                </section></div>
                <div className="col-12"><section id="clinic-call-number" className="tenant-insight-panel clinic-call-number">
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
                <div className="col-xl-5"><section id="agent-settings" className="tenant-insight-panel h-100">
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
              {superAdmin && activeView === 'payments' && renderAdminPayments()}
              {superAdmin && activeView === 'leads' && <div className="card border-0 shadow-sm rounded-4 mb-4"><div className="card-body"><h4 className="mb-1">New clinic interest</h4><p className="text-muted mb-3">Follow up with clinics that requested subscription information or a demo.</p><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Clinic</th><th>Contact</th><th>Phone</th><th>Plan</th><th>Received</th></tr></thead><tbody>{clinicInterests.length ? clinicInterestPagination.items.map((lead) => <tr key={lead.id}><td className="fw-semibold">{lead.clinic_name}<small className="d-block text-muted">{lead.email}</small></td><td>{lead.contact_name}</td><td><a href={`tel:${lead.phone}`}>{lead.phone}</a></td><td className="text-capitalize">{lead.plan}</td><td>{new Date(lead.created_at).toLocaleDateString('en-IN')}</td></tr>) : <tr><td colSpan="5" className="text-muted py-4">No clinic requests yet.</td></tr>}</tbody></table></div><ListPagination pagination={clinicInterestPagination} label="clinic requests" /></div></div>}

              {superAdmin && activeView === 'tenants' && <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body">
                  <h4 className="mb-3">Tenant organizations</h4>
                  {voiceToolSecret && <div className="alert alert-info" role="status"><strong>Connect this clinic’s Exotel IVR to Carestac booking</strong><p className="mb-2">This clinic-scoped secret lets the Exotel Voicebot call its Carestac tools. Copy it into the Exotel tool’s <code>x-voice-tool-secret</code> header. If Exotel has no header value field, add POST body parameter tool_secret and set it as a Constant Value in the attached tool, never an LLM prompt. The API validates it for the URL tenant and strips it before processing; use HTTPS.</p><label className="form-label">Exotel reachable API base URL</label><input className="form-control font-monospace mb-2" value={voiceToolApiBaseUrl} onChange={(event) => { const value = event.target.value.trim().replace(/\/+$/, ''); setVoiceToolApiBaseUrl(value); try { localStorage.setItem('carestack-voice-tool-api-base-url', value); } catch {} }} placeholder={API_URL} /><small className="d-block text-muted mb-2">The default uses the configured Carestac API URL. For local testing use <code>http://localhost:3001</code>; Exotel calls require the API service's public HTTPS URL.</small><label className="form-label">Clinic voice tool endpoint</label><input className="form-control font-monospace mb-2" readOnly value={`${voiceToolApiBaseUrl.replace(/\/+$/, '')}/api/voice/tools/${telephonyTenantId}`} onFocus={(event) => event.target.select()} />{/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(voiceToolApiBaseUrl) && <p className="alert alert-warning py-2">Exotel cloud cannot reach localhost. The local endpoint works for testing on this machine; calls from Exotel need a public HTTPS URL.</p>}<label className="form-label">Clinic tool secret</label><input className="form-control font-monospace" readOnly value={voiceToolSecret} onFocus={(event) => event.target.select()} /><div className="mt-3"><strong>Exotel console setup</strong><ol className="mb-2 mt-2"><li>In <b>Build Bot → Tool Integration</b>, create three active POST tools using the endpoint above and JSON request bodies below. On all three tools, including carestack_book_appointment, set the same current clinic secret as a constant x-voice-tool-secret header. If this UI has no header value field, add POST body parameter tool_secret to each tool and map it as a Constant Value (never an LLM prompt).</li><li>Attach the tools to the clinic’s published Voicebot and map each value from the caller’s speech. The API accepts dates such as today/tomorrow and times such as 10 AM; normalize relative dates in the clinic timezone.</li><li>In App Bazaar, connect <b>Greeting → IVR Menu</b>. Set “Press 1 for appointment booking” to the published booking Voicebot applet. Assign the saved app flow to this clinic’s ExoPhone.</li><li>Tell the bot to collect the patient’s name, callback number, date, time and reason, asking once and accepting the patient’s exact words. For every booking-tool call, the required reason field must be sent: use the caller’s stated reason verbatim, or an empty string if they decline or do not know it. Ask for a doctor preference only if the caller has one. Check availability; if no doctor was requested, pass doctor_name as an empty string. After availability returns, continue the same conversation and preserve details already collected; do not end the turn or restart intake. Tell the caller the exact doctor/date/time returned, ask only for missing required details, read everything back and get clear final confirmation, then immediately call carestack_book_appointment in that conversation. If the caller chooses an alternative slot, check that exact slot again. Never book without confirmation. Read the confirmed booking ID back.</li></ol><details><summary>Tool request bodies</summary><p className="small mt-2 mb-1">Create a <code>carestack_clinic_info</code> tool with this body:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'clinic_info' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_check_availability</code> tool with four string fields: action is the constant availability; map date, time and doctor_name from speech. If no doctor preference was given, send doctor_name as an empty string:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'availability', date: 'aaj', time: '11 baje', doctor_name: '' }, null, 2)}</pre><p className="small mb-1">Create a <code>carestack_book_appointment</code> tool. Map request_id to a unique ID per call; use the doctor_name returned by availability after telling the caller and getting approval. Set confirmed to true only after the caller approves all details:</p><pre className="small bg-white p-2 rounded">{JSON.stringify({ action: 'book', request_id: 'unique-call-id', confirmed: true, patient_name: 'patient name', phone_number: '+919876543210', doctor_name: 'doctor name', date: 'YYYY-MM-DD', time: 'HH:mm', reason: 'visit reason' }, null, 2)}</pre></details><p className="small mb-0"><b>Important:</b> Exotel must be able to reach this endpoint over public HTTPS. A localhost URL will not work from an Exotel call. A successful appointment appears immediately in this clinic’s Carestac appointments; booking hours, future dates, duplicate slots and caller confirmation are checked by the API.</p></div></div>}
                  <div className="table-responsive mb-4"><table className="table align-middle">
                    <thead><tr><th>Clinic</th><th>Portal</th><th>Administrator</th><th>Plan</th><th>AI phone</th><th>Subscription</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>{tenants.length ? tenantPagination.items.map((tenant) => <tr key={tenant.id}>
                      <td><div className="fw-semibold">{tenant.name}</div><small className="text-muted">{tenant.region}</small></td>
                      <td><a href={getTenantPortalUrl(tenant.domain)}>{getTenantPortalUrl(tenant.domain)}</a></td>
                      <td>{tenant.admin_email}</td>
                      <td className="text-capitalize">{tenant.plan}<small className="d-block text-muted">{tenant.billing_cycle}</small></td>
                      <td><div>{telephonyTenantId === tenant.id ? (telephonyForm.phone_number || 'Not assigned') : (tenant.telephony?.phone_number || 'Not assigned')}</div><small className="text-muted">{telephonyTenantId === tenant.id ? `${telephonyForm.voice_provider === 'exotel_voicebot' ? 'Exotel Voicebot' : 'Sarvam'} · editing (unsaved)` : tenant.telephony?.voice_provider === 'exotel_voicebot' ? (tenant.telephony?.enabled ? 'Exotel Voicebot · live' : 'Exotel Voicebot · console setup') : tenant.telephony?.deployment_status === 'active' ? 'Sarvam inbound active' : 'Not deployed'}</small></td>
                      <td><span className={`status-pill ${tenant.subscription_status}`}>{tenant.subscription_status}</span></td>
                      <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => configureClinicTelephony(tenant)}>Configure calling</button><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editTenant(tenant)}>Edit</button><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openTenantPasswordForm(tenant)}>Set password</button><button className={`btn btn-sm ${tenant.subscription_status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'} me-2`} onClick={() => tenant.subscription_status === 'expired' ? renewSubscription(tenant) : updateSubscription(tenant.id, { subscription_status: tenant.subscription_status === 'active' ? 'paused' : 'active' })}>{tenant.subscription_status === 'active' ? 'Pause' : tenant.subscription_status === 'expired' ? 'Renew' : 'Activate'}</button><button className="btn btn-sm btn-outline-danger" onClick={() => removeTenant(tenant)}>Delete</button></td>
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
                        <div className="col-12"><h5 className="mt-2 mb-0">Exotel Voicebot</h5><p className="small text-muted mb-0">Legacy managed voicebot option. Carestac’s own agent runtime is the provider-neutral path.</p></div>
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
                      {!editingTenantId && <div className="col-12"><div className="alert alert-info mb-0">Carestac will generate a one-time password and email it to the administrator. They must choose a new password the first time they sign in.</div></div>}
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

              {!superAdmin && clinicAdmin && activeView === 'permissions' && <div className="row g-4 mb-4">
                <div className="col-12"><section className="admin-panel">
                  <div className="admin-panel-heading"><div><h3>Access control</h3><p>Set the role baseline, then make specific user-level exceptions where needed. Plan features remain controlled by the platform subscription.</p></div><button type="button" className="btn btn-sm btn-primary" onClick={() => { setEditingRoleId(null); setRoleForm(emptyClinicRole); setRoleFormOpen((open) => !open); }}>Create role</button></div>
                  {roleFormOpen && <form className="border rounded-3 p-3 mb-4" onSubmit={submitRoleForm}>
                    <div className="row g-3 mb-3"><div className="col-md-4"><label className="form-label" htmlFor="clinic-role-id">Role key</label><input id="clinic-role-id" className="form-control" required minLength="2" maxLength="40" pattern="[a-z][a-z0-9_-]*" value={roleForm.id} disabled={Boolean(editingRoleId)} onChange={(event) => setRoleForm({ ...roleForm, id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} /><small className="text-muted">For example: lab_technician or front_desk.</small></div><div className="col-md-8"><label className="form-label" htmlFor="clinic-role-name">Role name</label><input id="clinic-role-name" className="form-control" required minLength="2" maxLength="60" value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} /></div></div>
                    <h5 className="mb-1">Role permissions</h5><p className="small text-muted">This is the default access for everyone assigned to this role. Manage also grants View. Payments → Reconcile only can match ledger entries and request billing changes; only a clinic admin approves and applies those requests. Manage allows direct billing edits.</p>
                    <div className="row g-2">{STAFF_PERMISSION_GROUPS.map(({ label, view, manage, reconcile }) => <div className="col-md-6 col-xl-4" key={view}><div className="border rounded-3 p-3 h-100"><strong className="d-block mb-3">{label}</strong><div className="d-flex flex-wrap gap-3">{[[view, view === 'payments:view' ? 'View only' : 'View']].concat(manage ? [[manage, 'Manage']] : [], reconcile ? [[reconcile, 'Reconcile only']] : []).map(([permission, permissionLabel]) => <label className="d-flex align-items-center gap-2 small" key={permission}><input className="form-check-input mt-0" type="checkbox" checked={roleForm.permissions.includes(permission)} onChange={(event) => { const next = new Set(roleForm.permissions); if (event.target.checked) { next.add(permission); if (permission.endsWith(':manage')) next.add(view); if (permission === 'overview:today_plan') next.add('overview:view'); } else { next.delete(permission); if (permission === view && manage) next.delete(manage); if (permission === 'overview:view') next.delete('overview:today_plan'); } setRoleForm({ ...roleForm, permissions: [...next] }); }} /><span>{permissionLabel}</span></label>)}</div></div></div>)}</div>
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingRoleId ? 'Save role' : 'Create role'}</button><button type="button" className="btn btn-outline-secondary" onClick={() => { setRoleForm(emptyClinicRole); setEditingRoleId(null); setRoleFormOpen(false); }}>Cancel</button></div>
                  </form>}
                  <div className="row g-3">{roles.map((role) => <div className="col-md-6 col-xl-4" key={role.id}><article className="border rounded-3 p-3 h-100"><div className="d-flex justify-content-between align-items-start gap-2"><div><h4 className="h6 mb-1">{role.name}</h4><small className="text-muted">{role.id} · {role.members} member{role.members === 1 ? '' : 's'}</small></div>{role.built_in && <span className="status-pill confirmed">Built in</span>}</div><div className="small mt-3 mb-3 d-flex flex-wrap gap-1">{STAFF_PERMISSION_GROUPS.filter(({ view, manage, reconcile }) => role.permissions.includes(view) || (manage && role.permissions.includes(manage)) || (reconcile && role.permissions.includes(reconcile))).map(({ label }) => <span className="badge text-bg-light" key={label}>{label}</span>)}</div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editClinicRole(role)}>Edit role</button>{!role.built_in && <button type="button" className="btn btn-sm btn-outline-danger" disabled={role.members > 0} onClick={() => removeClinicRole(role)}>Delete</button>}</div></article></div>)}</div>
                </section></div>
                <div className="col-12"><section className="admin-panel">
                  <div className="admin-panel-heading"><div><h3>User-level access overrides</h3><p>Inherit keeps the role setting. Allow adds one permission; Deny removes it for this user only.</p></div></div>
                  {staff.length ? <form onSubmit={savePermissionOverrides}>
                    <div className="row g-3 align-items-end mb-3"><div className="col-md-6"><label className="form-label" htmlFor="permission-user">Staff member</label><select id="permission-user" className="form-select" value={permissionUserId} onChange={(event) => selectPermissionUser(event.target.value)}>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role_name}</option>)}</select></div><div className="col-md-6"><p className="small text-muted mb-0">Role: <strong>{staff.find((member) => member.id === permissionUserId)?.role_name || '—'}</strong>. User overrides are applied after the role permissions.</p></div></div>
                    <div className="row g-2">{STAFF_PERMISSION_GROUPS.map(({ label, view, manage, reconcile }) => <div className="col-md-6 col-xl-4" key={view}><div className="border rounded-3 p-3 h-100"><strong className="d-block mb-3">{label}</strong>{[[view, view === 'payments:view' ? 'View only' : 'View']].concat(manage ? [[manage, 'Manage']] : [], reconcile ? [[reconcile, 'Reconcile only']] : []).map(([permission, permissionLabel]) => { const value = permissionOverridesForm.deny.includes(permission) ? 'deny' : permissionOverridesForm.allow.includes(permission) ? 'allow' : 'inherit'; return <label className="d-flex justify-content-between align-items-center gap-2 small mb-2" key={permission}><span>{permissionLabel}</span><select className="form-select form-select-sm w-auto" aria-label={`${label} ${permissionLabel} override`} value={value} onChange={(event) => { const nextAllow = permissionOverridesForm.allow.filter((item) => item !== permission); const nextDeny = permissionOverridesForm.deny.filter((item) => item !== permission); if (event.target.value === 'allow') nextAllow.push(permission); if (event.target.value === 'deny') nextDeny.push(permission); setPermissionOverridesForm({ allow: nextAllow, deny: nextDeny }); }}><option value="inherit">Inherit role</option><option value="allow">Allow</option><option value="deny">Deny</option></select></label>; })}</div></div>)}</div>
                    <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save user overrides'}</button><button type="button" className="btn btn-outline-secondary" onClick={() => setPermissionOverridesForm(emptyPermissionOverrides)}>Reset to role defaults</button></div>
                  </form> : <p className="text-muted mb-0">Create a staff account to manage user-level access overrides.</p>}
                </section></div>
              </div>}

              {!superAdmin && clinicAdmin && activeView === 'staff' && <div className="row g-4 mb-4">
                <div className="col-12"><section className="admin-panel">
                  <div className="admin-panel-heading"><div><h3>Clinic staff accounts</h3><p>Create accounts and assign a role. Manage role defaults and individual exceptions in Permissions.</p></div><span className="status-pill confirmed">Role based access</span></div>
                  <button type="button" className={`workspace-section-toggle ${staffFormOpen ? 'is-open' : ''}`} aria-expanded={staffFormOpen} aria-controls="staff-account-fields" onClick={() => { setStaffFormOpen((open) => !open); if (!staffForm.id) setStaffForm({ id: null, name: '', email: '', password: '', role: 'receptionist' }); }}>
                    <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">{staffForm.id ? 'Edit staff access' : 'Add clinic staff'}</span><span className="workspace-section-toggle-description">Each staff member signs in with their own email and password.</span></span><span className="workspace-section-toggle-action">{staffFormOpen ? 'Collapse −' : 'Expand +'}</span>
                  </button>
                  <div id="staff-account-fields" className="mt-3" hidden={!staffFormOpen}>
                    <form onSubmit={submitStaffForm}>
                      <div className="row g-3 mb-4">
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-name">Staff name</label><input id="staff-name" className="form-control" required minLength="2" maxLength="120" value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} /></div>
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-email">Login email</label><input id="staff-email" className="form-control" type="email" required value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></div>
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-role">Staff role</label><select id="staff-role" className="form-select" value={staffForm.role || 'receptionist'} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
                        <div className="col-md-4"><label className="form-label" htmlFor="staff-password">{staffForm.id ? 'New password (optional)' : 'Temporary password'}</label><input id="staff-password" className="form-control" type="password" autoComplete="new-password" minLength="10" maxLength="72" required={!staffForm.id} value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /><small className="text-muted">At least 10 characters. Share it securely with this staff member.</small></div>
                      </div>
                      <p className="small text-muted">Role permissions are configured in Permissions. Per-user exceptions can be set there without changing the role.</p>
                      <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : staffForm.id ? 'Save staff account' : 'Create staff account'}</button>{staffForm.id && <button type="button" className="btn btn-outline-secondary" onClick={() => { setStaffForm({ id: null, name: '', email: '', password: '', role: 'receptionist' }); setStaffFormOpen(false); }}>Cancel edit</button>}</div>
                    </form>
                  </div>
                </section></div>
                <div className="col-12"><section className="admin-panel"><div className="admin-panel-heading"><div><h3>Staff accounts</h3><p>{filteredStaff.length} of {staff.length} clinic staff account{staff.length === 1 ? '' : 's'}</p></div></div>
                  <div className="workspace-table-tools">
                    <div className="workspace-search"><label className="visually-hidden" htmlFor="staff-search">Search staff accounts</label><span aria-hidden="true">⌕</span><input id="staff-search" className="form-control" placeholder={`Search ${STAFF_TABLE_COLUMNS.filter((column) => staffColumns.includes(column.key)).map((column) => column.label.toLowerCase()).join(', ')}`} value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} /></div>
                    <label className="visually-hidden" htmlFor="staff-role-filter">Filter staff by role</label><select id="staff-role-filter" className="form-select workspace-status-filter" value={staffRoleFilter} onChange={(event) => setStaffRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
                    <span className="workspace-result-count">{filteredStaff.length} of {staff.length} accounts</span>
                    <details className="patient-column-picker">
                      <summary className="btn btn-sm btn-outline-secondary">Choose columns</summary>
                      <div className="patient-column-picker-menu" role="group" aria-label="Choose staff table columns">
                        {STAFF_TABLE_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={staffColumns.includes(column.key)} disabled={staffColumns.length === 1 && staffColumns.includes(column.key)} onChange={() => setStaffColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} /> {column.label}</label>)}
                      </div>
                    </details>
                    {(staffQuery || staffRoleFilter !== 'all') && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setStaffQuery(''); setStaffRoleFilter('all'); }}>Clear filters</button>}
                  </div>
                  <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr>{STAFF_TABLE_COLUMNS.filter((column) => staffColumns.includes(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}<th className="text-end">Actions</th></tr></thead><tbody>{filteredStaff.length ? staffPagination.items.map((member) => <tr key={member.id}>{STAFF_TABLE_COLUMNS.filter((column) => staffColumns.includes(column.key)).map((column) => <td key={column.key}>{column.key === 'role' ? <span className="text-capitalize">{String(member.role_name || member.role || '').replace('_', ' ')}</span> : column.value(member) || '-'}</td>)}<td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => { setStaffForm({ id: member.id, name: member.name, email: member.email, password: '', role: member.role || 'receptionist' }); setStaffFormOpen(true); window.setTimeout(() => document.getElementById('staff-account-fields')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>Edit account</button><button className="btn btn-sm btn-outline-danger" onClick={() => removeStaff(member)}>Remove</button></td></tr>) : <tr><td colSpan={staffColumns.length + 1} className="text-muted py-4">{staff.length ? 'No staff accounts match those filters.' : 'No staff accounts yet. Add a receptionist above.'}</td></tr>}</tbody></table></div>
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
                  <div className="admin-panel-heading"><div><h3>Monthly booking report</h3><p>Counts use the appointment date, so past bookings remain in the month they were scheduled.</p></div><label className="d-flex align-items-center gap-2"><span className="visually-hidden">Choose report month</span><input aria-label="Choose report month" className="form-control" type="month" value={reportMonth} onChange={(event) => { if (event.target.value) setReportMonth(event.target.value); }} /><button type="button" className="btn btn-outline-primary text-nowrap" onClick={() => exportTenantCsv('bookings', monthlyBookings)} disabled={!monthlyBookings.length}>Download month CSV</button></label></div>
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-xl-3"><div className="tenant-kpi"><small>Total bookings</small><strong>{monthlyBookings.length}</strong><span>For {reportMonth}</span></div></div>
                    {monthlyBookingStatuses.map(({ status, count }) => <div className="col-6 col-xl-2" key={status}><div className="tenant-kpi"><small className="text-capitalize">{status.replace('_', ' ')}</small><strong>{count}</strong><span>Appointments</span></div></div>)}
                  </div>
                  <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Date &amp; time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead><tbody>{monthlyBookingPagination.total ? monthlyBookingPagination.items.map((booking) => <tr key={booking.id}><td>{booking.appointment_date}<small className="d-block text-muted">{booking.appointment_time}</small></td><td>{booking.patient_name}<small className="d-block text-muted">{booking.phone_number}</small></td><td>{booking.doctor_name}</td><td>{booking.reason || '—'}</td><td><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></td></tr>) : <tr><td colSpan="5" className="text-muted py-4">No bookings for {reportMonth}.</td></tr>}</tbody></table></div>
                  <ListPagination pagination={monthlyBookingPagination} label="monthly bookings" />
                </section>
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

              {!superAdmin && activeView === 'appointments' && <section className="tenant-insight-panel mb-4">
                <button type="button" className={`workspace-section-toggle ${waitlistOpen ? 'is-open' : ''}`} aria-expanded={waitlistOpen} aria-controls="cancellation-waitlist-fields" onClick={() => setWaitlistOpen((open) => !open)}>
                  <span className="workspace-section-toggle-copy"><span className="workspace-section-toggle-title">Cancellation waitlist</span><span className="workspace-section-toggle-description">Match waiting patients against future cancelled slots. Contact them manually; no calls or messages are sent automatically.</span></span>
                  <span className="workspace-section-toggle-action">{waitlistOpen ? 'Collapse −' : 'Expand +'}</span>
                </button>
                <div id="cancellation-waitlist-fields" className="mt-3" hidden={!waitlistOpen}>
                {canManage('appointments') && <div className="d-flex justify-content-end mb-3"><button type="button" className="btn btn-sm btn-primary" onClick={() => setWaitlistFormOpen((open) => !open)}>{waitlistFormOpen ? 'Close form' : 'Add patient'}</button></div>}
                {waitlistFormOpen && canManage('appointments') && <form className="row g-2 mb-4" onSubmit={addWaitlistEntry}>
                  <div className="col-md-3"><label className="form-label" htmlFor="waitlist-name">Patient name</label><input id="waitlist-name" className="form-control" required minLength="2" maxLength="120" value={waitlistForm.name} onChange={(event) => setWaitlistForm({ ...waitlistForm, name: event.target.value })} /></div>
                  <div className="col-md-3"><label className="form-label" htmlFor="waitlist-phone">Phone</label><input id="waitlist-phone" className="form-control" required type="tel" pattern="[+]?[0-9 ()-]{7,20}" value={waitlistForm.phone} onChange={(event) => setWaitlistForm({ ...waitlistForm, phone: event.target.value })} /></div>
                  <div className="col-md-3"><label className="form-label" htmlFor="waitlist-doctor">Doctor preference</label><select id="waitlist-doctor" className="form-select" value={waitlistForm.doctor_name} onChange={(event) => setWaitlistForm({ ...waitlistForm, doctor_name: event.target.value })}><option value="">Any doctor</option>{(tenantData?.doctors || []).filter((doctor) => doctor.status === 'active').map((doctor) => <option key={doctor.id} value={doctor.name}>{doctor.name}</option>)}</select></div>
                  <div className="col-md-3"><label className="form-label" htmlFor="waitlist-date">Preferred date (optional)</label><input id="waitlist-date" className="form-control" type="date" min={clinicToday} value={waitlistForm.preferred_date} onChange={(event) => setWaitlistForm({ ...waitlistForm, preferred_date: event.target.value })} /></div>
                  <div className="col-md-3"><label className="form-label" htmlFor="waitlist-time">Preferred time (optional)</label><input id="waitlist-time" className="form-control" type="time" value={waitlistForm.preferred_time} onChange={(event) => setWaitlistForm({ ...waitlistForm, preferred_time: event.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="waitlist-notes">Notes (optional)</label><input id="waitlist-notes" className="form-control" maxLength="500" value={waitlistForm.notes} onChange={(event) => setWaitlistForm({ ...waitlistForm, notes: event.target.value })} placeholder="Useful scheduling notes" /></div>
                  <div className="col-md-3 d-flex align-items-end"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add to waitlist'}</button></div>
                </form>}
                {reopenedSlots.length > 0 && <div className="mb-4"><h4 className="h6">Patients matching reopened slots</h4><div className="agenda-list">{reopenedSlots.map(({ booking, matches }) => <div className="agenda-row align-items-start" key={`slot-${booking.id}`}><div className="agenda-date"><strong>{booking.appointment_time}</strong><small>{booking.appointment_date}</small></div><div className="agenda-details"><strong>{booking.doctor_name}</strong><span>Cancelled appointment · {matches.length} matching {matches.length === 1 ? 'patient' : 'patients'}</span><div className="d-flex flex-wrap gap-2 mt-2">{matches.map((entry) => <span className="badge bg-light text-dark border" key={entry.id}>{entry.name} · <a href={`tel:${entry.phone}`}>{entry.phone}</a> {canManage('appointments') && <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => updateWaitlistEntryStatus(entry.id, 'contacted')}>Mark contacted</button>}</span>)}</div></div><span className="status-pill cancelled">Slot reopened</span></div>)}</div></div>}
                <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Patient</th><th>Preferences</th><th>Notes</th><th>Status</th>{canManage('appointments') && <th>Update</th>}</tr></thead><tbody>{clinicWaitlist.length ? clinicWaitlist.map((entry) => <tr key={entry.id}><td className="fw-semibold">{entry.name}<small className="d-block text-muted"><a href={`tel:${entry.phone}`}>{entry.phone}</a></small></td><td>{entry.doctor_name || 'Any doctor'}<small className="d-block text-muted">{entry.preferred_date || 'Any date'}{entry.preferred_time ? ` · ${entry.preferred_time}` : ''}</small></td><td>{entry.notes || '—'}</td><td><span className={`status-pill ${entry.status === 'waiting' ? 'confirmed' : entry.status === 'closed' ? 'cancelled' : entry.status}`}>{entry.status}</span></td>{canManage('appointments') && <td><select className="form-select form-select-sm appointment-status-select" aria-label={`Update ${entry.name} waitlist status`} value={entry.status} onChange={(event) => updateWaitlistEntryStatus(entry.id, event.target.value)}><option value="waiting">Waiting</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="closed">Closed</option></select></td>}</tr>) : <tr><td colSpan={canManage('appointments') ? 5 : 4} className="text-muted py-4">No patients on the cancellation waitlist.</td></tr>}</tbody></table></div>
                </div>
              </section>}

              {!superAdmin && activeView === 'payments' && <section className="tenant-insight-panel mb-4">
                <div className="admin-panel-heading"><div><h3>Payments &amp; transactions</h3><p>Staff-recorded billing and payment method; this ledger does not process charges. Outstanding balances remain visible here.</p></div><span className="status-pill confirmed">{transactions.length} visit{transactions.length === 1 ? '' : 's'}</span></div>
                <div className="row g-3 mb-4">
                  {[['Total billed', transactionTotals.billed], ['Received', transactionTotals.received], ['Balance due', transactionTotals.due]].map(([label, value]) => <div className="col-12 col-md-4" key={label}><div className="patient-profile-metric"><small>{label}</small><strong>{formatINR(value)}</strong></div></div>)}
                </div>
                <div className="workspace-table-tools transaction-table-tools">
                  <div className="workspace-search"><label className="visually-hidden" htmlFor="transaction-search">Search transactions</label><span aria-hidden="true">⌕</span><input id="transaction-search" className="form-control" placeholder="Search transaction, patient, appointment, reference" value={transactionQuery} onChange={(event) => setTransactionQuery(event.target.value)} /></div>
                  <div className="workspace-filter-pills" role="group" aria-label="Transaction visit date range">{[['today', 'Today'], ['month', 'This month'], ['all', 'All dates']].map(([value, label]) => <button type="button" key={value} className={transactionDateFilter === value ? 'active' : ''} aria-pressed={transactionDateFilter === value} onClick={() => setTransactionDateFilter(value)}>{label}</button>)}</div>
                  <label className="visually-hidden" htmlFor="transaction-status-filter">Filter by payment status</label><select id="transaction-status-filter" className="form-select workspace-status-filter" value={transactionStatusFilter} onChange={(event) => setTransactionStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select>
                  <label className="visually-hidden" htmlFor="transaction-method-filter">Filter by payment method</label><select id="transaction-method-filter" className="form-select workspace-status-filter" value={transactionMethodFilter} onChange={(event) => setTransactionMethodFilter(event.target.value)}><option value="all">All methods</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option><option value="unpaid">Unpaid</option></select>
                  <details className="patient-column-picker"><summary className="btn btn-sm btn-outline-secondary patient-icon-trigger" aria-label="Choose transaction columns" title="Choose columns"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="5" height="14" rx="1"/><rect x="10" y="5" width="4" height="14" rx="1"/><rect x="15" y="5" width="5" height="14" rx="1"/></svg></summary><div className="patient-column-picker-menu transaction-column-menu" role="group" aria-label="Choose transaction columns">{TRANSACTION_TABLE_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={transactionColumns.includes(column.key)} disabled={transactionColumns.length === 1 && transactionColumns.includes(column.key)} onChange={() => setTransactionColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} /> {column.label}</label>)}</div></details>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => exportTransactionsCsv(selectedTransactionRows.length ? selectedTransactionRows : filteredTransactions)}>Export</button>
                  <button type="button" className={`btn btn-sm btn-outline-secondary patient-icon-trigger ${selectedTransactionRows.length ? 'has-active-selection' : ''}`} aria-label="Clear transaction selection" title="Clear selection" disabled={!selectedTransactionRows.length} onClick={() => setSelectedTransactionIds([])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 17 17M17 7 7 17"/><circle cx="12" cy="12" r="9"/></svg></button>
                  {(transactionQuery || transactionStatusFilter !== 'all' || transactionMethodFilter !== 'all' || transactionDateFilter !== 'all') && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setTransactionQuery(''); setTransactionStatusFilter('all'); setTransactionMethodFilter('all'); setTransactionDateFilter('all'); }}>Clear filters</button>}
                  <span className="workspace-result-count">{filteredTransactions.length} of {transactions.length} transactions</span>
                </div>
                {selectedTransactionRows.length > 0 && <div className="recent-patient-bulk-actions appointment-bulk-actions" aria-live="polite"><span>{selectedTransactionRows.length} selected</span></div>}
                <div className="table-responsive"><table className="table align-middle mb-0 transaction-register-table"><thead><tr><th><input className="form-check-input" type="checkbox" aria-label="Select all transactions on this page" checked={allTransactionPageSelected} onChange={toggleTransactionPageSelection} /></th>{TRANSACTION_TABLE_COLUMNS.filter((column) => transactionColumns.includes(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>
                  {transactionPagination.items.length ? transactionPagination.items.map((transaction) => <tr key={transaction.transaction_id || transaction.appointment_id} className={selectedTransactionIds.includes(String(transaction.appointment_id)) ? 'recent-patient-selected' : ''}><td><input className="form-check-input" type="checkbox" aria-label={`Select transaction ${transaction.transaction_id || transaction.appointment_id}`} checked={selectedTransactionIds.includes(String(transaction.appointment_id))} onChange={() => toggleTransactionSelection(transaction.appointment_id)} /></td>{TRANSACTION_TABLE_COLUMNS.filter((column) => transactionColumns.includes(column.key)).map((column) => <td key={column.key} className={['transaction_id', 'appointment_id'].includes(column.key) ? 'font-monospace small' : ''}>{transactionCell(transaction, column.key)}</td>)}<td className="text-nowrap"><button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setViewingTransaction(transaction)}>View</button>{canManage('payments') && <><button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => editTransactionBilling(transaction)}>Edit</button>{session?.role === 'tenant_admin' && <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => deleteTransaction(transaction)}>Delete</button>}</>}</td></tr>) : <tr><td colSpan={TRANSACTION_TABLE_COLUMNS.filter((column) => transactionColumns.includes(column.key)).length + 2} className="text-muted py-4">{transactions.length ? 'No transactions match those filters.' : 'No completed visits have billing details yet.'}</td></tr>}
                </tbody></table></div>
                <ListPagination pagination={transactionPagination} label="transactions" />
              </section>}

              {viewingTransaction && activeView === 'payments' && <div className="workspace-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingTransaction(null); }} onKeyDown={(event) => { if (event.key === 'Escape') setViewingTransaction(null); }}>
                <section className="workspace-profile-dialog transaction-view-dialog" role="dialog" aria-modal="true" aria-labelledby="transaction-view-title">
                  <div className="workspace-profile-heading"><div><p className="workspace-confirm-eyebrow">READ ONLY · PAYMENT AUDIT</p><h2 id="transaction-view-title">Transaction details</h2><p>{viewingTransaction.transaction_id || 'Unpaid visit'} · {viewingTransaction.patient_name} · Appointment {viewingTransaction.appointment_id}</p></div><button type="button" className="workspace-profile-close" onClick={() => setViewingTransaction(null)} aria-label="Close transaction details">×</button></div>
                  <div className="transaction-detail-grid">{TRANSACTION_TABLE_COLUMNS.map((column) => <div className="transaction-detail-item" key={column.key}><span>{column.label}</span><strong>{transactionCell(viewingTransaction, column.key)}</strong></div>)}</div>
                  <section className="transaction-proof-section" aria-label="Payment document">
                    <div><h3>Payment document</h3><p>{viewingTransaction.payment_proof_name || (viewingTransaction.payment_proof_data_url ? 'Payment screenshot' : 'No payment proof attached.')}</p></div>
                    {viewingTransaction.payment_proof_data_url && <div className="transaction-proof-actions"><a className="btn btn-sm btn-outline-primary" href={viewingTransaction.payment_proof_data_url} target="_blank" rel="noreferrer">Open document</a><a className="btn btn-sm btn-outline-secondary" href={viewingTransaction.payment_proof_data_url} download={viewingTransaction.payment_proof_name || 'payment-proof.jpg'}>Download</a><a className="transaction-proof-preview" href={viewingTransaction.payment_proof_data_url} target="_blank" rel="noreferrer"><img src={viewingTransaction.payment_proof_data_url} alt={viewingTransaction.payment_proof_name || 'Payment proof screenshot'} /></a></div>}
                  </section>
                  {!viewingTransaction.recorded_by && <p className="small text-muted mt-3 mb-0">“Recorded by” is not available for entries saved before payment audit tracking was added.</p>}
                </section>
              </div>}

              {!superAdmin && activeView === 'fees' && <section className="tenant-insight-panel fee-reconciliation-panel mb-4">
                <div className="admin-panel-heading"><div><h3>Ledger reconciliation</h3><p>Compare completed visit billing with the clinic’s daily or monthly ledger. Matching records only marks them as checked; it never changes or deletes billing.</p></div><div className="fee-period-switch" role="group" aria-label="Ledger period"><button type="button" className={feePeriod === 'today' ? 'active' : ''} aria-pressed={feePeriod === 'today'} onClick={() => setFeePeriod('today')}>Today</button><button type="button" className={feePeriod === 'month' ? 'active' : ''} aria-pressed={feePeriod === 'month'} onClick={() => setFeePeriod('month')}>This month</button></div></div>
                <div className="row g-3 mb-4">{[['Visits', feeTransactions.length], ['Billed', formatINR(feeTotals.billed)], ['Received', formatINR(feeTotals.received)], ['Matched', formatINR(feeTotals.matched)], ['Unmatched', formatINR(feeTotals.received - feeTotals.matched)]].map(([label, value]) => <div className="col-6 col-xl" key={label}><div className="patient-profile-metric fee-reconciliation-metric"><small>{label}</small><strong>{value}</strong></div></div>)}</div>
                <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Visit</th><th>Patient / appointment</th><th>Doctor</th><th>Bill</th><th>Received</th><th>Due</th><th>Ledger match</th><th>Action</th></tr></thead><tbody>{feeTransactions.length ? feeTransactions.map((transaction) => <tr key={transaction.appointment_id}><td>{transaction.appointment_date}<small className="d-block text-muted">{transaction.appointment_time}</small></td><td><strong>{transaction.patient_name}</strong><small className="d-block text-muted">{transaction.appointment_id}</small></td><td>{transaction.doctor_name}</td><td>{formatINR(transaction.total_amount)}</td><td>{formatINR(transaction.amount_paid)}</td><td className={Number(transaction.balance_due) ? 'text-danger fw-semibold' : ''}>{formatINR(transaction.balance_due)}</td><td>{transaction.reconciled_at ? <><span className="status-pill completed">Matched</span><small className="d-block text-muted">{transaction.reconciled_by || 'Clinic staff'}</small></> : <span className="status-pill confirmed">Needs match</span>}</td><td className="text-nowrap">{!transaction.reconciled_at && canReconcilePayments && <button type="button" className="btn btn-sm btn-success me-2" disabled={busy} onClick={() => reconcilePayment(transaction)}>Match ledger</button>}{!canManage('payments') && canReconcilePayments && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openBillingChangeRequest(transaction)}>Request correction</button>}</td></tr>) : <tr><td colSpan="8" className="text-muted py-4">No completed visit billing for {feePeriod === 'today' ? 'today' : 'this month'}.</td></tr>}</tbody></table></div>
                {session?.role === 'tenant_admin' && <div className="fee-approval-queue mt-4"><div className="admin-panel-heading"><div><h4>Billing change requests</h4><p>Review staff requests before any saved billing is changed.</p></div><span className="status-pill confirmed">{paymentChangeRequests.filter((item) => item.status === 'pending').length} pending</span></div>{paymentChangeRequests.filter((item) => item.status === 'pending').length ? <div className="list-group list-group-flush">{paymentChangeRequests.filter((item) => item.status === 'pending').map((item) => <article className="fee-approval-request list-group-item px-0" key={item.id}><div className="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><strong>{item.appointment_id} · {item.proposed_billing.payment_reference || 'Billing correction'}</strong><p className="small text-muted mb-2">Requested by {item.requester} · {new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p><p className="small mb-2">{item.message}</p><span className="small">Proposed bill {formatINR(Math.max(0, Number(item.proposed_billing.consultation_fee) - Number(item.proposed_billing.discount_amount) + Number(item.proposed_billing.additional_charges)))} · Received {formatINR(item.proposed_billing.amount_paid)} · {String(item.proposed_billing.payment_method || 'unpaid').replace('_', ' ')}</span>{item.proposed_billing.payment_proof_data_url && <a className="approval-proof-link" href={item.proposed_billing.payment_proof_data_url} target="_blank" rel="noreferrer">Open attached payment proof · {item.proposed_billing.payment_proof_name || 'Screenshot'}</a>}</div><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => reviewPaymentChangeRequest(item, 'approved')}>Approve &amp; apply</button><button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => reviewPaymentChangeRequest(item, 'rejected')}>Reject</button></div></div></article>)}</div> : <div className="empty-insight">No billing changes are waiting for approval.</div>}</div>}
              </section>}

              {!superAdmin && (activeView === 'patients' || activeView === 'appointments') && <div className="card border-0 shadow-sm rounded-4">
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
                    <button className="btn btn-outline-secondary" onClick={() => exportTenantCsv('bookings', selectedAppointmentRows.length ? selectedAppointmentRows : bookings)}>Export</button>
                    <button type="button" className={`btn btn-sm btn-outline-secondary patient-icon-trigger ${selectedAppointmentRows.length ? 'has-active-selection' : ''}`} aria-label="Clear appointment selection" title="Clear selection" disabled={!selectedAppointmentRows.length} onClick={() => setSelectedAppointmentIds([])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 17 17M17 7 7 17"/><circle cx="12" cy="12" r="9"/></svg></button>
                  </div>}
                  {activeView === 'appointments' && selectedAppointmentRows.length > 0 && <div className="recent-patient-bulk-actions appointment-bulk-actions" aria-live="polite"><span>{selectedAppointmentRows.length} selected</span></div>}
                  {activeView === 'appointments' && <p className="small text-muted mb-3">Select <strong>All dates</strong> to include past bookings. For a month-wise summary and CSV, open Reports → Monthly booking report.</p>}
                  {(activeView === 'patients' || activeView === 'overview') && <div className="workspace-table-tools">
                    <div className="workspace-search"><label className="visually-hidden" htmlFor="patient-search">Search patients</label><span aria-hidden="true">⌕</span><input id="patient-search" className="form-control" placeholder={activeView === 'overview' ? `Search ${PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)).map((column) => column.label.toLowerCase()).join(', ')}` : 'Search name, phone, email, or patient ID'} value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} /></div>
                    {activeView === 'overview' && <div className="workspace-filter-pills" role="group" aria-label="Recent patient appointment date range">{[['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All patients']].map(([value, label]) => <button type="button" key={value} className={patientDateFilter === value ? 'active' : ''} aria-pressed={patientDateFilter === value} onClick={() => setPatientDateFilter(value)}>{label}</button>)}</div>}
                    <label className="visually-hidden" htmlFor="patient-status-filter">Filter patients by status</label><select id="patient-status-filter" className="form-select workspace-status-filter" value={patientStatusFilter} onChange={(event) => setPatientStatusFilter(event.target.value)}><option value="all">All patients</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                    <span className="workspace-result-count">{filteredPatients.length} of {patients.length} patients</span>
                    {activeView === 'overview' && <>
                      <details className="patient-column-picker">
                        <summary className="btn btn-sm btn-outline-secondary">Choose columns</summary>
                        <div className="patient-column-picker-menu" role="group" aria-label="Choose patient table columns">
                          {PATIENT_TABLE_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={patientOverviewColumns.includes(column.key)} disabled={patientOverviewColumns.length === 1 && patientOverviewColumns.includes(column.key)} onChange={() => setPatientOverviewColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} /> {column.label}</label>)}
                        </div>
                      </details>
                      {(patientQuery || patientStatusFilter !== 'all' || patientDateFilter !== 'all') && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setPatientQuery(''); setPatientStatusFilter('all'); setPatientDateFilter('all'); }}>Clear filters</button>}
                    </>}
                  </div>}
                  {activeView === 'patients' && selectedPatient && <section className="patient-profile-panel mb-4" aria-labelledby="patient-profile-heading">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                      <div><span className="workspace-result-count">PATIENT PROFILE · {selectedPatient.id}</span><h3 className="h4 mb-1 mt-1" id="patient-profile-heading">{selectedPatient.name}</h3><span className={`status-pill ${selectedPatient.status === 'active' ? 'confirmed' : 'cancelled'}`}>{selectedPatient.status || 'active'}</span></div>
                      <div className="d-flex gap-2 flex-wrap">
                        {selectedPatient.phone && <a className="btn btn-sm btn-outline-primary" href={`tel:${selectedPatient.phone}`}>Call patient</a>}
                        {selectedPatient.email && <a className="btn btn-sm btn-outline-primary" href={`mailto:${selectedPatient.email}`}>Email</a>}
                        {canManage('appointments') && <button type="button" className="btn btn-sm btn-primary" onClick={() => openAppointmentForPatient(selectedPatient)}>Book appointment</button>}
                        {canManage('patients') && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => editPatient(selectedPatient)}>Edit details</button>}
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedPatientId('')}>Close</button>
                      </div>
                    </div>
                    <div className="patient-profile-contact mb-3"><span><strong>Phone</strong>{selectedPatient.phone || 'Not added'}</span><span><strong>Email</strong>{selectedPatient.email || 'Not added'}</span><span><strong>Age</strong>{selectedPatient.age ? `${selectedPatient.age} years` : 'Not added'}</span><span><strong>Registered</strong>{formatPatientDate(selectedPatient.created_at?.slice(0, 10))}</span></div>
                    <div className="row g-3 mb-3">
                      <div className="col-6 col-lg-3"><div className="patient-profile-metric"><small>Appointments</small><strong>{selectedPatientBookings.length}</strong></div></div>
                      <div className="col-6 col-lg-3"><div className="patient-profile-metric"><small>Completed</small><strong>{selectedPatientBookings.filter((booking) => booking.status === 'completed').length}</strong></div></div>
                      <div className="col-12 col-lg-6"><div className="patient-profile-metric"><small>Next visit</small><strong>{selectedPatientUpcoming ? `${formatPatientDate(selectedPatientUpcoming.appointment_date)} · ${selectedPatientUpcoming.appointment_time}` : 'No upcoming visit'}</strong>{selectedPatientUpcoming && <small>{selectedPatientUpcoming.doctor_name}</small>}</div></div>
                    </div>
                    {selectedPatient.notes && <div className="patient-profile-notes mb-3"><strong>Patient notes</strong><p className="mb-0 mt-1">{selectedPatient.notes}</p></div>}
                    <div className="d-flex justify-content-between align-items-center mb-2"><h4 className="h6 mb-0">Appointment history</h4><span className="small text-muted">Most recent first</span></div>
                    {selectedPatientBookings.length ? <div className="patient-profile-history">{selectedPatientBookings.slice(0, 8).map((booking) => <div className="patient-profile-history-row" key={booking.id}><div><strong>{formatPatientDate(booking.appointment_date)} · {booking.appointment_time}</strong><span>{booking.doctor_name || 'Doctor not recorded'}{booking.reason ? ` · ${booking.reason}` : ''}</span></div><span className={`status-pill ${booking.status || 'confirmed'}`}>{String(booking.status || 'confirmed').replace('_', ' ')}</span></div>)}</div> : <p className="small text-muted mb-0">No appointment history available for this patient.</p>}
                  </section>}
                  <div className="table-responsive">
                    <table className={`table align-middle ${activeView === 'appointments' ? 'appointment-register-table' : ''}`}>
                        {activeView === 'appointments' ? <thead><tr><th><input className="form-check-input" type="checkbox" aria-label="Select all appointments on this page" checked={allAppointmentPageSelected} onChange={toggleAppointmentPageSelection} /></th><th>Appointment</th><th>Patient</th><th>Doctor</th><th>Date &amp; time</th><th>Status</th><th>Update</th><th>Actions</th></tr></thead> : <thead>
                        <tr>
                          {(activeView === 'overview' ? PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)) : PATIENT_TABLE_COLUMNS.filter((column) => ['id', 'name', 'phone', 'email', 'status'].includes(column.key))).map((column) => <th key={column.key}>{column.label}</th>)}
                          {activeView === 'patients' && <th className="text-end">Actions</th>}
                        </tr>
                      </thead>}
                      <tbody>
                        {activeView === 'appointments' ? filteredBookings.length === 0 ? (
                          <tr><td colSpan="8" className="text-muted py-4">{bookings.length ? 'No appointments match those filters.' : 'No appointments booked yet.'}</td></tr>
                        ) : appointmentPagination.items.map((booking) => (
                          <tr key={booking.id} className={selectedAppointmentIds.includes(String(booking.id)) ? 'recent-patient-selected' : ''}><td><input className="form-check-input" type="checkbox" aria-label={`Select appointment ${booking.id}`} checked={selectedAppointmentIds.includes(String(booking.id))} onChange={() => toggleAppointmentSelection(booking.id)} /></td><td className="fw-semibold">{booking.id}</td><td>{booking.patient_name}<small className="d-block text-muted">{booking.phone_number}</small></td><td>{booking.doctor_name}</td><td>{booking.appointment_date}<small className="d-block text-muted">{booking.appointment_time}</small></td><td><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span></td><td>{canManage('appointments') ? <select className="form-select form-select-sm appointment-status-select" aria-label={`Update ${booking.id} status`} value={booking.status} onChange={(event) => updateAppointmentStatus(booking.id, event.target.value)}><option value="confirmed">Confirmed</option><option value="completed" disabled={!canManage('payments')}>Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select> : <span className="text-muted">—</span>}</td><td className="text-nowrap">{canManage('payments') ? <details className="billing-action-picker"><summary className="btn btn-sm billing-action-trigger">Billing actions <span aria-hidden="true">⌄</span></summary><div className="billing-action-menu">{booking.status === 'completed' ? <button type="button" className="billing-action-edit" onClick={() => updateAppointmentStatus(booking.id, 'completed')}><span aria-hidden="true">✎</span><span><strong>Edit billing</strong><small>Change a completed visit’s fee or payment</small></span></button> : <button type="button" className="billing-action-record" onClick={() => updateAppointmentStatus(booking.id, 'completed')}><span aria-hidden="true">₹</span><span><strong>Record payment</strong><small>Complete visit and save its billing</small></span></button>}</div></details> : <span className="text-muted">—</span>}</td></tr>
                        )) : (activeView === 'overview' ? patientPagination.items : filteredPatients).length === 0 ? (
                          <tr>
                            <td colSpan={(activeView === 'overview' ? patientOverviewColumns.length : 5) + (activeView === 'patients' ? 1 : 0)} className="text-muted py-4">{patients.length ? 'No patients match those filters.' : 'No patients yet.'}</td>
                          </tr>
                        ) : (
                          (activeView === 'overview' || activeView === 'patients' ? patientPagination.items : displayedPatients).map((patient) => (
                            <tr key={patient.id}>
                              {(activeView === 'overview' ? PATIENT_TABLE_COLUMNS.filter((column) => patientOverviewColumns.includes(column.key)) : PATIENT_TABLE_COLUMNS.filter((column) => ['id', 'name', 'phone', 'email', 'status'].includes(column.key))).map((column) => <td key={column.key}>{column.key === 'status' ? <span className="badge bg-success-subtle text-success rounded-pill">{patient.status}</span> : column.value(patient) || '-'}</td>)}
                              {activeView === 'patients' && <td className="text-end text-nowrap"><button className={`btn btn-sm ${String(selectedPatientId) === String(patient.id) ? 'btn-primary' : 'btn-outline-primary'} me-2`} onClick={() => setSelectedPatientId((current) => String(current) === String(patient.id) ? '' : patient.id)}>{String(selectedPatientId) === String(patient.id) ? 'Viewing' : 'View profile'}</button>{canManage('patients') && <><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => editPatient(patient)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => deletePatient(patient.id)}>Delete</button></>}</td>}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {activeView === 'appointments' && <ListPagination pagination={appointmentPagination} label="appointments" />}
                  {(activeView === 'patients' || activeView === 'overview') && <ListPagination pagination={patientPagination} label="patients" />}
                  </div>
                </div>
              </div>}
              </div>
            </main>
          </div>
          {completionDialogOpen && completionAppointment && <div className="workspace-profile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setCompletionDialogOpen(false); setCompletionAppointment(null); setBillingRequestFor(null); } }}>
            <section className="workspace-profile-dialog appointment-completion-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-completion-title">
              <div className="workspace-profile-heading"><div><p className="workspace-confirm-eyebrow">{billingRequestFor ? 'ADMIN APPROVAL REQUIRED' : 'VISIT CHECKOUT'}</p><h2 id="appointment-completion-title">{billingRequestFor ? 'Request billing correction' : completionAppointment.status === 'completed' ? 'Update visit & billing' : 'Complete appointment'}</h2><p>{completionAppointment.patient_name} · {completionAppointment.doctor_name} · {completionAppointment.appointment_date} at {completionAppointment.appointment_time}{billingRequestFor ? ' · Changes apply only after admin approval.' : ''}</p></div><button type="button" className="workspace-profile-close" onClick={() => { setCompletionDialogOpen(false); setCompletionAppointment(null); setBillingRequestFor(null); }} disabled={busy} aria-label="Close completion form">×</button></div>
              <form className="workspace-profile-form" onSubmit={submitAppointmentCompletion}>
                <div className="workspace-profile-fields">
                  <label>Consultation fee (₹)<input className="form-control" type="number" min="0" max="10000000" step="0.01" required value={completionForm.consultation_fee} onChange={(event) => setCompletionForm((current) => ({ ...current, consultation_fee: event.target.value }))} /></label>
                  <label>Discount (₹)<input className="form-control" type="number" min="0" max="10000000" step="0.01" value={completionForm.discount_amount} onChange={(event) => setCompletionForm((current) => ({ ...current, discount_amount: event.target.value }))} /></label>
                  <label>Additional charges (₹)<input className="form-control" type="number" min="0" max="10000000" step="0.01" value={completionForm.additional_charges} onChange={(event) => setCompletionForm((current) => ({ ...current, additional_charges: event.target.value }))} /></label>
                  <label>Amount received (₹)<input className="form-control" type="number" min="0" max="10000000" step="0.01" value={completionForm.amount_paid} onChange={(event) => setCompletionForm((current) => ({ ...current, amount_paid: event.target.value }))} placeholder="0 for unpaid" /></label>
                  <label>Payment method<select className="form-select" value={completionForm.payment_method} onChange={(event) => setCompletionForm((current) => ({ ...current, payment_method: event.target.value }))}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option><option value="unpaid">Unpaid</option></select></label>
                  <label>Payment reference<input className="form-control" maxLength="120" value={completionForm.payment_reference} onChange={(event) => setCompletionForm((current) => ({ ...current, payment_reference: event.target.value }))} placeholder="Optional receipt or UPI reference" /></label>
                  <div className="payment-proof-field">
                    <strong>{completionForm.payment_method === 'upi' ? 'UPI payment screenshot' : 'Payment proof (optional)'}</strong>
                    <small>PNG, JPG, or WebP · compressed before saving</small>
                    <div className="payment-proof-controls"><label className="workspace-profile-upload">{completionForm.payment_proof_data_url ? 'Replace image' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePaymentProofChange} disabled={busy} /></label>{completionForm.payment_proof_data_url && <button type="button" className="workspace-profile-remove" onClick={() => setCompletionForm((current) => ({ ...current, payment_proof_data_url: '', payment_proof_name: '' }))} disabled={busy}>Remove</button>}{completionForm.payment_proof_name && <span>{completionForm.payment_proof_name}</span>}</div>
                    {completionForm.payment_proof_data_url && <a className="payment-proof-thumb" href={completionForm.payment_proof_data_url} target="_blank" rel="noreferrer"><img src={completionForm.payment_proof_data_url} alt="Payment proof preview" /></a>}
                  </div>
                  <label className="completion-notes-field">Visit / checkout notes<textarea className="form-control" rows="2" maxLength="1000" value={completionForm.completion_notes} onChange={(event) => setCompletionForm((current) => ({ ...current, completion_notes: event.target.value }))} placeholder="Optional operational notes" /></label>
                </div>
                {billingRequestFor && <label className="w-100 mt-3">Reason for correction<textarea className="form-control" rows="2" maxLength="1000" value={billingRequestMessage} onChange={(event) => setBillingRequestMessage(event.target.value)} placeholder="Tell the admin what needs to be corrected" /></label>}
                <div className="completion-total-bar"><span>Final bill</span><strong>{formatINR(Math.max(0, Number(completionForm.consultation_fee || 0) - Number(completionForm.discount_amount || 0) + Number(completionForm.additional_charges || 0)))}</strong><span>Balance after payment</span><strong>{formatINR(Math.max(0, Number(completionForm.consultation_fee || 0) - Number(completionForm.discount_amount || 0) + Number(completionForm.additional_charges || 0) - Number(completionForm.amount_paid || 0)))}</strong></div>
                {error && <p className="alert alert-danger py-2 mb-0" role="alert">{error}</p>}
                <div className="workspace-profile-actions"><button type="button" className="workspace-confirm-cancel" onClick={() => { setCompletionDialogOpen(false); setCompletionAppointment(null); setBillingRequestFor(null); }} disabled={busy}>Cancel</button><button type="submit" className="workspace-confirm-accept" disabled={busy}>{busy ? 'Saving…' : billingRequestFor ? 'Send for admin approval' : completionAppointment.status === 'completed' ? 'Save billing updates' : 'Save payment & complete'}</button></div>
              </form>
            </section>
          </div>}
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
