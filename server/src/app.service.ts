import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

type TenantUser = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
};

type Patient = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email?: string;
  age?: number;
  status: string;
  notes?: string;
  created_at?: string;
};

type Booking = {
  id: string;
  patient_name: string;
  phone_number: string;
  doctor_name: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes?: number;
  reason?: string;
  status: string;
  created_at?: string;
};

type Plan = {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  clinic_limit: number | null;
  user_limit: number | null;
};

type Tenant = {
  id: string;
  name: string;
  domain: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  plan: string;
  subscription_status: 'active' | 'paused';
  billing_cycle: 'monthly' | 'annual';
  monthly_price: number;
  region: string;
  users: TenantUser[];
  patients: Patient[];
  bookings: Booking[];
  voice_agent: { enabled: boolean; availability: 'all_day' | 'business_hours'; open_time: string; close_time: string; timezone: string; appointment_duration_minutes?: number; clinic_context?: any };
  telephony?: {
    provider: 'exotel'; voice_provider?: 'sarvam' | 'exotel_voicebot'; exotel_voicebot_id?: string;
    phone_number: string; account_sid: string; app_id: string; region: 'mumbai' | 'singapore'; enabled: boolean;
    provider_configs?: Record<string, { phone_number?: string; account_sid?: string; app_id?: string; region?: 'mumbai' | 'singapore'; enabled?: boolean; exotel_voicebot_id?: string; sarvam_org_id?: string; sarvam_workspace_id?: string; sarvam_agent_id?: string; sarvam_agent_version?: number; sarvam_connection_id?: string }>;
    exotel_api_key_encrypted?: string; exotel_api_token_encrypted?: string;
    sarvam_org_id?: string; sarvam_workspace_id?: string; sarvam_agent_id?: string; sarvam_agent_version?: number;
    sarvam_connection_id?: string; sarvam_deployment_id?: string;
  };
};
type ClinicInterest = { id: string; clinic_name: string; contact_name: string; email: string; phone: string; plan: string; created_at: string };

const defaultClinicContext = { address: '', services: [] as string[], doctors: [] as string[], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] as { question: string; answer: string }[] };
const defaultVoiceAgent = { enabled: true, availability: 'business_hours' as const, open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: defaultClinicContext };
const defaultTelephony = { provider: 'exotel' as const, voice_provider: 'sarvam' as const, exotel_voicebot_id: '', phone_number: '', account_sid: '', app_id: '', region: 'mumbai' as const, enabled: false };

export class AppService implements OnModuleInit, OnModuleDestroy {
  private tenants: Record<string, Tenant> = {};
  private clinicInterests: ClinicInterest[] = [];
  private readonly superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'superadmin@hospital.ai')).trim().toLowerCase();
  private readonly superAdminPasswordHash = process.env.SUPER_ADMIN_PASSWORD
    ? bcrypt.hashSync(process.env.SUPER_ADMIN_PASSWORD, 12)
    : process.env.NODE_ENV === 'production' ? '' : bcrypt.hashSync('admin123', 12);
  private planCatalog: Plan[] = [
    { id: 'starter', name: 'Starter', monthly_price: 4999, annual_price: 49990, clinic_limit: 1, user_limit: 3 },
    { id: 'growth', name: 'Growth', monthly_price: 14999, annual_price: 149990, clinic_limit: 5, user_limit: 15 },
    { id: 'enterprise', name: 'Enterprise', monthly_price: 39999, annual_price: 399990, clinic_limit: null, user_limit: null },
  ];
  private database?: Database.Database;
  private postgres?: Pool;
  private pendingPostgresWrite: Promise<void> = Promise.resolve();

  constructor() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
      this.postgres = new Pool({ connectionString: databaseUrl });
      return;
    }

    // SQLite is kept for local development. Render UAT uses DATABASE_URL,
    // which selects PostgreSQL and avoids relying on a persistent disk.
    const defaultDatabasePath = process.env.NODE_ENV === 'production'
      ? '/tmp/hospital.sqlite'
      : path.resolve(__dirname, '..', 'data', 'hospital.sqlite');
    const databasePath = process.env.DATABASE_PATH || defaultDatabasePath;
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = FULL');
    this.database.pragma('busy_timeout = 5000');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const savedState = this.database.prepare('SELECT payload FROM app_state WHERE id = 1').get() as { payload: string } | undefined;
    if (savedState) {
      if (this.loadState(savedState.payload)) this.persistState();
    } else {
      if (process.env.NODE_ENV !== 'production') this.seed();
      this.persistState();
    }

  }

  async onModuleInit() {
    if (!this.postgres) return;
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    const result = await this.postgres.query<{ payload: unknown }>('SELECT payload FROM app_state WHERE id = 1');
    if (result.rows[0]) {
      if (this.loadState(result.rows[0].payload as string | object)) await this.writePostgresState();
    } else {
      await this.writePostgresState();
    }
  }

  async onModuleDestroy() {
    await this.pendingPostgresWrite;
    await this.postgres?.end();
  }

  private loadState(payload: string | object) {
    const state = (typeof payload === 'string' ? JSON.parse(payload) : payload) as { tenants?: Record<string, Tenant & { users: Array<TenantUser & { password?: string }> }>; planCatalog?: Plan[]; clinicInterests?: ClinicInterest[] };
    this.tenants = state.tenants || {};
    this.planCatalog = state.planCatalog || this.planCatalog;
    this.clinicInterests = state.clinicInterests || [];
    return this.migratePasswordHashes();
  }

  private migratePasswordHashes() {
    let migrated = false;
    Object.values(this.tenants).forEach((tenant) => {
      const legacyVoiceAgent = tenant.voice_agent as typeof defaultVoiceAgent & { calling_number?: string } | undefined;
      const legacyNumber = (legacyVoiceAgent as any)?.calling_number || (tenant.id === 'tenant-skycare' ? (process.env.DEDICATED_CALL_NUMBER || '+91 90000 12345') : '');
      if (!tenant.telephony || legacyVoiceAgent?.calling_number !== undefined) {
        tenant.telephony = { ...defaultTelephony, ...(tenant.telephony || {}), phone_number: tenant.telephony?.phone_number || legacyNumber };
        tenant.voice_agent = { ...defaultVoiceAgent, ...(legacyVoiceAgent || {}) };
        delete (tenant.voice_agent as any).calling_number;
        migrated = true;
      }
      tenant.users.forEach((user) => {
      const legacyUser = user as TenantUser & { password?: string };
      if (!legacyUser.password_hash && legacyUser.password) {
        legacyUser.password_hash = bcrypt.hashSync(legacyUser.password, 12);
        delete legacyUser.password;
        migrated = true;
      }
      if (process.env.NODE_ENV === 'production' && bcrypt.compareSync('admin123', user.password_hash)) {
        // Imported demo users stay in the UAT data, but their known local
        // password cannot be used on the public service.
        user.password_hash = bcrypt.hashSync(randomBytes(24).toString('base64url'), 12);
        migrated = true;
      }
      });
    });
    return migrated;
  }

  private persistState() {
    const payload = JSON.stringify({ tenants: this.tenants, planCatalog: this.planCatalog, clinicInterests: this.clinicInterests });
    if (this.postgres) {
      this.pendingPostgresWrite = this.pendingPostgresWrite
        .catch(() => undefined)
        .then(() => this.writePostgresState(payload));
      return;
    }
    this.database!.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(payload, new Date().toISOString());
  }

  private async writePostgresState(payload = JSON.stringify({ tenants: this.tenants, planCatalog: this.planCatalog, clinicInterests: this.clinicInterests })) {
    if (!this.postgres) return;
    await this.postgres.query(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
    `, [payload]);
  }

  private seed() {
    const tenantId = 'tenant-skycare';
    this.tenants[tenantId] = {
      id: tenantId,
      name: 'SkyCare Multi-Speciality',
      domain: 'skycare',
      admin_name: 'Tenant Admin',
      admin_email: 'admin@skycare.in',
      admin_phone: '+91 99887 76655',
      plan: 'growth',
      subscription_status: 'active',
      billing_cycle: 'monthly',
      monthly_price: 14999,
      region: 'India',
      users: [
        {
          id: 'user-admin-1',
          tenant_id: tenantId,
          name: 'Tenant Admin',
          email: 'admin@skycare.in',
          role: 'tenant_admin',
          password_hash: bcrypt.hashSync(process.env.TENANT_DEFAULT_PASSWORD || 'admin123', 12),
        },
      ],
      patients: [
        {
          id: 'pat-1001',
          tenant_id: tenantId,
          name: 'Aarav Nair',
          phone: '+91 98765 10001',
          email: 'aarav@demo.in',
          age: 32,
          status: 'active',
          notes: 'Routine checkup',
          created_at: '2026-10-14T08:00:00.000Z',
        },
      ],
      bookings: [
        {
          id: 'APT-0001',
          patient_name: 'Aarav Nair',
          phone_number: '+91 98765 10001',
          doctor_name: 'Dr. Sarah Chen',
          appointment_date: '2026-10-20',
          appointment_time: '10:30',
          status: 'confirmed',
          created_at: '2026-10-14T08:15:00.000Z',
        },
      ],
      voice_agent: { ...defaultVoiceAgent },
      telephony: { ...defaultTelephony, phone_number: process.env.DEDICATED_CALL_NUMBER || '+91 90000 12345' },
    };
  }

  async login(email: string, password: string) {
    if (this.superAdminEmail && this.superAdminPasswordHash && email === this.superAdminEmail && await bcrypt.compare(password, this.superAdminPasswordHash)) {
      return {
        user_id: 'super-admin',
        role: 'super_admin',
        name: 'Super Admin',
        tenant_id: null,
        email,
      };
    }

    for (const tenant of Object.values(this.tenants)) {
      for (const user of tenant.users) {
        if (user.email === email && await bcrypt.compare(password, user.password_hash)) {
          if (tenant.subscription_status !== 'active') return null;
          return {
            user_id: user.id,
            role: user.role,
            name: user.name,
            tenant_id: tenant.id,
            tenant_domain: tenant.domain,
            email,
          };
        }
      }
    }

    return null;
  }

  listTenants() {
    return Object.values(this.tenants).map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      admin_name: tenant.admin_name,
      admin_email: tenant.admin_email,
      admin_phone: tenant.admin_phone,
      plan: tenant.plan,
      subscription_status: tenant.subscription_status,
      billing_cycle: tenant.billing_cycle,
      monthly_price: this.monthlyRevenueFor(tenant),
      region: tenant.region,
      patient_count: tenant.patients.length,
      booking_count: tenant.bookings.length,
      telephony: this.publicTelephony(tenant.telephony),
    }));
  }

  getTenantByDomain(domain: string) {
    const normalizedDomain = domain.trim().toLowerCase();
    const tenant = Object.values(this.tenants).find((item) => item.domain === normalizedDomain);
    if (!tenant) return null;
    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      subscription_status: tenant.subscription_status,
    };
  }

  isTenantActive(tenantId: string) {
    return this.tenants[tenantId]?.subscription_status === 'active';
  }

  getPlans() {
    return this.planCatalog;
  }

  createClinicInterest(payload: Omit<ClinicInterest, 'id' | 'created_at'>): ClinicInterest | null {
    if (!this.planCatalog.some((plan) => plan.id === payload.plan)) return null;
    const interest = { ...payload, id: `lead-${randomBytes(5).toString('hex')}`, created_at: new Date().toISOString() };
    this.clinicInterests.unshift(interest);
    this.persistState();
    return interest;
  }

  listClinicInterests() {
    return this.clinicInterests;
  }

  createPlan(payload: any) {
    const id = String(payload.id ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || this.planCatalog.some((plan) => plan.id === id)) {
      return null;
    }
    const monthlyPrice = Number(payload.monthly_price);
    const annualPrice = Number(payload.annual_price);
    if (!payload.name || monthlyPrice <= 0 || annualPrice <= 0) return null;

    const plan: Plan = {
      id,
      name: String(payload.name).trim(),
      monthly_price: monthlyPrice,
      annual_price: annualPrice,
      clinic_limit: payload.clinic_limit === '' || payload.clinic_limit == null ? null : Number(payload.clinic_limit),
      user_limit: payload.user_limit === '' || payload.user_limit == null ? null : Number(payload.user_limit),
    };
    this.planCatalog.push(plan);
    this.persistState();
    return plan;
  }

  updatePlan(planId: string, payload: any) {
    const plan = this.planCatalog.find((item) => item.id === planId);
    if (!plan) return null;
    const monthlyPrice = payload.monthly_price === undefined ? plan.monthly_price : Number(payload.monthly_price);
    const annualPrice = payload.annual_price === undefined ? plan.annual_price : Number(payload.annual_price);
    if (monthlyPrice <= 0 || annualPrice <= 0) return null;

    if (payload.name !== undefined) plan.name = String(payload.name).trim();
    plan.monthly_price = monthlyPrice;
    plan.annual_price = annualPrice;
    if (payload.clinic_limit !== undefined) {
      plan.clinic_limit = payload.clinic_limit === '' || payload.clinic_limit == null ? null : Number(payload.clinic_limit);
    }
    if (payload.user_limit !== undefined) {
      plan.user_limit = payload.user_limit === '' || payload.user_limit == null ? null : Number(payload.user_limit);
    }
    Object.values(this.tenants).filter((tenant) => tenant.plan === planId).forEach((tenant) => this.updateAdminPrice(tenant));
    this.persistState();
    return plan;
  }

  deletePlan(planId: string) {
    const planIndex = this.planCatalog.findIndex((plan) => plan.id === planId);
    if (planIndex < 0) return 'not_found';
    if (Object.values(this.tenants).some((tenant) => tenant.plan === planId)) return 'in_use';
    this.planCatalog.splice(planIndex, 1);
    this.persistState();
    return 'deleted';
  }

  getSuperAdminDashboard() {
    const tenants = Object.values(this.tenants);
    const planBreakdown = this.planCatalog.map((plan) => ({
      id: plan.id,
      name: plan.name,
      count: tenants.filter((tenant) => tenant.plan === plan.id).length,
    }));

    return {
      summary: {
        tenants: tenants.length,
        active: tenants.filter((tenant) => tenant.subscription_status === 'active').length,
        paused: tenants.filter((tenant) => tenant.subscription_status === 'paused').length,
        monthly_recurring_revenue: tenants.reduce((total, tenant) => total + this.monthlyRevenueFor(tenant), 0),
      },
      plan_breakdown: planBreakdown,
    };
  }

  createTenant(payload: any) {
    const tenantDomain = String(payload.tenant_domain ?? '').trim().toLowerCase();
    const adminEmail = String(payload.admin_email ?? '').trim().toLowerCase();
    const duplicate = Object.values(this.tenants).some((tenant) =>
      tenant.domain === tenantDomain || tenant.users.some((user) => user.email === adminEmail),
    );
    if (duplicate) return null;

    let tenantSequence = Object.keys(this.tenants).length + 1;
    while (this.tenants[`tenant-${tenantSequence}`]) tenantSequence += 1;
    const tenantId = `tenant-${tenantSequence}`;
    const adminId = `user-${tenantId}`;
    const requestedPlan = String(payload.plan || 'growth').toLowerCase();
    const plan = this.planCatalog.some((item) => item.id === requestedPlan) ? requestedPlan : 'growth';
    const adminPasswordWasProvided = typeof payload.admin_password === 'string' && payload.admin_password.length > 0;
    const temporaryPassword = adminPasswordWasProvided
      ? payload.admin_password
      : process.env.NODE_ENV === 'production'
        ? randomBytes(18).toString('base64url')
        : process.env.TENANT_DEFAULT_PASSWORD || 'admin123';
    const tenant: Tenant = {
      id: tenantId,
      name: payload.tenant_name,
      domain: tenantDomain,
      admin_name: payload.admin_name,
      admin_email: adminEmail,
      admin_phone: payload.admin_phone,
      plan,
      subscription_status: 'active',
      billing_cycle: payload.billing_cycle === 'annual' ? 'annual' : 'monthly',
      monthly_price: 0,
      region: payload.region || 'India',
      users: [
        {
          id: adminId,
          tenant_id: tenantId,
          name: payload.admin_name,
          email: adminEmail,
          role: 'tenant_admin',
          password_hash: bcrypt.hashSync(temporaryPassword, 12),
        },
      ],
      patients: [],
      bookings: [],
      voice_agent: { ...defaultVoiceAgent },
      telephony: { ...defaultTelephony },
    };
    this.updateAdminPrice(tenant);
    this.tenants[tenantId] = tenant;
    this.persistState();
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      domain: tenant.domain,
      admin_email: tenant.admin_email,
      password_set: adminPasswordWasProvided,
      plan: tenant.plan,
      subscription_status: tenant.subscription_status,
      billing_cycle: tenant.billing_cycle,
      ...(adminPasswordWasProvided ? {} : { temporary_password: temporaryPassword }),
    };
  }

  updateTenant(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;

    const nextDomain = payload.tenant_domain === undefined
      ? tenant.domain
      : String(payload.tenant_domain).trim().toLowerCase();
    const nextEmail = payload.admin_email === undefined
      ? tenant.admin_email
      : String(payload.admin_email).trim().toLowerCase();
    const conflict = Object.values(this.tenants).some((item) => item.id !== tenantId && (
      item.domain === nextDomain || item.users.some((user) => user.email === nextEmail)
    ));
    if (conflict) {
      throw new Error('Tenant domain or administrator email is already in use');
    }

    if (payload.tenant_name !== undefined) tenant.name = String(payload.tenant_name).trim();
    if (payload.tenant_domain !== undefined) tenant.domain = nextDomain;
    if (payload.admin_name !== undefined) tenant.admin_name = String(payload.admin_name).trim();
    if (payload.admin_email !== undefined) tenant.admin_email = nextEmail;
    if (payload.admin_phone !== undefined) tenant.admin_phone = String(payload.admin_phone).trim();
    if (payload.region !== undefined) tenant.region = String(payload.region).trim();
    if (payload.plan !== undefined && this.planCatalog.some((item) => item.id === payload.plan)) {
      tenant.plan = payload.plan;
    }
    if (payload.billing_cycle === 'monthly' || payload.billing_cycle === 'annual') {
      tenant.billing_cycle = payload.billing_cycle;
    }
    if (payload.subscription_status === 'active' || payload.subscription_status === 'paused') {
      tenant.subscription_status = payload.subscription_status;
    }

    const adminUser = tenant.users[0];
    if (adminUser) {
      adminUser.name = tenant.admin_name;
      adminUser.email = tenant.admin_email;
    }
    this.updateAdminPrice(tenant);
    this.persistState();
    return this.listTenants().find((item) => item.id === tenantId);
  }

  async setTenantAdminPassword(tenantId: string, password: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return 'not_found' as const;

    const adminUser = tenant.users.find((user) => user.email === tenant.admin_email)
      || tenant.users.find((user) => user.role === 'tenant_admin');
    if (!adminUser) return 'admin_not_found' as const;

    adminUser.password_hash = bcrypt.hashSync(password, 12);
    this.persistState();
    // Wait for PostgreSQL persistence before reporting success to the super-admin.
    await this.pendingPostgresWrite;
    return 'updated' as const;
  }

  updateVoiceAgent(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const current = { ...defaultVoiceAgent, ...(tenant.voice_agent || {}) };
    const next = { ...current, ...payload };
    next.appointment_duration_minutes = Number(next.appointment_duration_minutes || defaultVoiceAgent.appointment_duration_minutes);
    if (typeof next.enabled !== 'boolean' || !['all_day', 'business_hours'].includes(next.availability) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.open_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.close_time) ||
      typeof next.timezone !== 'string' || !next.timezone.trim() || ![15, 20, 30, 45, 60].includes(next.appointment_duration_minutes)) return false;
    delete (next as any).calling_number;
    if (next.availability === 'business_hours' && next.close_time <= next.open_time) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: next.timezone }); } catch { return false; }
    const context = payload?.clinic_context || current.clinic_context || defaultClinicContext;
    const boundedText = (value: any, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
    const cleanList = (value: any, limit: number) => Array.isArray(value) ? value.slice(0, 30).map((item) => boundedText(item, limit)).filter(Boolean) : [];
    const faqs = Array.isArray(context.faqs) ? context.faqs.slice(0, 25).map((item: any) => ({ question: boundedText(item?.question, 300), answer: boundedText(item?.answer, 1200) })).filter((item: any) => item.question && item.answer) : [];
    next.clinic_context = {
      address: boundedText(context.address, 500), services: cleanList(context.services, 160), doctors: cleanList(context.doctors, 160),
      fees: boundedText(context.fees, 2000), languages: cleanList(context.languages, 40).slice(0, 8),
      instructions: boundedText(context.instructions, 4000), faqs,
    };
    tenant.voice_agent = next;
    this.persistState();
    return tenant.voice_agent;
  }

  getVoiceAgent(tenantId: string) {
    const stored = this.tenants[tenantId]?.voice_agent;
    return { ...defaultVoiceAgent, ...(stored || {}), clinic_context: { ...defaultClinicContext, ...(stored?.clinic_context || {}) } };
  }

  private timeToMinutes(value: string) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(value: number) {
    const normalized = ((value % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  }

  private appointmentDuration(tenantId: string) {
    const configured = Number(this.getVoiceAgent(tenantId).appointment_duration_minutes);
    return [15, 20, 30, 45, 60].includes(configured) ? configured : defaultVoiceAgent.appointment_duration_minutes;
  }

  private findScheduleConflict(tenantId: string, date: string, time: string, doctor: string, duration = this.appointmentDuration(tenantId)) {
    const requestedStart = this.timeToMinutes(time);
    if (requestedStart === null || requestedStart + duration > 1440) return null;
    const tenant = this.tenants[tenantId];
    const normalizedDoctor = doctor.trim().toLocaleLowerCase();
    return tenant?.bookings.find((booking) => {
      if (booking.appointment_date !== date || booking.status === 'cancelled' || booking.status === 'no_show' || booking.doctor_name.trim().toLocaleLowerCase() !== normalizedDoctor) return false;
      const existingStart = this.timeToMinutes(booking.appointment_time);
      if (existingStart === null) return false;
      const existingDuration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
      return requestedStart < existingStart + existingDuration && existingStart < requestedStart + duration;
    }) || null;
  }

  private scheduleConflictMessage(tenantId: string, booking: Booking) {
    const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
    const start = this.timeToMinutes(booking.appointment_time) ?? 0;
    return `That appointment overlaps an existing booking for this doctor from ${booking.appointment_time} to ${this.minutesToTime(start + duration)}. Ask for a different time.`;
  }

  previewVoiceAgent(tenantId: string, callerMessage: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const settings = this.getVoiceAgent(tenantId);
    if (!settings.enabled) return { reply: `${tenant.name}'s booking assistant is currently unavailable. Please call again later or contact the clinic directly.`, status: 'paused' };
    const query = String(callerMessage || '').trim().toLowerCase();
    const faqMatch = settings.clinic_context.faqs.find((faq: any) => query && (query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query)));
    if (faqMatch) return { reply: faqMatch.answer, status: 'answered_from_clinic_faq' };
    const asksToBook = /book|appointment|visit|doctor|अपॉइंटमेंट|डॉक्टर/i.test(callerMessage);
    if (!asksToBook && query) {
      const context = settings.clinic_context;
      const known = [context.address, context.fees, ...context.services, ...context.doctors].filter(Boolean).some((item: string) => query.includes(item.toLowerCase()));
      if (known) return { reply: `For ${tenant.name}, I can share the clinic information saved in our system. Please ask for a specific service, doctor, fee, or the clinic address.`, status: 'clinic_context_available' };
    }
    if (!asksToBook) return { reply: `Hello, you have reached ${tenant.name}. I can help with booking an appointment. What would you like help with?`, status: 'listening' };
    if (settings.availability === 'all_day') return { reply: `I can help book an appointment at ${tenant.name}. Please tell me the patient's name, preferred doctor, date, and time.`, status: 'ready_to_collect' };
    const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    if (currentTime < settings.open_time || currentTime >= settings.close_time) {
      return { reply: `The clinic is currently closed for AI booking. Our booking line is open from ${settings.open_time} to ${settings.close_time} (${settings.timezone}). Please call again during those hours.`, status: 'closed' };
    }
    return { reply: `I can help book an appointment at ${tenant.name}. Our booking line is open until ${settings.close_time} (${settings.timezone}). Please tell me the patient's name, preferred doctor, date, and time.`, status: 'ready_to_collect' };
  }

  updateTenantTelephony(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const voiceProvider = payload.voice_provider === 'exotel_voicebot' ? 'exotel_voicebot' : payload.voice_provider === 'sarvam' || !payload.voice_provider ? 'sarvam' : null;
    if (!voiceProvider) return { error: 'Choose a supported AI voice provider.' };
    const existing = tenant.telephony;
    const configFields = ['phone_number', 'account_sid', 'app_id', 'region', 'enabled', 'exotel_voicebot_id', 'sarvam_org_id', 'sarvam_workspace_id', 'sarvam_agent_id', 'sarvam_agent_version', 'sarvam_connection_id'];
    const sanitizeProviderConfig = (value: any) => Object.fromEntries(configFields.filter((field) => Object.prototype.hasOwnProperty.call(value || {}, field)).map((field) => [field, value[field]]));
    const providerConfigs = Object.fromEntries(Object.entries(existing?.provider_configs || {}).map(([name, value]) => [name, sanitizeProviderConfig(value)]));
    const legacyProvider = existing?.voice_provider || 'sarvam';
    if (existing && !providerConfigs[legacyProvider]) providerConfigs[legacyProvider] = {
      phone_number: existing.phone_number, account_sid: existing.account_sid, app_id: existing.app_id,
      region: existing.region, enabled: existing.enabled, exotel_voicebot_id: existing.exotel_voicebot_id,
      sarvam_org_id: existing.sarvam_org_id, sarvam_workspace_id: existing.sarvam_workspace_id,
      sarvam_agent_id: existing.sarvam_agent_id, sarvam_agent_version: existing.sarvam_agent_version,
      sarvam_connection_id: existing.sarvam_connection_id,
    };
    if (payload.provider_configs && typeof payload.provider_configs === 'object') {
      for (const name of ['sarvam', 'exotel_voicebot']) {
        if (payload.provider_configs[name] && typeof payload.provider_configs[name] === 'object') {
          providerConfigs[name] = { ...(providerConfigs[name] || {}), ...sanitizeProviderConfig(payload.provider_configs[name]) };
        }
      }
    }
    const incoming = payload.provider_config && typeof payload.provider_config === 'object' ? payload.provider_config : payload;
    const selectedFields = Object.fromEntries(configFields.filter((field) => Object.prototype.hasOwnProperty.call(incoming, field)).map((field) => [field, incoming[field]]));
    const selected: Record<string, any> = { ...(providerConfigs[voiceProvider] || {}), ...selectedFields };
    const phoneNumber = String(selected.phone_number || '').trim().replace(/[\s()-]/g, '');
    const accountSid = String(selected.account_sid || '').trim();
    const appId = String(selected.app_id || '').trim();
    const region = selected.region === 'singapore' ? 'singapore' : 'mumbai';
    const exotelVoicebotId = String(selected.exotel_voicebot_id || '').trim();
    const apiKey = String(payload.exotel_api_key || '').trim();
    const apiToken = String(payload.exotel_api_token || '').trim();
    if (apiKey.length > 512 || apiToken.length > 512) return { error: 'Exotel API key and token must be 512 characters or fewer.' };
    if (voiceProvider === 'sarvam' && existing?.sarvam_deployment_id) {
      const deployedSarvam = existing.provider_configs?.sarvam;
      if (deployedSarvam && (
        deployedSarvam.phone_number !== phoneNumber || deployedSarvam.account_sid !== accountSid || deployedSarvam.app_id !== appId || deployedSarvam.region !== region ||
        deployedSarvam.sarvam_org_id !== String(selected.sarvam_org_id || '').trim() || deployedSarvam.sarvam_workspace_id !== String(selected.sarvam_workspace_id || '').trim() ||
        deployedSarvam.sarvam_agent_id !== String(selected.sarvam_agent_id || '').trim() || deployedSarvam.sarvam_agent_version !== (Number(selected.sarvam_agent_version) || undefined) ||
        deployedSarvam.sarvam_connection_id !== String(selected.sarvam_connection_id || '').trim()
      )) return { error: 'This Sarvam deployment is already active. Stop the deployment in Sarvam before changing its phone, connection, or agent settings.' };
    }
    if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) return { error: 'Enter the clinic Exophone in international E.164 format, for example +919876543210.' };
    if (Object.values(this.tenants).some((item) => item.id !== tenantId &&
      Object.values(item.telephony?.provider_configs || { [item.telephony?.voice_provider || 'sarvam']: item.telephony }).some((config: any) => (config?.phone_number || '').replace(/[\s()-]/g, '') === phoneNumber))) {
      return { error: 'This phone number is already assigned to another clinic. Each clinic must have its own unique Exophone.' };
    }
    let enabled = Boolean(selected.enabled);
    if (selected.enabled === false) enabled = false;
    if (selected.enabled === true) {
      if (voiceProvider === 'exotel_voicebot') {
        if (!accountSid || !appId || !exotelVoicebotId) return { error: 'For Exotel Voicebot, enter the Account SID, App / Flow ID, and Voicebot ID before enabling inbound calls.' };
        enabled = true;
      } else {
        if (!existing?.sarvam_deployment_id) return { error: 'Sarvam inbound calls cannot be enabled until the Sarvam deployment is active. Save the settings, then use Activate inbound calls.' };
        enabled = true;
      }
    }
    const savedSelected: Record<string, any> = { ...selected, phone_number: phoneNumber, account_sid: accountSid, app_id: appId, region, enabled, exotel_voicebot_id: exotelVoicebotId };
    providerConfigs[voiceProvider] = savedSelected;
    tenant.telephony = {
      provider: 'exotel', voice_provider: voiceProvider, exotel_voicebot_id: exotelVoicebotId,
      phone_number: phoneNumber, account_sid: accountSid, app_id: appId, region, enabled, provider_configs: providerConfigs,
      exotel_api_key_encrypted: apiKey ? this.encryptCredential(apiKey) : existing?.exotel_api_key_encrypted,
      exotel_api_token_encrypted: apiToken ? this.encryptCredential(apiToken) : existing?.exotel_api_token_encrypted,
      sarvam_org_id: String(savedSelected.sarvam_org_id || '').trim(),
      sarvam_workspace_id: String(savedSelected.sarvam_workspace_id || '').trim(),
      sarvam_agent_id: String(savedSelected.sarvam_agent_id || '').trim(),
      sarvam_agent_version: Number(savedSelected.sarvam_agent_version) || undefined,
      sarvam_connection_id: String(savedSelected.sarvam_connection_id || '').trim(),
      sarvam_deployment_id: tenant.telephony?.sarvam_deployment_id,
    };
    this.persistState();
    return this.publicTelephony(tenant.telephony);
  }

  private publicTelephony(config: Tenant['telephony']) {
    if (!config) return { ...defaultTelephony, credentials_configured: false, deployment_status: 'not_configured' };
    const voiceProvider = config.voice_provider || 'sarvam';
    const { exotel_api_key_encrypted: _encryptedKey, exotel_api_token_encrypted: _encryptedToken, ...publicConfig } = config;
    const exotelCredentialsConfigured = Boolean(
      (config.exotel_api_key_encrypted && config.exotel_api_token_encrypted) || (process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN),
    );
    return {
      ...publicConfig,
      provider_configs: config.provider_configs || { [voiceProvider]: {
        phone_number: config.phone_number, account_sid: config.account_sid, app_id: config.app_id, region: config.region,
        enabled: config.enabled, exotel_voicebot_id: config.exotel_voicebot_id,
        sarvam_org_id: config.sarvam_org_id, sarvam_workspace_id: config.sarvam_workspace_id,
        sarvam_agent_id: config.sarvam_agent_id, sarvam_agent_version: config.sarvam_agent_version, sarvam_connection_id: config.sarvam_connection_id,
      } },
      voice_provider: voiceProvider,
      enabled: Boolean(config.enabled),
      exotel_credentials_configured: exotelCredentialsConfigured,
      provider_credentials_configured: voiceProvider === 'exotel_voicebot'
        ? exotelCredentialsConfigured
        : Boolean(process.env.SARVAM_API_KEY),
      voice_tools_configured: (process.env.VOICE_TOOL_SECRET || '').length >= 32,
      credentials_configured: voiceProvider === 'exotel_voicebot'
        ? Boolean(process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN && (process.env.VOICE_TOOL_SECRET || '').length >= 32)
        : Boolean(process.env.SARVAM_API_KEY && (process.env.VOICE_TOOL_SECRET || '').length >= 32),
      deployment_status: voiceProvider === 'sarvam' ? (config.sarvam_deployment_id ? 'active' : 'not_deployed') :
        (config.enabled && config.exotel_voicebot_id && config.app_id ? 'active' : config.exotel_voicebot_id ? 'exotel_console_setup' : 'exotel_bot_required'),
    };
  }

  async verifyExotelConnection(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const config = tenant.telephony;
    if (!config?.account_sid) {
      return { error: 'Save this clinic’s Exotel Account SID first.' };
    }
    const apiKey = this.decryptCredential(config.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
    const apiToken = this.decryptCredential(config.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
    if (!apiKey || !apiToken) return { error: 'Enter this clinic’s Exotel API Key and API Token in calling settings, or configure the legacy server credentials.' };
    const host = config.region === 'singapore' ? 'https://api.exotel.com' : 'https://api.in.exotel.com';
    const url = `${host}/v1/Accounts/${encodeURIComponent(config.account_sid)}/Balance.json`;
    const authorization = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
    try {
      const response = await fetch(url, { headers: { Authorization: `Basic ${authorization}`, Accept: 'application/json' } });
      if (response.status === 401) {
        return {
          error: 'Exotel returned HTTP 401: it did not accept this CPaaS API Key/API Token pair. Re-enter the API Key and API Token shown together in Exotel Dashboard → Settings → API Settings, then save and verify again. These are CPaaS credentials, not Voicebot credentials or a temporary OAuth access token. Also confirm the selected API region matches the Exotel account.',
        };
      }
      if (response.status === 403) return { error: 'Exotel returned HTTP 403: the Account SID may not belong to this API Key/API Token pair, or the account is not allowed to access this resource. Copy the Account SID from the same Exotel API Settings account and confirm its region.' };
      if (!response.ok) return { error: `Exotel account check failed with HTTP ${response.status}.` };
      return { connected: true, provider: 'exotel', region: config.region, message: 'Exotel credentials were accepted for this clinic.' };
    } catch {
      return { error: 'Could not reach Exotel. Check server network access and the selected account region.' };
    }
  }

  private credentialEncryptionKey() {
    const dedicatedKey = process.env.CREDENTIALS_ENCRYPTION_KEY || '';
    if (process.env.NODE_ENV === 'production' && dedicatedKey.length < 32) {
      throw new Error('Configure CREDENTIALS_ENCRYPTION_KEY with at least 32 characters before saving provider credentials in production.');
    }
    const secret = dedicatedKey || process.env.JWT_SECRET || 'development-only-secret-change-before-production-0123456789';
    if (secret.length < 32) throw new Error('Set CREDENTIALS_ENCRYPTION_KEY or a JWT_SECRET of at least 32 characters before saving provider credentials.');
    return scryptSync(secret, 'carestack-provider-credentials-v1', 32);
  }

  private encryptCredential(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.credentialEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
  }

  private decryptCredential(value?: string) {
    if (!value) return '';
    try {
      const [encodedIv, encodedTag, encodedCiphertext] = value.split('.');
      if (!encodedIv || !encodedTag || !encodedCiphertext) return '';
      const decipher = createDecipheriv('aes-256-gcm', this.credentialEncryptionKey(), Buffer.from(encodedIv, 'base64'));
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64')), decipher.final()]).toString('utf8');
    } catch { return ''; }
  }

  validateVoiceToolSecret(tenantId: string, suppliedSecret: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length > 64) return false;
    const master = process.env.VOICE_TOOL_SECRET || '';
    if (master.length < 32) return false;
    const expected = Buffer.from(createHmac('sha256', master).update(tenantId).digest('hex'));
    const supplied = Buffer.from(suppliedSecret || '');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  getVoiceToolSecret(tenantId: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length > 64) return '';
    const master = process.env.VOICE_TOOL_SECRET || '';
    return master.length >= 32 ? createHmac('sha256', master).update(tenantId).digest('hex') : '';
  }

  async activateVoiceDeployment(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const config = tenant.telephony;
    if (config?.voice_provider === 'exotel_voicebot') return { error: 'Exotel Voicebot is activated in the Exotel console after its bot and inbound flow are configured.' };
    if (!config?.phone_number || !config.sarvam_org_id || !config.sarvam_workspace_id || !config.sarvam_agent_id ||
      !config.sarvam_agent_version || !config.sarvam_connection_id) return { error: 'Complete the clinic number and Sarvam deployment fields first.' };
    if (!process.env.SARVAM_API_KEY) return { error: 'SARVAM_API_KEY is not configured on the server.' };
    if ((process.env.VOICE_TOOL_SECRET || '').length < 32) return { error: 'VOICE_TOOL_SECRET must be configured on the server with at least 32 characters.' };
    if (config.sarvam_deployment_id) return { error: 'A Sarvam deployment is already active for this clinic. Pause or remove it in Sarvam before creating another.' };

    const url = `https://apps.sarvam.ai/api/app-authoring/v1/orgs/${encodeURIComponent(config.sarvam_org_id)}/workspaces/${encodeURIComponent(config.sarvam_workspace_id)}/deployments`;
    const deploymentName = `${tenant.name} inbound receptionist`.replace(/[^\w -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) || 'Clinic inbound receptionist';
    const payload: Record<string, unknown> = {
      name: deploymentName,
      app_id: config.sarvam_agent_id,
      app_version: config.sarvam_agent_version,
      description: `Inbound Hindi/Hinglish receptionist for ${tenant.name}`.slice(0, 150),
      connection_configs: [{ connection_id: config.sarvam_connection_id, phone_numbers: [config.phone_number] }],
    };
    const hours = this.getVoiceAgent(tenantId);
    if (hours.availability === 'business_hours') {
      payload.inbound_config = {
        start_time: hours.open_time, end_time: hours.close_time,
        allowed_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        timezone: hours.timezone,
      };
    }
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.SARVAM_API_KEY }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { deployment_id?: string; detail?: string; message?: string };
      if (!response.ok || !result.deployment_id) return { error: `Sarvam deployment failed (${response.status}). Check the Sarvam agent, Exotel connection, and phone number configuration.` };
      config.sarvam_deployment_id = result.deployment_id;
      config.enabled = true;
      config.provider_configs = { ...(config.provider_configs || {}), sarvam: { ...(config.provider_configs?.sarvam || {}), enabled: true } };
      this.persistState();
      return { deployment_id: result.deployment_id, telephony: this.publicTelephony(config) };
    } catch {
      return { error: 'Could not reach Sarvam. No deployment was confirmed; check Sarvam before retrying to avoid duplicates.' };
    }
  }

  voiceTool(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { error: 'Clinic not found.' };
    const action = String(payload?.action || '');
    if (action === 'clinic_info') {
      const hours = this.getVoiceAgent(tenantId);
      const context = hours.clinic_context;
      return {
        clinic_name: tenant.name,
        phone_number: tenant.telephony?.phone_number || tenant.admin_phone,
        booking_hours: hours.availability === 'all_day' ? 'all day' : `${hours.open_time}–${hours.close_time} ${hours.timezone}`,
        appointment_duration_minutes: this.appointmentDuration(tenantId),
        address: context.address || null, services: context.services, fees: context.fees || null, doctors: context.doctors,
        languages: context.languages, receptionist_instructions: context.instructions, faqs: context.faqs,
        response_policy: 'Only values returned here are approved. Offer a human receptionist for other clinic questions.',
      };
    }
    if (action === 'faq') {
      const query = String(payload?.question || payload?.query || '').trim().toLowerCase();
      if (!query) return { matched: false, handoff: true, message: 'Ask a specific clinic question or offer clinic staff.' };
      const match = this.getVoiceAgent(tenantId).clinic_context.faqs.find((faq: any) => query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query));
      return match ? { matched: true, question: match.question, answer: match.answer, source: 'clinic-approved FAQ' } : { matched: false, handoff: true, message: 'No approved FAQ answer found. Offer clinic staff; do not guess.' };
    }
    if (action === 'availability') {
      const date = String(payload.date || '');
      const time = String(payload.time || '');
      const doctor = String(payload.doctor_name || '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !this.isFutureClinicDate(tenantId, date, time) || !doctor) return { error: 'Provide a future date, valid time, and doctor name.' };
      const policy = this.validateAgentBooking(tenantId, time);
      if (policy) return { available: false, message: policy };
      const conflict = this.findScheduleConflict(tenantId, date, time, doctor);
      return { available: !conflict, date, time, duration_minutes: this.appointmentDuration(tenantId), doctor_name: doctor, source: 'clinic appointment calendar', message: conflict ? this.scheduleConflictMessage(tenantId, conflict) : 'No overlapping appointment is recorded for this doctor in the requested time window. Confirm with the caller before booking.' };
    }
    if (action === 'book') {
      if (payload.confirmed !== true) return { error: 'Caller confirmation is required before booking.' };
      const requestId = String(payload.request_id || '');
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) return { error: 'A unique request_id is required for safe retries.' };
      const date = String(payload.date || '');
      const time = String(payload.time || '');
      const patientName = String(payload.patient_name || '').trim();
      const phone = String(payload.phone_number || '').trim();
      const doctor = String(payload.doctor_name || '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !this.isFutureClinicDate(tenantId, date, time) || patientName.length < 2 || !/^\+?[\d\s()-]{8,20}$/.test(phone) || !doctor) return { error: 'Valid patient name, phone, doctor, future date, and time are required.' };
      const id = `VOICE-${requestId}`;
      const prior = tenant.bookings.find((booking) => booking.id === id);
      if (prior) return { appointment: prior, idempotent_replay: true };
      const policy = this.validateAgentBooking(tenantId, time);
      if (policy) return { error: policy };
      const duration = this.appointmentDuration(tenantId);
      const conflict = this.findScheduleConflict(tenantId, date, time, doctor, duration);
      if (conflict) return { error: this.scheduleConflictMessage(tenantId, conflict) };
      const appointment: Booking = { id, patient_name: patientName, phone_number: phone, doctor_name: doctor, appointment_date: date, appointment_time: time, duration_minutes: duration, reason: String(payload.reason || 'Inbound voice appointment'), status: 'confirmed' };
      const saved = this.addBooking(tenantId, appointment);
      if (!saved || 'error' in saved) return { error: saved && 'error' in saved ? saved.error : 'Could not save appointment.' };
      return { appointment: saved, idempotent_replay: false };
    }
    if (action === 'cancel' || action === 'reschedule') return { error: 'This appointment change is not enabled: patient verification and an authoritative scheduling integration are not configured. Offer a human receptionist.' };
    return { error: 'Unsupported action. Supported actions are clinic_info, faq, availability, and book.' };
  }

  private isFutureClinicDate(tenantId: string, date: string, time: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
    const timezone = this.getVoiceAgent(tenantId).timezone;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const today = `${values.year}-${values.month}-${values.day}`;
    return date > today || (date === today && time > `${values.hour}:${values.minute}`);
  }

  validateAgentBooking(tenantId: string, appointmentTime: string) {
    if (!this.tenants[tenantId]) return 'Tenant not found';
    const voiceAgent = this.getVoiceAgent(tenantId);
    if (!voiceAgent.enabled) return 'The clinic voice agent is currently disabled.';
    const start = this.timeToMinutes(appointmentTime);
    if (start === null) return 'Provide a valid appointment time in 24-hour HH:mm format.';
    const end = start + this.appointmentDuration(tenantId);
    if (end > 1440) return 'The appointment would extend past midnight. Choose an earlier time.';
    if (voiceAgent.availability === 'business_hours' && (start < (this.timeToMinutes(voiceAgent.open_time) ?? 0) || end > (this.timeToMinutes(voiceAgent.close_time) ?? 1440))) {
      return `This ${this.appointmentDuration(tenantId)}-minute appointment must finish by ${voiceAgent.close_time} (${voiceAgent.timezone}). Choose a time between ${voiceAgent.open_time} and ${voiceAgent.close_time}.`;
    }
    return null;
  }

  deleteTenant(tenantId: string) {
    if (!this.tenants[tenantId]) return false;
    delete this.tenants[tenantId];
    this.persistState();
    return true;
  }

  private monthlyRevenueFor(tenant: Tenant) {
    const plan = this.planCatalog.find((item) => item.id === tenant.plan);
    if (!plan || tenant.subscription_status !== 'active') return 0;
    return tenant.billing_cycle === 'annual' ? plan.annual_price / 12 : plan.monthly_price;
  }

  private updateAdminPrice(tenant: Tenant) {
    tenant.monthly_price = this.monthlyRevenueFor(tenant);
  }

  getDashboard(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { statusCode: 404, message: 'Tenant not found' };

    const analytics = this.getTenantAnalytics(tenant);

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      admin_name: tenant.admin_name,
      plan: tenant.plan,
      region: tenant.region,
      voice_agent: this.getVoiceAgent(tenantId),
      telephony: {
        phone_number: tenant.telephony?.phone_number || '',
        enabled: tenant.telephony?.enabled || false,
        voice_provider: tenant.telephony?.voice_provider || 'sarvam',
      },
      summary: {
        patients: tenant.patients.length,
        appointments: tenant.bookings.length,
        active_patients: tenant.patients.filter((patient) => patient.status === 'active').length,
        upcoming_appointments: analytics.summary.upcoming_appointments,
        completed_appointments: analytics.summary.completed_appointments,
        cancellation_rate: analytics.summary.cancellation_rate,
      },
      analytics,
      patients: tenant.patients,
      bookings: tenant.bookings,
    };
  }

  private getTenantAnalytics(tenant: Tenant) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const upcoming = tenant.bookings.filter((booking) =>
      booking.appointment_date >= todayKey && !['cancelled', 'no_show'].includes(booking.status),
    );
    const completed = tenant.bookings.filter((booking) => booking.status === 'completed').length;
    const cancelled = tenant.bookings.filter((booking) => booking.status === 'cancelled').length;
    const terminalCount = tenant.bookings.filter((booking) => ['completed', 'cancelled', 'no_show'].includes(booking.status)).length;
    const statuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
    const statusBreakdown = statuses.map((status) => ({
      status,
      count: tenant.bookings.filter((booking) => booking.status === status).length,
    }));
    const activityStart = new Date(today);
    activityStart.setUTCDate(today.getUTCDate() - 6);
    const priorStart = new Date(today);
    priorStart.setUTCDate(today.getUTCDate() - 13);
    const createdInRange = (createdAt: string | undefined, start: Date, end: Date) => {
      if (!createdAt) return false;
      const createdDate = createdAt.slice(0, 10);
      return createdDate >= start.toISOString().slice(0, 10) && createdDate <= end.toISOString().slice(0, 10);
    };
    const priorEnd = new Date(activityStart);
    priorEnd.setUTCDate(activityStart.getUTCDate() - 1);
    const activity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(activityStart);
      date.setUTCDate(activityStart.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date: dateKey,
        label: new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(date),
        patients: tenant.patients.filter((patient) => createdInRange(patient.created_at, date, date)).length,
        bookings: tenant.bookings.filter((booking) => createdInRange(booking.created_at, date, date)).length,
      };
    });
    const patientGrowth = {
      current: tenant.patients.filter((patient) => createdInRange(patient.created_at, activityStart, today)).length,
      previous: tenant.patients.filter((patient) => createdInRange(patient.created_at, priorStart, priorEnd)).length,
    };
    const bookingGrowth = {
      current: tenant.bookings.filter((booking) => createdInRange(booking.created_at, activityStart, today)).length,
      previous: tenant.bookings.filter((booking) => createdInRange(booking.created_at, priorStart, priorEnd)).length,
    };
    const schedule = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date: dateKey,
        label: new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(date),
        count: upcoming.filter((booking) => booking.appointment_date === dateKey).length,
      };
    });
    const doctorWorkload = [...upcoming.reduce((counts, booking) => {
      counts.set(booking.doctor_name, (counts.get(booking.doctor_name) || 0) + 1);
      return counts;
    }, new Map<string, number>())].map(([doctor, count]) => ({ doctor, count }))
      .sort((left, right) => right.count - left.count);

    return {
      summary: {
        active_patients: tenant.patients.filter((patient) => patient.status === 'active').length,
        upcoming_appointments: upcoming.length,
        completed_appointments: completed,
        cancellation_rate: terminalCount ? Math.round((cancelled / terminalCount) * 100) : 0,
        patient_activity: patientGrowth,
        booking_activity: bookingGrowth,
      },
      activity,
      schedule,
      status_breakdown: statusBreakdown,
      doctor_workload: doctorWorkload,
    };
  }

  getPatients(tenantId: string) {
    return this.tenants[tenantId]?.patients || [];
  }

  addBooking(tenantId: string, booking: Booking) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;

    const policyError = this.validateAgentBooking(tenantId, booking.appointment_time);
    if (policyError) return { error: policyError };

    const existing = tenant.bookings.find((item) => item.id === booking.id);
    if (existing) return existing;

    const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
    const conflict = this.findScheduleConflict(tenantId, booking.appointment_date, booking.appointment_time, booking.doctor_name, duration);
    if (conflict) return { error: this.scheduleConflictMessage(tenantId, conflict) };

    const savedBooking = { ...booking, duration_minutes: duration, created_at: booking.created_at || new Date().toISOString() };
    tenant.bookings.push(savedBooking);
    this.persistState();
    return savedBooking;
  }

  updateBookingStatus(tenantId: string, bookingId: string, status: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { error: 'Tenant not found' };
    const booking = tenant.bookings.find((item) => item.id === bookingId);
    if (!booking) return { error: 'Appointment not found' };
    booking.status = status;
    this.persistState();
    return booking;
  }

  addPatient(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { statusCode: 404, message: 'Tenant not found' };

    const patientId = `pat-${tenant.patients.length + 1001}`;
    const patient = {
      id: patientId,
      tenant_id: tenantId,
      name: payload.name,
      phone: payload.phone,
      email: payload.email || null,
      age: payload.age || null,
      status: payload.status || 'active',
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
    };
    tenant.patients.push(patient);
    this.persistState();
    return patient;
  }

  updatePatient(tenantId: string, patientId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { statusCode: 404, message: 'Tenant not found' };

    const patient = tenant.patients.find((item) => item.id === patientId);
    if (!patient) return { statusCode: 404, message: 'Patient not found' };

    Object.assign(patient, {
      name: payload.name || patient.name,
      phone: payload.phone || patient.phone,
      email: payload.email ?? patient.email,
      age: payload.age ?? patient.age,
      status: payload.status || patient.status,
      notes: payload.notes ?? patient.notes,
    });

    this.persistState();
    return patient;
  }

  deletePatient(tenantId: string, patientId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { statusCode: 404, message: 'Tenant not found' };

    const patientExists = tenant.patients.some((patient) => patient.id === patientId);
    if (!patientExists) return { statusCode: 404, message: 'Patient not found' };

    tenant.patients = tenant.patients.filter((patient) => patient.id !== patientId);
    this.persistState();
    return { deleted: true, patient_id: patientId };
  }
}
