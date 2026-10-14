const appPath = window.location.pathname;

function getSession() {
  try {
    return JSON.parse(localStorage.getItem('carestack_session') || '{}');
  } catch (error) {
    return {};
  }
}

function setSession(value) {
  localStorage.setItem('carestack_session', JSON.stringify(value));
}

async function loginUser(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Login failed');
  }

  setSession({
    user: data.user,
    tenant_id: data.user.tenant_id,
    loggedIn: true,
  });

  if (data.user.role === 'super_admin') {
    window.location.href = '/onboarding.html';
    return;
  }

  window.location.href = '/dashboard.html';
}

async function onboardTenant(payload) {
  const response = await fetch('/api/tenants/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Tenant onboarding failed');
  }

  const successBox = document.getElementById('tenantSuccess');
  if (successBox) {
    successBox.classList.remove('d-none');
    successBox.textContent = `Tenant created successfully for ${data.tenant.tenant_name}. You can now log in as ${data.tenant.admin_email}.`;
  }
}

async function getDashboard() {
  const session = getSession();
  if (!session.loggedIn || !session.tenant_id) {
    window.location.href = '/login.html';
    return;
  }

  const response = await fetch(`/api/tenant/${session.tenant_id}/dashboard`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to load dashboard');
  }

  const tenantNameEl = document.getElementById('tenantHeading');
  const tenantSidebarEl = document.getElementById('tenantNameSidebar');
  if (tenantNameEl) tenantNameEl.textContent = data.tenant_name;
  if (tenantSidebarEl) tenantSidebarEl.textContent = data.tenant_name;

  const statPatients = document.getElementById('statPatients');
  const statAppointments = document.getElementById('statAppointments');
  const statRevenue = document.getElementById('statRevenue');
  const statEfficiency = document.getElementById('statEfficiency');
  if (statPatients) statPatients.textContent = data.summary.patients;
  if (statAppointments) statAppointments.textContent = data.summary.appointments;
  if (statRevenue) statRevenue.textContent = data.summary.revenue;
  if (statEfficiency) statEfficiency.textContent = data.summary.efficiency;

  const patientTableBody = document.getElementById('patientTableBody');
  if (patientTableBody) {
    if (!data.patients || data.patients.length === 0) {
      patientTableBody.innerHTML = '<tr><td colspan="6" class="text-muted">No patients yet.</td></tr>';
      return;
    }

    patientTableBody.innerHTML = data.patients
      .map(
        (patient) => `
          <tr>
            <td>${patient.id}</td>
            <td>${patient.name}</td>
            <td>${patient.phone}</td>
            <td>${patient.email || '-'}</td>
            <td><span class="badge bg-success-subtle text-success rounded-pill">${patient.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-danger delete-patient" data-id="${patient.id}">Delete</button>
            </td>
          </tr>
        `
      )
      .join('');

    patientTableBody.querySelectorAll('.delete-patient').forEach((button) => {
      button.addEventListener('click', async () => {
        const patientId = button.getAttribute('data-id');
        await deletePatient(patientId);
      });
    });
  }
}

async function createPatient(payload) {
  const session = getSession();
  const response = await fetch(`/api/tenant/${session.tenant_id}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Patient creation failed');
  }
  return data;
}

async function deletePatient(patientId) {
  const session = getSession();
  const response = await fetch(`/api/tenant/${session.tenant_id}/patients/${patientId}`, {
    method: 'DELETE',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Delete failed');
  }

  await getDashboard();
}

function attachLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      await loginUser(email, password);
    } catch (error) {
      alert(error.message);
    }
  });
}

function attachTenantOnboarding() {
  const form = document.getElementById('onboardingForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      tenant_name: document.getElementById('tenant_name').value,
      tenant_domain: document.getElementById('tenant_domain').value,
      admin_name: document.getElementById('admin_name').value,
      admin_email: document.getElementById('admin_email').value,
      admin_phone: document.getElementById('admin_phone').value,
      plan: document.getElementById('plan').value,
      region: document.getElementById('region').value,
    };

    try {
      await onboardTenant(payload);
    } catch (error) {
      alert(error.message);
    }
  });
}

function attachDashboard() {
  const patientForm = document.getElementById('patientForm');
  const refreshBtn = document.getElementById('refreshDashboard');
  const logoutBtn = document.getElementById('logoutBtn');

  const load = async () => {
    try {
      await getDashboard();
    } catch (error) {
      alert(error.message);
    }
  };

  if (refreshBtn) refreshBtn.addEventListener('click', load);

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('carestack_session');
      window.location.href = '/login.html';
    });
  }

  if (patientForm) {
    patientForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: document.getElementById('patientName').value,
        phone: document.getElementById('patientPhone').value,
        email: document.getElementById('patientEmail').value,
        age: Number(document.getElementById('patientAge').value || 0),
        notes: document.getElementById('patientNotes').value,
        status: 'active',
      };

      try {
        await createPatient(payload);
        const modal = bootstrap.Modal.getInstance(document.getElementById('patientModal'));
        if (modal) modal.hide();
        patientForm.reset();
        await getDashboard();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  load();
}

if (appPath.endsWith('/login.html')) {
  attachLoginForm();
}

if (appPath.endsWith('/onboarding.html')) {
  attachTenantOnboarding();
}

if (appPath.endsWith('/dashboard.html')) {
  attachDashboard();
}
