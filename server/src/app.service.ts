import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

type TenantUser = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
  permissions?: string[];
  must_change_password?: boolean;
  temporary_password_expires_at?: number;
  password_reset_code_hash?: string;
  password_reset_expires_at?: number;
  avatar_data_url?: string | null;
  phone?: string;
  employee_id?: string;
};

const staffPermissions = new Set([
  'overview:view', 'agents:view', 'doctors:view', 'doctors:manage',
  'patients:view', 'patients:manage', 'appointments:view', 'appointments:manage', 'reports:view',
]);

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

type Doctor = {
  id: string;
  tenant_id: string;
  name: string;
  specialty: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type Booking = {
  id: string;
  patient_id?: string;
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

type ExotelCall = {
  call_sid: string;
  session_id?: string;
  conversation_id?: string;
  caller_phone?: string;
  landing_number?: string;
  session_state?: string;
  started_at?: string;
  ended_at?: string;
  transcript_segments: Array<{ speaker: string; text: string; start_timestamp?: string; end_timestamp?: string }>;
  recording_available?: boolean;
  booking_id?: string;
  updated_at: string;
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
  logo_data_url?: string | null;
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
  doctors?: Doctor[];
  exotel_calls?: ExotelCall[];
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
  private superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'superadmin@hospital.ai')).trim().toLowerCase();
  private superAdminPasswordHash = process.env.SUPER_ADMIN_PASSWORD
    ? bcrypt.hashSync(process.env.SUPER_ADMIN_PASSWORD, 12)
    : process.env.NODE_ENV === 'production' ? '' : bcrypt.hashSync('admin123', 12);
  private superAdminName = 'Super Admin';
  private superAdminAvatarDataUrl: string | null = null;
  private superAdminPhone = '';
  private superAdminEmployeeId = '';
  private superAdminPasswordResetCodeHash: string | null = null;
  private superAdminPasswordResetExpiresAt: number | null = null;
  private planCatalog: Plan[] = [
    { id: 'starter', name: 'Starter', monthly_price: 4999, annual_price: 49990, clinic_limit: 1, user_limit: 3 },
    { id: 'growth', name: 'Growth', monthly_price: 14999, annual_price: 149990, clinic_limit: 5, user_limit: 15 },
    { id: 'enterprise', name: 'Enterprise', monthly_price: 39999, annual_price: 399990, clinic_limit: null, user_limit: null },
  ];
  private database?: Database.Database;
  private postgres?: Pool;
  private pendingPostgresWrite: Promise<void> = Promise.resolve();
  private pendingPostgresPayload?: string;
  private postgresWriteScheduled = false;
  private readonly resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  private readonly emailFrom = (process.env.EMAIL_FROM || '').trim();

  constructor() {
    this.superAdminEmployeeId = this.createEmployeeId('Platform');
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
      // Keep a single shared pool for this service process. Bound connection
      // acquisition and SQL execution so tool calls fail clearly within the
      // integration's short request budget instead of waiting indefinitely.
      this.postgres = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2500, statement_timeout: 4500 });
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

  private async sendEmail(to: string, subject: string, text: string) {
    this.assertEmailConfigured();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.emailFrom, to: [to], subject, text }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Email delivery failed${detail ? `: ${detail.slice(0, 300)}` : '.'}`);
    }
  }

  private assertEmailConfigured() {
    if (!this.resendApiKey || !this.emailFrom) {
      throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM on the API service.');
    }
  }

  async onModuleInit() {
    if (!this.postgres) return;
    const started = performance.now();
    let outcome = 'success';
    try {
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
    } catch (error) {
      outcome = 'failure';
      throw error;
    } finally {
      console.info(JSON.stringify({ event: 'postgres.startup_timing', duration_ms: Number((performance.now() - started).toFixed(2)), outcome }));
    }
  }

  async onModuleDestroy() {
    await this.pendingPostgresWrite;
    await this.postgres?.end();
  }

  private loadState(payload: string | object) {
    const state = (typeof payload === 'string' ? JSON.parse(payload) : payload) as {
      tenants?: Record<string, Tenant & { users: Array<TenantUser & { password?: string }> }>;
      planCatalog?: Plan[];
      clinicInterests?: ClinicInterest[];
      superAdminProfile?: { name?: string; email?: string; avatar_data_url?: string | null; password_hash?: string; phone?: string; employee_id?: string; password_reset_code_hash?: string | null; password_reset_expires_at?: number | null };
    };
    this.tenants = state.tenants || {};
    this.planCatalog = state.planCatalog || this.planCatalog;
    this.clinicInterests = state.clinicInterests || [];
    if (state.superAdminProfile) {
      this.superAdminName = state.superAdminProfile.name || this.superAdminName;
      this.superAdminEmail = (state.superAdminProfile.email || this.superAdminEmail).trim().toLowerCase();
      this.superAdminAvatarDataUrl = state.superAdminProfile.avatar_data_url || null;
      this.superAdminPasswordHash = state.superAdminProfile.password_hash || this.superAdminPasswordHash;
      this.superAdminPhone = state.superAdminProfile.phone || '';
      this.superAdminEmployeeId = state.superAdminProfile.employee_id || this.superAdminEmployeeId;
      this.superAdminPasswordResetCodeHash = state.superAdminProfile.password_reset_code_hash || null;
      this.superAdminPasswordResetExpiresAt = state.superAdminProfile.password_reset_expires_at || null;
    }
    let migrated = this.migratePasswordHashes();
    if (!state.superAdminProfile || !state.superAdminProfile.employee_id || state.superAdminProfile.phone === undefined) migrated = true;
    return migrated;
  }

  private createEmployeeId(clinicName: string) {
    const prefix = String(clinicName || 'Clinic').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'CLINIC';
    const employeeIds = [this.superAdminEmployeeId, ...Object.values(this.tenants).flatMap((tenant) => tenant.users.map((user) => user.employee_id || ''))];
    const usedNumbers = new Set(employeeIds.filter((id) => id.startsWith(`${prefix}-`)).map((id) => Number(id.slice(prefix.length + 1))).filter(Number.isSafeInteger));
    let sequence = 1;
    while (usedNumbers.has(sequence)) sequence += 1;
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
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
      if (!Array.isArray(tenant.doctors)) {
        const legacyDoctors = tenant.voice_agent?.clinic_context?.doctors || [];
        const seen = new Set<string>();
        tenant.doctors = legacyDoctors.flatMap((entry: unknown, index: number) => {
          const value = String(entry || '').trim();
          if (!value || ['na', 'n/a', 'none', 'unknown', 'not available'].includes(value.toLocaleLowerCase())) return [];
          const parts = value.split(/\s+[—–-]\s+/, 2);
          const name = parts[0].trim();
          const specialty = parts[1]?.trim() || '';
          const key = name.toLocaleLowerCase();
          if (seen.has(key)) return [];
          seen.add(key);
          const now = new Date().toISOString();
          return [{ id: `doc-legacy-${index + 1}`, tenant_id: tenant.id, name, specialty, status: 'active' as const, created_at: now, updated_at: now }];
        });
        migrated = true;
      }
      const syncedDoctors = (tenant.doctors || []).filter((doctor) => doctor.status === 'active').map((doctor) => doctor.name);
      tenant.voice_agent ||= { ...defaultVoiceAgent };
      tenant.voice_agent.clinic_context ||= { ...defaultClinicContext };
      if (JSON.stringify(tenant.voice_agent.clinic_context.doctors || []) !== JSON.stringify(syncedDoctors)) {
        tenant.voice_agent.clinic_context.doctors = syncedDoctors;
        migrated = true;
      }
      tenant.users.forEach((user) => {
        if (user.role !== 'tenant_admin') return;
        if (!user.employee_id) {
          user.employee_id = this.createEmployeeId(tenant.name);
          migrated = true;
        }
        if (!user.phone && tenant.admin_phone) {
          user.phone = tenant.admin_phone;
          migrated = true;
        }
      });
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
    const payload = this.serializeState();
    if (this.postgres) {
      // Each payload contains a full state snapshot. While one snapshot is
      // being written, later mutations can replace the queued snapshot with a
      // newer one instead of forcing every caller to wait through redundant
      // sequential upserts. All waiters still await the final coalesced write.
      this.pendingPostgresPayload = payload;
      if (!this.postgresWriteScheduled) {
        this.postgresWriteScheduled = true;
        this.pendingPostgresWrite = this.pendingPostgresWrite
          .catch(() => undefined)
          .then(() => this.flushPendingPostgresWrites());
      }
      return;
    }
    this.database!.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(payload, new Date().toISOString());
  }

  private serializeState() {
    return JSON.stringify({
      tenants: this.tenants,
      planCatalog: this.planCatalog,
      clinicInterests: this.clinicInterests,
      superAdminProfile: {
        name: this.superAdminName,
        email: this.superAdminEmail,
        avatar_data_url: this.superAdminAvatarDataUrl,
        password_hash: this.superAdminPasswordHash,
        phone: this.superAdminPhone,
        employee_id: this.superAdminEmployeeId,
        password_reset_code_hash: this.superAdminPasswordResetCodeHash,
        password_reset_expires_at: this.superAdminPasswordResetExpiresAt,
      },
    });
  }

  private async flushPendingPostgresWrites() {
    try {
      while (this.pendingPostgresPayload !== undefined) {
        const payload = this.pendingPostgresPayload;
        this.pendingPostgresPayload = undefined;
        await this.writePostgresState(payload);
      }
    } finally {
      this.postgresWriteScheduled = false;
    }
  }

  private async writePostgresState(payload = this.serializeState()) {
    if (!this.postgres) return;
    const started = performance.now();
    try {
      await this.postgres.query(`
        INSERT INTO app_state (id, payload, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
      `, [payload]);
      console.info(JSON.stringify({ event: 'postgres.state_write_timing', duration_ms: Number((performance.now() - started).toFixed(2)), payload_bytes: Buffer.byteLength(payload), outcome: 'success' }));
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as any).code).slice(0, 32) : 'unknown';
      console.error(JSON.stringify({ event: 'postgres.state_write_timing', duration_ms: Number((performance.now() - started).toFixed(2)), payload_bytes: Buffer.byteLength(payload), outcome: 'failure', error_code: code }));
      throw error;
    }
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
          phone: '+91 99887 76655',
          employee_id: 'SKYCARE-MULTI-SPECIALITY-0001',
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
      doctors: [],
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
        name: this.superAdminName,
        tenant_id: null,
        email,
        avatar_data_url: this.superAdminAvatarDataUrl,
        phone: this.superAdminPhone,
        employee_id: this.superAdminEmployeeId,
      };
    }

    for (const tenant of Object.values(this.tenants)) {
      for (const user of tenant.users) {
        if (user.email.toLowerCase() === email.toLowerCase() && await bcrypt.compare(password, user.password_hash)) {
          if (user.must_change_password && user.temporary_password_expires_at && user.temporary_password_expires_at < Date.now()) return null;
          if (tenant.subscription_status !== 'active') return null;
          return {
            user_id: user.id,
            role: user.role,
            name: user.name,
            tenant_id: tenant.id,
            tenant_domain: tenant.domain,
            email,
            avatar_data_url: user.avatar_data_url || null,
            ...(user.role === 'tenant_admin' ? { phone: user.phone || tenant.admin_phone, employee_id: user.employee_id } : {}),
            permissions: user.role === 'tenant_admin' ? [...staffPermissions] : (user.permissions || []),
            must_change_password: Boolean(user.must_change_password),
          };
        }
      }
    }

    return null;
  }

  getStaffAccess(tenantId: string, userId: string) {
    const tenant = this.tenants[tenantId];
    const user = tenant?.users.find((item) => item.id === userId && item.role === 'receptionist');
    return user ? { tenant_id: tenantId, role: user.role, permissions: user.permissions || [] } : null;
  }

  listStaff(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    return tenant.users.filter((user) => user.role !== 'tenant_admin').map(({ id, name, email, role, permissions }) => ({ id, tenant_id: tenantId, name, email, role, permissions: permissions || [] }));
  }

  createStaff(tenantId: string, payload: { name: string; email: string; password: string; permissions: string[] }) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const email = payload.email.trim().toLowerCase();
    if (email === this.superAdminEmail || Object.values(this.tenants).some((item) => item.users.some((user) => user.email.toLowerCase() === email))) return false;
    const user: TenantUser = {
      id: `staff-${randomUUID()}`, tenant_id: tenantId, name: payload.name.trim(), email,
      role: 'receptionist', password_hash: bcrypt.hashSync(payload.password, 12),
      permissions: [...new Set(payload.permissions)].filter((permission) => staffPermissions.has(permission)),
    };
    tenant.users.push(user);
    this.persistState();
    return { id: user.id, tenant_id: user.tenant_id, name: user.name, email: user.email, role: user.role, permissions: user.permissions };
  }

  updateStaff(tenantId: string, staffId: string, payload: { name?: string; email?: string; password?: string; permissions?: string[] }) {
    const tenant = this.tenants[tenantId];
    const user = tenant?.users.find((item) => item.id === staffId && item.role !== 'tenant_admin');
    if (!tenant || !user) return null;
    if (payload.email) {
      const email = payload.email.trim().toLowerCase();
      if (email === this.superAdminEmail || Object.values(this.tenants).some((item) => item.users.some((candidate) => candidate.id !== staffId && candidate.email.toLowerCase() === email))) return false;
      user.email = email;
    }
    if (payload.name !== undefined) user.name = payload.name.trim();
    if (payload.password) user.password_hash = bcrypt.hashSync(payload.password, 12);
    if (payload.permissions) user.permissions = [...new Set(payload.permissions)].filter((permission) => staffPermissions.has(permission));
    this.persistState();
    return { id: user.id, tenant_id: user.tenant_id, name: user.name, email: user.email, role: user.role, permissions: user.permissions || [] };
  }

  deleteStaff(tenantId: string, staffId: string) {
    const tenant = this.tenants[tenantId];
    const user = tenant?.users.find((item) => item.id === staffId && item.role !== 'tenant_admin');
    if (!tenant || !user) return false;
    tenant.users = tenant.users.filter((item) => item.id !== staffId);
    this.persistState();
    return true;
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
      logo_configured: Boolean(tenant.logo_data_url),
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
      logo_data_url: tenant.logo_data_url || null,
      subscription_status: tenant.subscription_status,
    };
  }

  getTenantDetails(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    return {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      logo_data_url: tenant.logo_data_url || null,
      admin_name: tenant.admin_name,
      admin_email: tenant.admin_email,
      admin_phone: tenant.admin_phone,
      plan: tenant.plan,
      subscription_status: tenant.subscription_status,
      billing_cycle: tenant.billing_cycle,
      region: tenant.region,
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

  async createTenant(payload: any) {
    this.assertEmailConfigured();
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
    const temporaryPassword = String(randomInt(10000000, 100000000));
    const temporaryPasswordExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const tenant: Tenant = {
      id: tenantId,
      name: payload.tenant_name,
      domain: tenantDomain,
      logo_data_url: payload.logo_data_url || null,
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
          must_change_password: true,
          temporary_password_expires_at: temporaryPasswordExpiresAt,
          phone: String(payload.admin_phone || '').trim(),
          employee_id: this.createEmployeeId(payload.tenant_name),
        },
      ],
      patients: [],
      bookings: [],
      doctors: [],
      voice_agent: { ...defaultVoiceAgent },
      telephony: { ...defaultTelephony },
    };
    this.updateAdminPrice(tenant);
    const frontendUrl = (process.env.FRONTEND_PUBLIC_URL || 'https://carestack-uat-web.onrender.com').replace(/\/+$/, '');
    await this.sendEmail(
      adminEmail,
      `Your ${tenant.name} clinic account is ready`,
      `Hello ${tenant.admin_name},\n\nYour clinic account for ${tenant.name} is ready.\n\nSign in: ${frontendUrl}/?tenant=${encodeURIComponent(tenantDomain)}\nEmail: ${adminEmail}\nOne-time password: ${temporaryPassword}\n\nThis password expires in 24 hours and must be changed after your first sign-in. If you did not expect this email, contact your clinic administrator.`,
    );
    this.tenants[tenantId] = tenant;
    this.persistState();
    await this.pendingPostgresWrite;
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      domain: tenant.domain,
      admin_email: tenant.admin_email,
      email_sent: true,
      plan: tenant.plan,
      subscription_status: tenant.subscription_status,
      billing_cycle: tenant.billing_cycle,
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
    if (payload.logo_data_url !== undefined) tenant.logo_data_url = payload.logo_data_url || null;
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

    const adminUser = tenant.users.find((user) => user.role === 'tenant_admin') || tenant.users[0];
    if (adminUser) {
      adminUser.name = tenant.admin_name;
      adminUser.email = tenant.admin_email;
      adminUser.phone = tenant.admin_phone;
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
    adminUser.must_change_password = false;
    delete adminUser.temporary_password_expires_at;
    this.persistState();
    // Wait for PostgreSQL persistence before reporting success to the super-admin.
    await this.pendingPostgresWrite;
    return 'updated' as const;
  }

  async changeOwnPassword(tenantId: string | null, userId: string, currentPassword: string | undefined, password: string) {
    if (userId === 'super-admin' && tenantId === null) {
      if (!this.superAdminPasswordHash) return 'not_found' as const;
      if (!currentPassword || !await bcrypt.compare(currentPassword, this.superAdminPasswordHash)) return 'current_password_invalid' as const;
      this.superAdminPasswordHash = bcrypt.hashSync(password, 12);
      this.superAdminPasswordResetCodeHash = null;
      this.superAdminPasswordResetExpiresAt = null;
      this.persistState();
      await this.pendingPostgresWrite;
      return 'updated' as const;
    }

    const user = tenantId ? this.tenants[tenantId]?.users.find((item) => item.id === userId) : undefined;
    if (!user) return 'not_found' as const;
    if (!user.must_change_password && (!currentPassword || !await bcrypt.compare(currentPassword, user.password_hash))) return 'current_password_invalid' as const;
    user.password_hash = bcrypt.hashSync(password, 12);
    user.must_change_password = false;
    delete user.temporary_password_expires_at;
    delete user.password_reset_code_hash;
    delete user.password_reset_expires_at;
    this.persistState();
    await this.pendingPostgresWrite;
    return 'updated' as const;
  }

  getOwnProfile(tenantId: string | null, userId: string) {
    if (userId === 'super-admin' && tenantId === null) {
      return {
        user_id: userId,
        role: 'super_admin',
        tenant_id: null,
        name: this.superAdminName,
        email: this.superAdminEmail,
        avatar_data_url: this.superAdminAvatarDataUrl,
        phone: this.superAdminPhone,
        employee_id: this.superAdminEmployeeId,
      };
    }
    const tenant = tenantId ? this.tenants[tenantId] : undefined;
    const user = tenant?.users.find((item) => item.id === userId && item.role === 'tenant_admin');
    if (!tenant || !user) return null;
    user.employee_id ||= this.createEmployeeId(tenant.name);
    return {
      user_id: user.id,
      role: user.role,
      tenant_id: tenant.id,
      tenant_domain: tenant.domain,
      name: user.name,
      email: user.email,
      avatar_data_url: user.avatar_data_url || null,
      phone: user.phone || tenant.admin_phone || '',
      employee_id: user.employee_id,
      permissions: [...staffPermissions],
      must_change_password: Boolean(user.must_change_password),
    };
  }

  async updateOwnProfile(tenantId: string | null, userId: string, profile: { name: string; email: string; phone?: string | null; avatar_data_url?: string | null }) {
    const name = profile.name.trim();
    const email = profile.email.trim().toLowerCase();
    if (!name || !email) return 'invalid' as const;
    const emailTaken = Object.values(this.tenants).some((tenant) => tenant.users.some((user) =>
      user.email.toLowerCase() === email && !(tenant.id === tenantId && user.id === userId))) ||
      (email === this.superAdminEmail && userId !== 'super-admin');
    if (emailTaken) return 'email_taken' as const;

    if (userId === 'super-admin' && tenantId === null) {
      this.superAdminName = name;
      this.superAdminEmail = email;
      if (profile.avatar_data_url !== undefined) this.superAdminAvatarDataUrl = profile.avatar_data_url || null;
      if (profile.phone !== undefined) this.superAdminPhone = profile.phone?.trim() || '';
      this.persistState();
      await this.pendingPostgresWrite;
      return { user_id: userId, role: 'super_admin', tenant_id: null, name, email, avatar_data_url: this.superAdminAvatarDataUrl, phone: this.superAdminPhone, employee_id: this.superAdminEmployeeId };
    }

    const tenant = tenantId ? this.tenants[tenantId] : undefined;
    const user = tenant?.users.find((item) => item.id === userId);
    if (!tenant || !user || user.role !== 'tenant_admin') return 'not_found' as const;
    user.name = name;
    user.email = email;
    user.employee_id ||= this.createEmployeeId(tenant.name);
    if (profile.avatar_data_url !== undefined) user.avatar_data_url = profile.avatar_data_url || null;
    if (profile.phone !== undefined) user.phone = profile.phone?.trim() || '';
    tenant.admin_name = name;
    tenant.admin_email = email;
    if (profile.phone !== undefined) tenant.admin_phone = profile.phone?.trim() || '';
    this.persistState();
    await this.pendingPostgresWrite;
    return {
      user_id: user.id,
      role: user.role,
      tenant_id: tenant.id,
      tenant_domain: tenant.domain,
      name: user.name,
      email: user.email,
      avatar_data_url: user.avatar_data_url || null,
      phone: user.phone || '',
      employee_id: user.employee_id,
      permissions: [...staffPermissions],
      must_change_password: Boolean(user.must_change_password),
    };
  }

  async requestPasswordReset(email: string) {
    this.assertEmailConfigured();
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === this.superAdminEmail) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      this.superAdminPasswordResetCodeHash = createHash('sha256').update(code).digest('hex');
      this.superAdminPasswordResetExpiresAt = Date.now() + 15 * 60 * 1000;
      this.persistState();
      await this.pendingPostgresWrite;
      await this.sendEmail(
        this.superAdminEmail,
        'Your CareStack platform password reset code',
        `Hello ${this.superAdminName},\n\nYour platform administrator password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this code, you can ignore this email.`,
      );
      return { message: 'If an account matches that email, a password reset code has been sent.' };
    }

    const user = Object.values(this.tenants).flatMap((item) => item.users)
      .find((item) => item.email.toLowerCase() === normalizedEmail);
    if (user) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      user.password_reset_code_hash = createHash('sha256').update(code).digest('hex');
      user.password_reset_expires_at = Date.now() + 15 * 60 * 1000;
      this.persistState();
      await this.pendingPostgresWrite;
      await this.sendEmail(
        user.email,
        'Your CareStack password reset code',
        `Hello ${user.name},\n\nYour password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this code, you can ignore this email.`,
      );
    }
    return { message: 'If an account matches that email, a password reset code has been sent.' };
  }

  async resetPassword(email: string, code: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === this.superAdminEmail) {
      if (!this.superAdminPasswordResetCodeHash || !this.superAdminPasswordResetExpiresAt || this.superAdminPasswordResetExpiresAt < Date.now()) return false;
      const suppliedHash = createHash('sha256').update(code).digest();
      const savedHash = Buffer.from(this.superAdminPasswordResetCodeHash, 'hex');
      if (savedHash.length !== suppliedHash.length || !timingSafeEqual(savedHash, suppliedHash)) return false;
      this.superAdminPasswordHash = bcrypt.hashSync(password, 12);
      this.superAdminPasswordResetCodeHash = null;
      this.superAdminPasswordResetExpiresAt = null;
      this.persistState();
      await this.pendingPostgresWrite;
      return true;
    }

    const user = Object.values(this.tenants).flatMap((item) => item.users)
      .find((item) => item.email.toLowerCase() === normalizedEmail);
    if (!user?.password_reset_code_hash || !user.password_reset_expires_at || user.password_reset_expires_at < Date.now()) return false;
    const suppliedHash = createHash('sha256').update(code).digest();
    const savedHash = Buffer.from(user.password_reset_code_hash, 'hex');
    if (savedHash.length !== suppliedHash.length || !timingSafeEqual(savedHash, suppliedHash)) return false;
    user.password_hash = bcrypt.hashSync(password, 12);
    user.must_change_password = false;
    delete user.temporary_password_expires_at;
    delete user.password_reset_code_hash;
    delete user.password_reset_expires_at;
    this.persistState();
    await this.pendingPostgresWrite;
    return true;
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
      address: boundedText(context.address, 500), services: cleanList(context.services, 160), doctors: this.getActiveDoctorNames(tenantId),
      fees: boundedText(context.fees, 2000), languages: cleanList(context.languages, 40).slice(0, 8),
      instructions: boundedText(context.instructions, 4000), faqs,
    };
    tenant.voice_agent = next;
    this.persistState();
    return tenant.voice_agent;
  }

  getVoiceAgent(tenantId: string) {
    const stored = this.tenants[tenantId]?.voice_agent;
    return {
      ...defaultVoiceAgent,
      ...(stored || {}),
      clinic_context: {
        ...defaultClinicContext,
        ...(stored?.clinic_context || {}),
        doctors: this.getActiveDoctorNames(tenantId),
      },
    };
  }

  private getActiveDoctorNames(tenantId: string) {
    return (this.tenants[tenantId]?.doctors || [])
      .filter((doctor) => doctor.status === 'active')
      .map((doctor) => doctor.name);
  }

  getDoctors(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    tenant.doctors ||= [];
    return [...tenant.doctors].sort((left, right) => left.name.localeCompare(right.name));
  }

  async addDoctor(tenantId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    tenant.doctors ||= [];
    const name = String(payload?.name || '').trim();
    const specialty = String(payload?.specialty || '').trim();
    if (name.length < 2 || name.length > 120) return { error: 'Doctor name must be between 2 and 120 characters.' };
    if (specialty.length > 160) return { error: 'Specialty must be 160 characters or fewer.' };
    if (['na', 'n/a', 'none', 'unknown', 'not available'].includes(name.toLocaleLowerCase())) return { error: 'Enter a real doctor name.' };
    if (tenant.doctors.some((doctor) => doctor.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { error: 'This doctor is already in the clinic roster.' };

    const now = new Date().toISOString();
    const doctor: Doctor = { id: `doc-${randomUUID()}`, tenant_id: tenantId, name, specialty, status: 'active', created_at: now, updated_at: now };
    tenant.doctors.push(doctor);
    this.syncDoctorNames(tenantId);
    try {
      this.persistState();
      await this.waitForPendingPersistence();
    } catch (error) {
      tenant.doctors = tenant.doctors.filter((item) => item.id !== doctor.id);
      this.syncDoctorNames(tenantId);
      throw error;
    }
    return doctor;
  }

  async updateDoctor(tenantId: string, doctorId: string, payload: any) {
    const tenant = this.tenants[tenantId];
    const doctor = tenant?.doctors?.find((item) => item.id === doctorId);
    if (!tenant || !doctor) return null;
    const previous = { ...doctor };
    const name = payload?.name === undefined ? doctor.name : String(payload.name).trim();
    const specialty = payload?.specialty === undefined ? doctor.specialty : String(payload.specialty || '').trim();
    const status = payload?.status === undefined ? doctor.status : payload.status;
    if (name.length < 2 || name.length > 120) return { error: 'Doctor name must be between 2 and 120 characters.' };
    if (specialty.length > 160) return { error: 'Specialty must be 160 characters or fewer.' };
    if (!['active', 'inactive'].includes(status)) return { error: 'Doctor status must be active or inactive.' };
    if (tenant.doctors!.some((item) => item.id !== doctorId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { error: 'This doctor is already in the clinic roster.' };

    Object.assign(doctor, { name, specialty, status, updated_at: new Date().toISOString() });
    this.syncDoctorNames(tenantId);
    try {
      this.persistState();
      await this.waitForPendingPersistence();
    } catch (error) {
      Object.assign(doctor, previous);
      this.syncDoctorNames(tenantId);
      throw error;
    }
    return doctor;
  }

  private syncDoctorNames(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return;
    tenant.voice_agent ||= { ...defaultVoiceAgent };
    tenant.voice_agent.clinic_context ||= { ...defaultClinicContext };
    tenant.voice_agent.clinic_context.doctors = this.getActiveDoctorNames(tenantId);
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

  private logVoiceToolStage(traceId: string, tenantId: string, action: string, stage: string, details: Record<string, unknown> = {}) {
    console.info(JSON.stringify({ event: 'voice_tool.stage', trace_id: traceId, tenant_id: tenantId, action, stage, ...details }));
  }

  private voiceToolFailureCode(message: unknown) {
    const text = String(message || '').toLowerCase();
    if (text.includes('missing required booking fields')) return 'missing_required_booking_fields';
    if (text.includes('caller confirmation')) return 'caller_confirmation_missing';
    if (text.includes('request_id')) return 'invalid_request_id';
    if (text.includes('patient_name')) return 'invalid_patient_name';
    if (text.includes('phone_number')) return 'invalid_phone_number';
    if ((text.includes('doctor_name') && (text.includes('match') || text.includes('configured') || text.includes('clinic doctor list'))) || text.includes('not in the clinic doctor list')) return 'doctor_not_configured';
    if (text.includes('overlap') || text.includes('conflict') || text.includes('already booked')) return 'slot_conflict';
    if (text.includes('time has passed')) return 'requested_time_in_past';
    if (text.includes('storage') || text.includes('persist')) return 'booking_storage_failure';
    if (text.includes('no doctors are configured') || text.includes('no doctor')) return 'doctor_availability_unavailable';
    if (text.includes('hours') || text.includes('currently disabled') || text.includes('booking is currently unavailable') || text.includes('finish by')) return 'booking_policy_rejected';
    if (text.includes('date') || text.includes('time')) return 'invalid_date_or_time';
    if (text.includes('clinic not found')) return 'clinic_not_found';
    return 'tool_validation_rejected';
  }

  private voiceToolResultDetails(action: string, result: any): Record<string, unknown> {
    if (result && typeof result === 'object' && 'error' in result) {
      const missingFields = /^Missing required booking fields:\s*([a-z_, ]+)\.?$/i.exec(String(result.error));
      return {
        outcome: result.unavailable ? 'dependency_unavailable' : 'rejected',
        reason_code: this.voiceToolFailureCode(result.error),
        ...(missingFields ? { missing_fields: missingFields[1].split(',').map((field) => field.trim()).filter(Boolean) } : {}),
      };
    }
    if (action === 'availability') {
      const checked = result?.check_status === 'checked';
      return {
        outcome: checked ? 'success' : result?.check_status === 'error' ? 'not_checked' : result?.available === false ? 'rejected' : 'success',
        availability: checked ? (result.available ? 'available' : 'unavailable') : 'not_checked',
        ...(!checked && result?.message ? { reason_code: this.voiceToolFailureCode(result.message) } : {}),
        available_doctor_count: Array.isArray(result?.available_doctors) ? result.available_doctors.length : 0,
        alternative_slot_count: Array.isArray(result?.available_slots) ? result.available_slots.length : 0,
      };
    }
    if (action === 'book') {
      if (result?.appointment) {
        return { outcome: 'success', appointment_id_present: Boolean(result.appointment.id), idempotent_replay: result.idempotent_replay === true };
      }
      if (result?.confirmation_required === true) return { outcome: 'confirmation_required', reason_code: 'doctor_confirmation_required' };
      if (result?.booked === false) return { outcome: 'not_booked', reason_code: 'booking_not_created' };
    }
    return { outcome: 'success' };
  }

  async voiceTool(tenantId: string, payload: any, traceId = randomUUID()) {
    const started = performance.now();
    const actionValue = String(payload?.action || '').trim().toLowerCase();
    const action = ['clinic_info', 'faq', 'availability', 'book'].includes(actionValue) ? actionValue : 'unknown';
    let outcome = 'success';
    let reasonCode: string | undefined;
    this.logVoiceToolStage(traceId, tenantId, action, 'action_started');
    try {
      const result = await this.dispatchVoiceTool(tenantId, payload, traceId);
      const details = this.voiceToolResultDetails(action, result);
      outcome = String(details.outcome || 'success');
      reasonCode = typeof details.reason_code === 'string' ? details.reason_code : undefined;
      this.logVoiceToolStage(traceId, tenantId, action, 'action_result', details);
      return result;
    } catch (error) {
      outcome = 'error';
      reasonCode = 'unexpected_exception';
      this.logVoiceToolStage(traceId, tenantId, action, 'action_exception', { outcome, reason_code: reasonCode });
      throw error;
    } finally {
      console.info(JSON.stringify({ event: 'voice_tool.service_timing', trace_id: traceId, tenant_id: tenantId, action, duration_ms: Number((performance.now() - started).toFixed(2)), outcome, ...(reasonCode ? { reason_code: reasonCode } : {}) }));
    }
  }

  private async dispatchVoiceTool(tenantId: string, payload: any, traceId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { error: 'Clinic not found.' };
    const action = String(payload?.action ?? '').trim().toLowerCase();
    if (action === 'clinic_info') {
      const hours = this.getVoiceAgent(tenantId);
      const context = hours.clinic_context;
      return {
        clinic_name: tenant.name,
        phone_number: tenant.telephony?.phone_number || tenant.admin_phone,
        booking_hours: hours.availability === 'all_day' ? 'all day' : `${hours.open_time}–${hours.close_time} ${hours.timezone}`,
        availability_source: 'portal appointment calendar',
        appointment_duration_minutes: this.appointmentDuration(tenantId),
        address: context.address || null, services: context.services, fees: context.fees || null, doctors: this.getClinicDoctorCandidates(tenantId),
        doctor_directory: this.getActiveClinicDoctorDirectory(tenantId),
        doctor_list_source: 'clinic database roster',
        languages: context.languages, receptionist_instructions: context.instructions, faqs: context.faqs,
        response_policy: 'Only live CareStack tool results are approved. Never invent, guess, autocomplete, or substitute a doctor name. If doctors is empty, say the clinic has not provided a doctor list and offer clinic staff; do not name a doctor. Keep the caller’s current appointment request and already collected answers in context across every tool call. An availability result is an intermediate step: do not end the conversation or restart intake after it. If available, tell the caller the exact doctor, date, and time returned, ask only for booking details that are still missing, then read back the patient name, reachable confirmed phone, doctor, date, and time together and get clear final confirmation. After that confirmation, immediately call carestack_book_appointment in the same conversation with action=book, confirmed=true, and the exact confirmed details. Never call book before final confirmation. If the caller chooses an alternative slot, check that exact slot with availability before booking. If availability was not checked or returned available=null, do not book. The patient name may differ from the caller: use only the exact name the caller stated; never invent, complete, translate, normalize, or substitute it. If unclear, ask the caller to repeat or spell it. Never invent a patient phone number or use the clinic phone number for the patient. Use incoming caller ID only when Exotel explicitly exposes it as verified call context and the caller confirms it; otherwise ask for a reachable number and repeat it back. Ask for an optional visit reason only if it is missing; omit it if the caller declines. Offer a human receptionist for other clinic questions.',
      };
    }
    if (action === 'faq') {
      const query = String(payload?.question || payload?.query || '').trim().toLowerCase();
      if (!query) return { matched: false, handoff: true, message: 'Ask a specific clinic question or offer clinic staff.' };
      const match = this.getVoiceAgent(tenantId).clinic_context.faqs.find((faq: any) => query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query));
      return match ? { matched: true, question: match.question, answer: match.answer, source: 'clinic-approved FAQ' } : { matched: false, handoff: true, message: 'No approved FAQ answer found. Offer clinic staff; do not guess.' };
    }
    if (action === 'availability') {
      if (typeof payload?.date !== 'string' || !payload.date.trim()) {
        return { error: 'date is required as a string, such as today, tomorrow, or YYYY-MM-DD.' };
      }
      if (typeof payload?.time !== 'string' || !payload.time.trim()) {
        return { error: 'time is required as a string, for example 10 AM or 14:30.' };
      }
      if (payload?.doctor_name === undefined || payload?.doctor_name === null) {
        return { error: 'doctor_name is required as a string. Use an empty string when the caller has no doctor preference.' };
      }
      if (typeof payload.doctor_name !== 'string') return { error: 'doctor_name must be a string. Use an empty string when the caller has no doctor preference.' };
      const date = this.normalizeVoiceDate(tenantId, payload.date);
      const time = this.normalizeVoiceTime(payload.time);
      const doctor = String(payload.doctor_name || '').trim();
      if (!date) return { error: 'Please provide a date such as today, tomorrow, or a calendar date.' };
      if (!time) return { error: 'Please provide an appointment time, for example 10 AM or 14:30.' };
      if (!this.isFutureClinicDate(tenantId, date, time)) return { error: 'That time has passed. Please ask for a future appointment time.' };
      const policy = this.validateAgentBooking(tenantId, time);
      if (policy) return { available: false, message: policy };
      const clinicDoctors = this.getClinicDoctorCandidates(tenantId);
      const selectedDoctor = doctor
        ? clinicDoctors.find((candidate) => candidate.toLocaleLowerCase() === doctor.toLocaleLowerCase())
        : undefined;
      if (doctor && !selectedDoctor) {
        return { check_status: 'error', available: null, date, time, message: 'Availability was not checked because that doctor is not in the clinic doctor list. Use an exact name returned by clinic_info or leave doctor_name empty to check all configured doctors.' };
      }
      const candidates = selectedDoctor ? [selectedDoctor] : clinicDoctors;
      if (!candidates.length) return { check_status: 'error', available: null, date, time, message: 'Availability was not checked because no doctors are configured for this clinic. Please ask the clinic team to add its doctors before booking.' };
      const matches = candidates.map((doctorName) => ({ doctor_name: doctorName, conflict: this.findScheduleConflict(tenantId, date, time, doctorName) }));
      const selected = matches.find((candidate) => !candidate.conflict);
      const availableSlots: Array<{ time: string; doctor_names: string[] }> = [];
      if (!selected) {
        const requestedStart = this.timeToMinutes(time)!;
        const duration = this.appointmentDuration(tenantId);
        const settings = this.getVoiceAgent(tenantId);
        const opening = settings.availability === 'business_hours' ? (this.timeToMinutes(settings.open_time) ?? 0) : 0;
        const closing = settings.availability === 'business_hours' ? (this.timeToMinutes(settings.close_time) ?? 1440) : 1440;
        // Return real alternatives from the same appointment calendar, nearest first.
        for (let offset = 15; offset < 1440 && availableSlots.length < 3; offset += 15) {
          const starts = [requestedStart + offset, requestedStart - offset];
          for (const start of starts) {
            if (start < opening || start + duration > closing || start + duration > 1440) continue;
            const candidateTime = this.minutesToTime(start);
            if (!this.isFutureClinicDate(tenantId, date, candidateTime)) continue;
            const freeDoctors = candidates.filter((doctorName) => !this.findScheduleConflict(tenantId, date, candidateTime, doctorName, duration));
            if (freeDoctors.length) {
              if (!availableSlots.some((slot) => slot.time === candidateTime)) {
                availableSlots.push({ time: candidateTime, doctor_names: freeDoctors });
                if (availableSlots.length >= 3) break;
              }
            }
          }
        }
        availableSlots.sort((left, right) => Math.abs((this.timeToMinutes(left.time) ?? 0) - requestedStart) - Math.abs((this.timeToMinutes(right.time) ?? 0) - requestedStart));
      }
      this.logVoiceToolStage(traceId, tenantId, action, 'availability_checked', {
        outcome: selected ? 'available' : 'unavailable',
        available_doctor_count: matches.filter((candidate) => !candidate.conflict).length,
        alternative_slot_count: availableSlots.length,
      });
      return {
        check_status: 'checked', available: Boolean(selected), date, time, duration_minutes: this.appointmentDuration(tenantId),
        ...(selected ? { doctor_name: selected.doctor_name } : { doctor_name: doctor || undefined }),
        available_doctors: matches.filter((candidate) => !candidate.conflict).map((candidate) => candidate.doctor_name),
        ...(availableSlots.length ? { available_slots: availableSlots } : {}),
        source: 'portal appointment calendar',
        message: selected
          ? `Availability was checked and this slot is available with ${selected.doctor_name}. This is an intermediate step: continue this same conversation and keep already collected appointment details in context; do not end the turn or restart intake. Tell the caller the exact doctor, date, and time. Ask only for required booking details still missing, then read back the patient name, reachable confirmed phone, doctor, date, and time together and ask for clear final confirmation. Once the caller confirms, immediately call carestack_book_appointment with action=book, confirmed=true, and these exact confirmed details. Do not call book before that final confirmation.`
          : doctor && matches[0].conflict
            ? `${this.scheduleConflictMessage(tenantId, matches[0].conflict)} Continue the same appointment conversation and offer only the returned available_slots. If the caller selects an alternative, check that exact slot again before final confirmation and booking.`
            : 'No configured doctor is free at that time. Offer one of the returned available_slots, if any, or ask the caller for another time. Keep the same appointment conversation; if the caller selects an alternative, check that exact slot again before final confirmation and booking.',
      };
    }
    if (action === 'book') {
      const requiredFields = ['request_id', 'confirmed', 'patient_name', 'phone_number', 'date', 'time'];
      const missingFields = requiredFields.filter((field) => payload?.[field] === undefined || payload?.[field] === null || (typeof payload[field] === 'string' && !payload[field].trim()));
      if (missingFields.length) return { error: `Missing required booking fields: ${missingFields.join(', ')}.` };
      if (payload.confirmed !== true) return { error: 'Caller confirmation is required before booking.' };
      const requestId = String(payload.request_id).trim();
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) return { error: 'request_id must be 8 to 80 letters, numbers, underscores, or hyphens.' };
      const date = this.normalizeVoiceDate(tenantId, payload.date);
      const time = this.normalizeVoiceTime(payload.time);
      const patientName = String(payload.patient_name).trim();
      const phone = String(payload.phone_number).trim();
      const doctor = String(payload.doctor_name || '').trim();
      const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
      if (patientName.length < 2 || patientName.length > 120) return { error: 'patient_name must be between 2 and 120 characters.' };
      if (!/^\+?[\d\s()-]{8,20}$/.test(phone)) return { error: 'phone_number must contain a valid phone number.' };
      if (doctor.length > 120) return { error: 'doctor_name must be 120 characters or fewer.' };
      if (reason.length > 500) return { error: 'reason must be 500 characters or fewer.' };
      if (!date || !time) return { error: 'Provide a date such as today or tomorrow and a time such as 10 AM or 14:30.' };
      if (!this.isFutureClinicDate(tenantId, date, time)) return { error: 'That time has passed. Please ask for a future appointment time.' };
      const id = `VOICE-${requestId}`;
      const prior = tenant.bookings.find((booking) => booking.id === id);
      if (prior) {
        await this.waitForPendingPersistence();
        this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence', { outcome: 'idempotent_replay', appointment_id_present: Boolean(prior.id) });
        return { appointment: prior, idempotent_replay: true };
      }
      const policy = this.validateAgentBooking(tenantId, time);
      if (policy) return { error: policy };
      const duration = this.appointmentDuration(tenantId);
      let assignedDoctor = doctor;
      if (assignedDoctor) {
        const knownDoctor = this.getClinicDoctorCandidates(tenantId)
          .find((candidate) => candidate.toLocaleLowerCase() === assignedDoctor.toLocaleLowerCase());
        if (!knownDoctor) return { error: 'doctor_name must match a doctor configured for this clinic.' };
        assignedDoctor = knownDoctor;
      }
      if (!assignedDoctor) {
        const availableDoctor = this.getClinicDoctorCandidates(tenantId)
          .find((candidate) => !this.findScheduleConflict(tenantId, date, time, candidate, duration));
        if (!availableDoctor) return { error: 'No configured doctor is available at that time. Ask the caller for another time or contact the clinic.' };
        return {
          booked: false, confirmation_required: true, doctor_name: availableDoctor, date, time,
          message: `No appointment was created. Offer ${availableDoctor} for this time and get the caller's confirmation. Then call book again with doctor_name set to ${availableDoctor}.`,
        };
      }
      const conflict = this.findScheduleConflict(tenantId, date, time, assignedDoctor, duration);
      if (conflict) return { error: this.scheduleConflictMessage(tenantId, conflict) };
      const appointment: Booking = { id, patient_name: patientName, phone_number: phone, doctor_name: assignedDoctor, appointment_date: date, appointment_time: time, duration_minutes: duration, reason, status: 'confirmed' };
      let saved: Booking | { error: string } | null;
      this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence_started');
      try {
        saved = await this.addBooking(tenantId, appointment);
      } catch {
        this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence', { outcome: 'failed', reason_code: 'booking_storage_failure' });
        return { error: 'Appointment storage is temporarily unavailable; booking was not confirmed.', unavailable: true };
      }
      if (!saved || 'error' in saved) {
        const reason = saved && 'error' in saved ? this.voiceToolFailureCode(saved.error) : 'booking_storage_failure';
        this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence', { outcome: 'failed', reason_code: reason });
        return { error: saved && 'error' in saved ? saved.error : 'Could not save appointment.' };
      }
      if (!saved.id) {
        this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence', { outcome: 'failed', reason_code: 'appointment_id_missing' });
        return { error: 'Appointment persistence did not return an appointment ID.' };
      }
      this.logVoiceToolStage(traceId, tenantId, action, 'booking_persistence', { outcome: 'success', appointment_id_present: true });
      return { appointment: saved, idempotent_replay: false };
    }
    if (action === 'cancel' || action === 'reschedule') return { error: 'This appointment change is not enabled: patient verification and an authoritative scheduling integration are not configured. Offer a human receptionist.' };
    return { error: 'Unsupported action. Supported actions are clinic_info, faq, availability, and book.' };
  }

  async ingestExotelVoicebotWebhook(tenantId: string, authorizationHeader: string, payload: any) {
    const tenant = this.tenants[tenantId];
    const configuredUser = process.env.EXOTEL_VOICEBOT_WEBHOOK_USERNAME || '';
    const configuredPassword = process.env.EXOTEL_VOICEBOT_WEBHOOK_PASSWORD || '';
    const basicMatch = /^Basic\s+([A-Za-z0-9+/]+=*)$/i.exec(String(authorizationHeader || '').trim());
    let authenticated = this.validateVoiceToolSecret(tenantId, String(payload?.custom_parameters?.carestack_webhook_token || '').trim());
    if (configuredUser.length >= 16 && configuredPassword.length >= 32 && basicMatch) {
      try {
        const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        const user = Buffer.from(separator >= 0 ? decoded.slice(0, separator) : '');
        const password = Buffer.from(separator >= 0 ? decoded.slice(separator + 1) : '');
        const expectedUser = Buffer.from(configuredUser);
        const expectedPassword = Buffer.from(configuredPassword);
        authenticated ||= user.length === expectedUser.length && password.length === expectedPassword.length && timingSafeEqual(user, expectedUser) && timingSafeEqual(password, expectedPassword);
      } catch { authenticated = false; }
    }
    if (!tenant || !authenticated) return { error: 'Webhook authentication failed.' };
    const callSid = String(payload?.metadata?.call_sid || payload?.external_id || '').trim();
    const sessionId = String(payload?.session_id || '').trim();
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(callSid) || !sessionId || sessionId.length > 128) return { error: 'A valid Exotel call SID and session_id are required.' };
    const configuredAccount = String(tenant.telephony?.account_sid || '');
    const configuredBot = String(tenant.telephony?.exotel_voicebot_id || '');
    const eventAccount = String(payload?.account_id || '');
    if (!configuredAccount || !configuredBot || String(payload?.bot_id || '') !== configuredBot || (eventAccount && eventAccount !== configuredAccount)) {
      return { error: 'Exotel account or Voicebot does not match this clinic.' };
    }

    const calls = tenant.exotel_calls ||= [];
    let call = calls.find((item) => item.call_sid === callSid);
    if (!call) {
      call = { call_sid: callSid, transcript_segments: [], updated_at: new Date().toISOString() };
      calls.push(call);
      if (calls.length > 100) calls.splice(0, calls.length - 100);
    }
    call.session_id = sessionId;
    if (payload?.conversation_id) call.conversation_id = String(payload.conversation_id).slice(0, 128);
    if (payload?.contact_uri) call.caller_phone = String(payload.contact_uri).replace(/^sip:/i, '').split('@')[0].slice(0, 64);
    if (payload?.landing_number) call.landing_number = String(payload.landing_number).slice(0, 64);
    if (payload?.session_state) call.session_state = String(payload.session_state).slice(0, 40);
    if (payload?.start_time) call.started_at = String(payload.start_time).slice(0, 64);
    if (payload?.end_time) call.ended_at = String(payload.end_time).slice(0, 64);

    const incomingSegments = (Array.isArray(payload?.events) ? payload.events : [])
      .filter((event: any) => event?.event_type === 'transcript')
      .flatMap((event: any) => Array.isArray(event?.event_data?.transcripts) ? event.event_data.transcripts : [])
      .flatMap((transcript: any) => Array.isArray(transcript?.transcript_segments) ? transcript.transcript_segments : [])
      .filter((segment: any) => typeof segment?.text === 'string' && segment.text.trim())
      .map((segment: any) => ({
        speaker: String(segment.speaker || 'unknown').slice(0, 32),
        text: String(segment.text).trim().slice(0, 2000),
        ...(segment.start_timestamp ? { start_timestamp: String(segment.start_timestamp).slice(0, 64) } : {}),
        ...(segment.end_timestamp ? { end_timestamp: String(segment.end_timestamp).slice(0, 64) } : {}),
      }));
    for (const segment of incomingSegments) {
      const duplicate = call.transcript_segments.some((existing) => existing.speaker === segment.speaker && existing.text === segment.text && existing.start_timestamp === segment.start_timestamp);
      if (!duplicate && call.transcript_segments.length < 100) call.transcript_segments.push(segment);
    }
    call.updated_at = new Date().toISOString();

    // Recording links are intentionally not stored in the transcript webhook payload.
    // They are fetched on demand from Exotel's authenticated Call Details API.
    this.persistState();
    await this.waitForPendingPersistence();
    return { accepted: true, call_sid: callSid, transcript_segments_saved: incomingSegments.length };
  }

  listExotelCalls(tenantId: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    return [...(tenant.exotel_calls || [])]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ call_sid, session_id, conversation_id, caller_phone, landing_number, session_state, started_at, ended_at, transcript_segments, recording_available, updated_at }) => ({
        call_sid, session_id, conversation_id, caller_phone, landing_number, session_state, started_at, ended_at, booking_id: (tenant.exotel_calls || []).find((item) => item.call_sid === call_sid)?.booking_id,
        transcript_segments, recording_available, updated_at,
      }));
  }

  async syncExotelCalls(tenantId: string, startDate: string, endDate: string, after?: string) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || startDate < new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10) || endDate > new Date().toISOString().slice(0, 10)) {
      return { error: 'Use valid dates within the last six months, with start_date on or before end_date.' };
    }
    if ((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 > 30) {
      return { error: 'Exotel call sync supports date ranges of at most 31 days.' };
    }
    const config = tenant.telephony;
    const apiKey = this.decryptCredential(config?.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
    const apiToken = this.decryptCredential(config?.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
    if (!config?.account_sid || !config.phone_number || !apiKey || !apiToken) return { error: 'Save the Exotel Account SID and ExoPhone, and configure the Exotel API credentials first.' };
    const host = config.region === 'singapore' ? 'https://api.exotel.com' : 'https://api.in.exotel.com';
    const query = new URLSearchParams({
      DateCreated: `gte:${startDate} 00:00:00;lte:${endDate} 23:59:59`,
      PhoneNumber: config.phone_number,
      Direction: 'inbound',
      PageSize: '100',
      SortBy: 'DateCreated:desc',
    });
    if (after) {
      if (after.length > 512 || !/^[A-Za-z0-9+/=_-]+$/.test(after)) return { error: 'Exotel pagination cursor is invalid.' };
      query.set('After', after);
    }
    try {
      const providerCalls: any[] = [];
      let nextAfter = '';
      const authorization = `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`;
      for (let page = 0; page < 10; page += 1) {
        const response = await fetch(`${host}/v1/Accounts/${encodeURIComponent(config.account_sid)}/Calls.json?${query}`, {
          headers: { Authorization: authorization, Accept: 'application/json' },
        });
        if (!response.ok) return { error: `Exotel call history lookup failed with HTTP ${response.status}.` };
        const payload = await response.json() as any;
        providerCalls.push(...(Array.isArray(payload?.Calls) ? payload.Calls : []));
        const nextUri = String(payload?.Metadata?.NextPageUri || '');
        const cursor = nextUri ? new URL(nextUri, host).searchParams.get('After') || '' : '';
        if (!cursor) { nextAfter = ''; break; }
        nextAfter = cursor;
        query.set('After', cursor);
      }
      const calls = tenant.exotel_calls ||= [];
      let imported = 0;
      for (const providerCall of providerCalls) {
        const callSid = String(providerCall?.Sid || '').trim();
        if (!/^[A-Za-z0-9_-]{6,128}$/.test(callSid)) continue;
        let call = calls.find((item) => item.call_sid === callSid);
        if (!call) {
          call = { call_sid: callSid, transcript_segments: [], updated_at: new Date().toISOString() };
          calls.push(call);
          imported += 1;
        }
        call.caller_phone ||= String(providerCall?.From || '').slice(0, 64);
        call.landing_number ||= String(providerCall?.PhoneNumber || providerCall?.To || '').slice(0, 64);
        call.session_state ||= String(providerCall?.Status || '').slice(0, 40);
        call.started_at ||= String(providerCall?.StartTime || providerCall?.DateCreated || '').slice(0, 64);
        call.ended_at ||= String(providerCall?.EndTime || '').slice(0, 64);
        call.recording_available = Boolean(providerCall?.PreSignedRecordingUrl || providerCall?.RecordingUrl || call.recording_available);
        call.updated_at = new Date().toISOString();
      }
      if (calls.length > 100) calls.splice(0, calls.length - 100);
      this.persistState();
      await this.waitForPendingPersistence();
      return { imported, matched: providerCalls.length, has_more: Boolean(nextAfter), ...(nextAfter ? { next_after: nextAfter } : {}), calls: this.listExotelCalls(tenantId) };
    } catch {
      return { error: 'Could not retrieve Exotel call history. Check Exotel API access and the selected region.' };
    }
  }

  async bookExotelCall(tenantId: string, callSid: string, payload: any) {
    const tenant = this.tenants[tenantId];
    const call = tenant?.exotel_calls?.find((item) => item.call_sid === callSid);
    if (!tenant || !call) return { error: 'Call not found.' };
    const digits = (value: string) => value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (call.caller_phone && digits(String(payload?.phone_number || '')) !== digits(call.caller_phone)) {
      return { error: 'The booking phone number must match the caller ID recorded by Exotel.' };
    }
    const requestId = `exotel-${callSid}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);
    const result = await this.voiceTool(tenantId, { ...payload, action: 'book', request_id: requestId });
    if ('error' in result) return result;
    const appointment = result.appointment as Booking;
    call.booking_id = appointment.id;
    call.updated_at = new Date().toISOString();
    this.persistState();
    await this.waitForPendingPersistence();
    return { ...result, call_sid: callSid };
  }

  async getExotelCallRecording(tenantId: string, callSid: string) {
    const tenant = this.tenants[tenantId];
    const call = tenant?.exotel_calls?.find((item) => item.call_sid === callSid);
    if (!tenant || !call) return { error: 'Call not found.' };
    const config = tenant.telephony;
    const apiKey = this.decryptCredential(config?.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
    const apiToken = this.decryptCredential(config?.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
    if (!config?.account_sid || !apiKey || !apiToken) return { error: 'Exotel Call Details credentials are not configured for this clinic.' };
    const host = config.region === 'singapore' ? 'https://api.exotel.com' : 'https://api.in.exotel.com';
    const url = `${host}/v1/Accounts/${encodeURIComponent(config.account_sid)}/Calls/${encodeURIComponent(callSid)}?RecordingUrlValidity=10`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`, Accept: 'application/json, application/xml' },
      });
      if (!response.ok) return { error: `Exotel call lookup failed with HTTP ${response.status}.` };
      const raw = await response.text();
      let recordingUrl = '';
      let signedRecordingUrl = false;
      try {
        const parsed = JSON.parse(raw);
        const callData = parsed?.Call || parsed?.call || parsed?.RestResponse?.Call || parsed;
        const signed = callData?.PreSignedRecordingUrl || callData?.presigned_recording_url;
        recordingUrl = String(signed || callData?.RecordingUrl || callData?.recording_url || '');
        signedRecordingUrl = Boolean(signed);
      } catch {
        const match = /<(PreSignedRecordingUrl|RecordingUrl)>([\s\S]*?)<\/\1>/i.exec(raw);
        recordingUrl = match?.[2]?.trim().replace(/&amp;/g, '&') || '';
        signedRecordingUrl = match?.[1].toLowerCase() === 'presignedrecordingurl';
      }
      if (recordingUrl && !/^https:\/\//i.test(recordingUrl)) return { error: 'Exotel returned an invalid recording URL.' };
      call.recording_available = Boolean(recordingUrl);
      call.updated_at = new Date().toISOString();
      this.persistState();
      await this.waitForPendingPersistence();
      return recordingUrl ? { call_sid: callSid, recording_url: recordingUrl, ...(signedRecordingUrl ? { expires_in_minutes: 10 } : {}) } : { call_sid: callSid, recording_url: null, message: 'No recording is available for this call.' };
    } catch {
      return { error: 'Could not retrieve the recording details from Exotel.' };
    }
  }

  private getClinicDoctorCandidates(tenantId: string) {
    return this.getActiveDoctorNames(tenantId);
  }

  private getActiveClinicDoctorDirectory(tenantId: string) {
    return (this.tenants[tenantId]?.doctors || [])
      .filter((doctor) => doctor.status === 'active')
      .map(({ name, specialty }) => ({ name, specialty }));
  }

  private clinicDateParts(tenantId: string, date = new Date()) {
    const timezone = this.getVoiceAgent(tenantId).timezone || 'Asia/Kolkata';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  }

  private dateKey(year: number, month: number, day: number) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private normalizeVoiceDate(tenantId: string, input: unknown): string | null {
    const raw = String(input || '').trim().toLocaleLowerCase();
    if (!raw) return null;
    const today = this.clinicDateParts(tenantId);
    const relative = raw.normalize('NFC');
    let offset: number | null = null;
    if (/\b(day after tomorrow|parso)\b|परसों|परसो/u.test(relative)) offset = 2;
    else if (/\b(today|aaj|aj)\b|आज/u.test(relative)) offset = 0;
    else if (/\b(tomorrow|kal)\b|कल/u.test(relative)) offset = 1;
    if (offset !== null) {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
      return this.dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }

    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (match) return this.dateKey(Number(match[1]), Number(match[2]), Number(match[3]));
    match = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/.exec(raw);
    if (match) {
      const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : today.year;
      return this.dateKey(year, Number(match[2]), Number(match[1]));
    }

    const months = 'january february march april may june july august september october november december'.split(' ');
    const monthPattern = months.map((month) => `${month.slice(0, 3)}(?:${month.slice(3)})?`).join('|');
    match = new RegExp(`^(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\s+(\\d{4}))?$`, 'i').exec(raw)
      || new RegExp(`^(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?$`, 'i').exec(raw);
    if (match) {
      const dayFirst = /^\d/.test(match[1]);
      const day = Number(dayFirst ? match[1] : match[2]);
      const monthName = (dayFirst ? match[2] : match[1]).slice(0, 3).toLowerCase();
      const year = Number(match[3] || today.year);
      return this.dateKey(year, months.findIndex((month) => month.startsWith(monthName)) + 1, day);
    }
    return null;
  }

  private normalizeVoiceTime(input: unknown): string | null {
    const raw = String(input || '').trim().toLocaleLowerCase();
    if (!raw) return null;
    const match = /(?:^|\b)(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?\s*(?:o'?clock|baje|baj[eé]|bje|बजे)?\b/u.exec(raw);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = match[3]?.replace(/\./g, '')
      || (/\b(subah|morning)\b|सुबह/u.test(raw) ? 'am' : undefined)
      || (/\b(shaam|sham|evening|night|raat)\b|दोपहर|शाम|रात/u.test(raw) ? 'pm' : undefined);
    if (minute > 59) return null;
    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      if (meridiem === 'am' && hour === 12) hour = 0;
      if (meridiem === 'pm' && hour < 12) hour += 12;
    } else if (hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

  getDashboard(tenantId: string, activityRange = '7d') {
    const tenant = this.tenants[tenantId];
    if (!tenant) return { statusCode: 404, message: 'Tenant not found' };

    const analytics = this.getTenantAnalytics(tenant, activityRange);

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      admin_name: tenant.admin_name,
      plan: tenant.plan,
      region: tenant.region,
      voice_agent: this.getVoiceAgent(tenantId),
      doctors: this.getDoctors(tenantId) || [],
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

  private getTenantAnalytics(tenant: Tenant, requestedActivityRange = '7d') {
    const activityRange = ['today', '7d', '30d'].includes(requestedActivityRange) ? requestedActivityRange : '7d';
    const activityDays = activityRange === 'today' ? 1 : activityRange === '30d' ? 30 : 7;
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
    activityStart.setUTCDate(today.getUTCDate() - (activityDays - 1));
    const priorEnd = new Date(activityStart);
    priorEnd.setUTCDate(activityStart.getUTCDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setUTCDate(priorEnd.getUTCDate() - (activityDays - 1));
    const createdInRange = (createdAt: string | undefined, start: Date, end: Date) => {
      if (!createdAt) return false;
      const createdDate = createdAt.slice(0, 10);
      return createdDate >= start.toISOString().slice(0, 10) && createdDate <= end.toISOString().slice(0, 10);
    };
    const activity = Array.from({ length: activityDays }, (_, index) => {
      const date = new Date(activityStart);
      date.setUTCDate(activityStart.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date: dateKey,
        label: activityDays === 1 ? 'Today' : activityDays > 7 ? String(date.getUTCDate()) : new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(date),
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
      activity_range: activityRange,
      activity,
      schedule,
      status_breakdown: statusBreakdown,
      doctor_workload: doctorWorkload,
    };
  }

  getPatients(tenantId: string) {
    return this.tenants[tenantId]?.patients || [];
  }

  private ensureBookingPatient(tenant: Tenant, booking: Booking) {
    tenant.patients ||= [];
    const name = String(booking.patient_name || '').trim();
    const phone = String(booking.phone_number || '').trim();
    if (!name || !phone) return { patient: null, created: false };

    const normalizeName = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const normalizePhone = (value: string) => {
      const digits = value.replace(/\D/g, '');
      return digits.replace(/^0091(?=\d{10}$)/, '').replace(/^91(?=\d{10}$)/, '');
    };
    const patient = tenant.patients.find((item) =>
      normalizeName(item.name) === normalizeName(name) && normalizePhone(item.phone) === normalizePhone(phone));
    if (patient) return { patient, created: false };

    const usedIds = new Set(tenant.patients.map((item) => item.id));
    let nextId = tenant.patients.length + 1001;
    while (usedIds.has(`pat-${nextId}`)) nextId += 1;
    const createdPatient: Patient = {
      id: `pat-${nextId}`,
      tenant_id: tenant.id,
      name,
      phone,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    tenant.patients.push(createdPatient);
    return { patient: createdPatient, created: true };
  }

  async addBooking(tenantId: string, booking: Booking) {
    const tenant = this.tenants[tenantId];
    if (!tenant) return null;

    const policyError = this.validateAgentBooking(tenantId, booking.appointment_time);
    if (policyError) return { error: policyError };

    const existing = tenant.bookings.find((item) => item.id === booking.id);
    if (existing) {
      const registration = this.ensureBookingPatient(tenant, existing);
      const patientLinkChanged = Boolean(registration.patient && !existing.patient_id);
      const previousPatientId = existing.patient_id;
      if (patientLinkChanged && registration.patient) existing.patient_id = registration.patient.id;
      if (registration.created || patientLinkChanged) {
        try {
          this.persistState();
          await this.waitForPendingPersistence();
        } catch (error) {
          existing.patient_id = previousPatientId;
          if (registration.created && registration.patient) {
            tenant.patients = tenant.patients.filter((item) => item.id !== registration.patient!.id);
          }
          throw error;
        }
      } else {
        await this.waitForPendingPersistence();
      }
      return existing;
    }

    const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
    const conflict = this.findScheduleConflict(tenantId, booking.appointment_date, booking.appointment_time, booking.doctor_name, duration);
    if (conflict) return { error: this.scheduleConflictMessage(tenantId, conflict) };

    const registration = this.ensureBookingPatient(tenant, booking);
    const savedBooking = {
      ...booking,
      ...(registration.patient ? { patient_id: registration.patient.id } : {}),
      duration_minutes: duration,
      created_at: booking.created_at || new Date().toISOString(),
    };
    tenant.bookings.push(savedBooking);
    try {
      this.persistState();
      await this.waitForPendingPersistence();
    } catch (error) {
      const index = tenant.bookings.findIndex((item) => item.id === savedBooking.id);
      if (index !== -1) tenant.bookings.splice(index, 1);
      if (registration.created && registration.patient) {
        tenant.patients = tenant.patients.filter((item) => item.id !== registration.patient!.id);
      }
      throw error;
    }
    return savedBooking;
  }

  private async waitForPendingPersistence() {
    const started = performance.now();
    let outcome = 'success';
    try {
      await this.pendingPostgresWrite;
    } catch (error) {
      outcome = 'failure';
      throw error;
    } finally {
      console.info(JSON.stringify({ event: 'postgres.persist_wait_timing', duration_ms: Number((performance.now() - started).toFixed(2)), outcome }));
    }
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
