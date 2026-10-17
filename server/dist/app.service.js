"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pg_1 = require("pg");
const defaultClinicContext = { address: '', services: [], doctors: [], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] };
const defaultVoiceAgent = { enabled: true, availability: 'business_hours', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: defaultClinicContext };
const defaultTelephony = { provider: 'exotel', voice_provider: 'sarvam', exotel_voicebot_id: '', phone_number: '', account_sid: '', app_id: '', region: 'mumbai', enabled: false };
class AppService {
    constructor() {
        this.tenants = {};
        this.clinicInterests = [];
        this.superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'superadmin@hospital.ai')).trim().toLowerCase();
        this.superAdminPasswordHash = process.env.SUPER_ADMIN_PASSWORD
            ? bcryptjs_1.default.hashSync(process.env.SUPER_ADMIN_PASSWORD, 12)
            : process.env.NODE_ENV === 'production' ? '' : bcryptjs_1.default.hashSync('admin123', 12);
        this.planCatalog = [
            { id: 'starter', name: 'Starter', monthly_price: 4999, annual_price: 49990, clinic_limit: 1, user_limit: 3 },
            { id: 'growth', name: 'Growth', monthly_price: 14999, annual_price: 149990, clinic_limit: 5, user_limit: 15 },
            { id: 'enterprise', name: 'Enterprise', monthly_price: 39999, annual_price: 399990, clinic_limit: null, user_limit: null },
        ];
        this.pendingPostgresWrite = Promise.resolve();
        this.postgresWriteScheduled = false;
        const databaseUrl = process.env.DATABASE_URL?.trim();
        if (databaseUrl) {
            this.postgres = new pg_1.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2500, statement_timeout: 4500 });
            return;
        }
        const defaultDatabasePath = process.env.NODE_ENV === 'production'
            ? '/tmp/hospital.sqlite'
            : node_path_1.default.resolve(__dirname, '..', 'data', 'hospital.sqlite');
        const databasePath = process.env.DATABASE_PATH || defaultDatabasePath;
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(databasePath), { recursive: true });
        this.database = new better_sqlite3_1.default(databasePath);
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
        const savedState = this.database.prepare('SELECT payload FROM app_state WHERE id = 1').get();
        if (savedState) {
            if (this.loadState(savedState.payload))
                this.persistState();
        }
        else {
            if (process.env.NODE_ENV !== 'production')
                this.seed();
            this.persistState();
        }
    }
    async onModuleInit() {
        if (!this.postgres)
            return;
        const started = node_perf_hooks_1.performance.now();
        let outcome = 'success';
        try {
            await this.postgres.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `);
            const result = await this.postgres.query('SELECT payload FROM app_state WHERE id = 1');
            if (result.rows[0]) {
                if (this.loadState(result.rows[0].payload))
                    await this.writePostgresState();
            }
            else {
                await this.writePostgresState();
            }
        }
        catch (error) {
            outcome = 'failure';
            throw error;
        }
        finally {
            console.info(JSON.stringify({ event: 'postgres.startup_timing', duration_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), outcome }));
        }
    }
    async onModuleDestroy() {
        await this.pendingPostgresWrite;
        await this.postgres?.end();
    }
    loadState(payload) {
        const state = (typeof payload === 'string' ? JSON.parse(payload) : payload);
        this.tenants = state.tenants || {};
        this.planCatalog = state.planCatalog || this.planCatalog;
        this.clinicInterests = state.clinicInterests || [];
        return this.migratePasswordHashes();
    }
    migratePasswordHashes() {
        let migrated = false;
        Object.values(this.tenants).forEach((tenant) => {
            const legacyVoiceAgent = tenant.voice_agent;
            const legacyNumber = legacyVoiceAgent?.calling_number || (tenant.id === 'tenant-skycare' ? (process.env.DEDICATED_CALL_NUMBER || '+91 90000 12345') : '');
            if (!tenant.telephony || legacyVoiceAgent?.calling_number !== undefined) {
                tenant.telephony = { ...defaultTelephony, ...(tenant.telephony || {}), phone_number: tenant.telephony?.phone_number || legacyNumber };
                tenant.voice_agent = { ...defaultVoiceAgent, ...(legacyVoiceAgent || {}) };
                delete tenant.voice_agent.calling_number;
                migrated = true;
            }
            if (!Array.isArray(tenant.doctors)) {
                const legacyDoctors = tenant.voice_agent?.clinic_context?.doctors || [];
                const seen = new Set();
                tenant.doctors = legacyDoctors.flatMap((entry, index) => {
                    const value = String(entry || '').trim();
                    if (!value || ['na', 'n/a', 'none', 'unknown', 'not available'].includes(value.toLocaleLowerCase()))
                        return [];
                    const parts = value.split(/\s+[—–-]\s+/, 2);
                    const name = parts[0].trim();
                    const specialty = parts[1]?.trim() || '';
                    const key = name.toLocaleLowerCase();
                    if (seen.has(key))
                        return [];
                    seen.add(key);
                    const now = new Date().toISOString();
                    return [{ id: `doc-legacy-${index + 1}`, tenant_id: tenant.id, name, specialty, status: 'active', created_at: now, updated_at: now }];
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
                const legacyUser = user;
                if (!legacyUser.password_hash && legacyUser.password) {
                    legacyUser.password_hash = bcryptjs_1.default.hashSync(legacyUser.password, 12);
                    delete legacyUser.password;
                    migrated = true;
                }
                if (process.env.NODE_ENV === 'production' && bcryptjs_1.default.compareSync('admin123', user.password_hash)) {
                    user.password_hash = bcryptjs_1.default.hashSync((0, node_crypto_1.randomBytes)(24).toString('base64url'), 12);
                    migrated = true;
                }
            });
        });
        return migrated;
    }
    persistState() {
        const payload = JSON.stringify({ tenants: this.tenants, planCatalog: this.planCatalog, clinicInterests: this.clinicInterests });
        if (this.postgres) {
            this.pendingPostgresPayload = payload;
            if (!this.postgresWriteScheduled) {
                this.postgresWriteScheduled = true;
                this.pendingPostgresWrite = this.pendingPostgresWrite
                    .catch(() => undefined)
                    .then(() => this.flushPendingPostgresWrites());
            }
            return;
        }
        this.database.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(payload, new Date().toISOString());
    }
    async flushPendingPostgresWrites() {
        try {
            while (this.pendingPostgresPayload !== undefined) {
                const payload = this.pendingPostgresPayload;
                this.pendingPostgresPayload = undefined;
                await this.writePostgresState(payload);
            }
        }
        finally {
            this.postgresWriteScheduled = false;
        }
    }
    async writePostgresState(payload = JSON.stringify({ tenants: this.tenants, planCatalog: this.planCatalog, clinicInterests: this.clinicInterests })) {
        if (!this.postgres)
            return;
        const started = node_perf_hooks_1.performance.now();
        try {
            await this.postgres.query(`
        INSERT INTO app_state (id, payload, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
      `, [payload]);
            console.info(JSON.stringify({ event: 'postgres.state_write_timing', duration_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), payload_bytes: Buffer.byteLength(payload), outcome: 'success' }));
        }
        catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code).slice(0, 32) : 'unknown';
            console.error(JSON.stringify({ event: 'postgres.state_write_timing', duration_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), payload_bytes: Buffer.byteLength(payload), outcome: 'failure', error_code: code }));
            throw error;
        }
    }
    seed() {
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
                    password_hash: bcryptjs_1.default.hashSync(process.env.TENANT_DEFAULT_PASSWORD || 'admin123', 12),
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
    async login(email, password) {
        if (this.superAdminEmail && this.superAdminPasswordHash && email === this.superAdminEmail && await bcryptjs_1.default.compare(password, this.superAdminPasswordHash)) {
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
                if (user.email === email && await bcryptjs_1.default.compare(password, user.password_hash)) {
                    if (tenant.subscription_status !== 'active')
                        return null;
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
    getTenantByDomain(domain) {
        const normalizedDomain = domain.trim().toLowerCase();
        const tenant = Object.values(this.tenants).find((item) => item.domain === normalizedDomain);
        if (!tenant)
            return null;
        return {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            subscription_status: tenant.subscription_status,
        };
    }
    isTenantActive(tenantId) {
        return this.tenants[tenantId]?.subscription_status === 'active';
    }
    getPlans() {
        return this.planCatalog;
    }
    createClinicInterest(payload) {
        if (!this.planCatalog.some((plan) => plan.id === payload.plan))
            return null;
        const interest = { ...payload, id: `lead-${(0, node_crypto_1.randomBytes)(5).toString('hex')}`, created_at: new Date().toISOString() };
        this.clinicInterests.unshift(interest);
        this.persistState();
        return interest;
    }
    listClinicInterests() {
        return this.clinicInterests;
    }
    createPlan(payload) {
        const id = String(payload.id ?? '').trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || this.planCatalog.some((plan) => plan.id === id)) {
            return null;
        }
        const monthlyPrice = Number(payload.monthly_price);
        const annualPrice = Number(payload.annual_price);
        if (!payload.name || monthlyPrice <= 0 || annualPrice <= 0)
            return null;
        const plan = {
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
    updatePlan(planId, payload) {
        const plan = this.planCatalog.find((item) => item.id === planId);
        if (!plan)
            return null;
        const monthlyPrice = payload.monthly_price === undefined ? plan.monthly_price : Number(payload.monthly_price);
        const annualPrice = payload.annual_price === undefined ? plan.annual_price : Number(payload.annual_price);
        if (monthlyPrice <= 0 || annualPrice <= 0)
            return null;
        if (payload.name !== undefined)
            plan.name = String(payload.name).trim();
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
    deletePlan(planId) {
        const planIndex = this.planCatalog.findIndex((plan) => plan.id === planId);
        if (planIndex < 0)
            return 'not_found';
        if (Object.values(this.tenants).some((tenant) => tenant.plan === planId))
            return 'in_use';
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
    createTenant(payload) {
        const tenantDomain = String(payload.tenant_domain ?? '').trim().toLowerCase();
        const adminEmail = String(payload.admin_email ?? '').trim().toLowerCase();
        const duplicate = Object.values(this.tenants).some((tenant) => tenant.domain === tenantDomain || tenant.users.some((user) => user.email === adminEmail));
        if (duplicate)
            return null;
        let tenantSequence = Object.keys(this.tenants).length + 1;
        while (this.tenants[`tenant-${tenantSequence}`])
            tenantSequence += 1;
        const tenantId = `tenant-${tenantSequence}`;
        const adminId = `user-${tenantId}`;
        const requestedPlan = String(payload.plan || 'growth').toLowerCase();
        const plan = this.planCatalog.some((item) => item.id === requestedPlan) ? requestedPlan : 'growth';
        const adminPasswordWasProvided = typeof payload.admin_password === 'string' && payload.admin_password.length > 0;
        const temporaryPassword = adminPasswordWasProvided
            ? payload.admin_password
            : process.env.NODE_ENV === 'production'
                ? (0, node_crypto_1.randomBytes)(18).toString('base64url')
                : process.env.TENANT_DEFAULT_PASSWORD || 'admin123';
        const tenant = {
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
                    password_hash: bcryptjs_1.default.hashSync(temporaryPassword, 12),
                },
            ],
            patients: [],
            bookings: [],
            doctors: [],
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
    updateTenant(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const nextDomain = payload.tenant_domain === undefined
            ? tenant.domain
            : String(payload.tenant_domain).trim().toLowerCase();
        const nextEmail = payload.admin_email === undefined
            ? tenant.admin_email
            : String(payload.admin_email).trim().toLowerCase();
        const conflict = Object.values(this.tenants).some((item) => item.id !== tenantId && (item.domain === nextDomain || item.users.some((user) => user.email === nextEmail)));
        if (conflict) {
            throw new Error('Tenant domain or administrator email is already in use');
        }
        if (payload.tenant_name !== undefined)
            tenant.name = String(payload.tenant_name).trim();
        if (payload.tenant_domain !== undefined)
            tenant.domain = nextDomain;
        if (payload.admin_name !== undefined)
            tenant.admin_name = String(payload.admin_name).trim();
        if (payload.admin_email !== undefined)
            tenant.admin_email = nextEmail;
        if (payload.admin_phone !== undefined)
            tenant.admin_phone = String(payload.admin_phone).trim();
        if (payload.region !== undefined)
            tenant.region = String(payload.region).trim();
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
    async setTenantAdminPassword(tenantId, password) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return 'not_found';
        const adminUser = tenant.users.find((user) => user.email === tenant.admin_email)
            || tenant.users.find((user) => user.role === 'tenant_admin');
        if (!adminUser)
            return 'admin_not_found';
        adminUser.password_hash = bcryptjs_1.default.hashSync(password, 12);
        this.persistState();
        await this.pendingPostgresWrite;
        return 'updated';
    }
    updateVoiceAgent(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const current = { ...defaultVoiceAgent, ...(tenant.voice_agent || {}) };
        const next = { ...current, ...payload };
        next.appointment_duration_minutes = Number(next.appointment_duration_minutes || defaultVoiceAgent.appointment_duration_minutes);
        if (typeof next.enabled !== 'boolean' || !['all_day', 'business_hours'].includes(next.availability) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.open_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.close_time) ||
            typeof next.timezone !== 'string' || !next.timezone.trim() || ![15, 20, 30, 45, 60].includes(next.appointment_duration_minutes))
            return false;
        delete next.calling_number;
        if (next.availability === 'business_hours' && next.close_time <= next.open_time)
            return false;
        try {
            new Intl.DateTimeFormat('en', { timeZone: next.timezone });
        }
        catch {
            return false;
        }
        const context = payload?.clinic_context || current.clinic_context || defaultClinicContext;
        const boundedText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
        const cleanList = (value, limit) => Array.isArray(value) ? value.slice(0, 30).map((item) => boundedText(item, limit)).filter(Boolean) : [];
        const faqs = Array.isArray(context.faqs) ? context.faqs.slice(0, 25).map((item) => ({ question: boundedText(item?.question, 300), answer: boundedText(item?.answer, 1200) })).filter((item) => item.question && item.answer) : [];
        next.clinic_context = {
            address: boundedText(context.address, 500), services: cleanList(context.services, 160), doctors: this.getActiveDoctorNames(tenantId),
            fees: boundedText(context.fees, 2000), languages: cleanList(context.languages, 40).slice(0, 8),
            instructions: boundedText(context.instructions, 4000), faqs,
        };
        tenant.voice_agent = next;
        this.persistState();
        return tenant.voice_agent;
    }
    getVoiceAgent(tenantId) {
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
    getActiveDoctorNames(tenantId) {
        return (this.tenants[tenantId]?.doctors || [])
            .filter((doctor) => doctor.status === 'active')
            .map((doctor) => doctor.name);
    }
    getDoctors(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        tenant.doctors ||= [];
        return [...tenant.doctors].sort((left, right) => left.name.localeCompare(right.name));
    }
    async addDoctor(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        tenant.doctors ||= [];
        const name = String(payload?.name || '').trim();
        const specialty = String(payload?.specialty || '').trim();
        if (name.length < 2 || name.length > 120)
            return { error: 'Doctor name must be between 2 and 120 characters.' };
        if (specialty.length > 160)
            return { error: 'Specialty must be 160 characters or fewer.' };
        if (['na', 'n/a', 'none', 'unknown', 'not available'].includes(name.toLocaleLowerCase()))
            return { error: 'Enter a real doctor name.' };
        if (tenant.doctors.some((doctor) => doctor.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
            return { error: 'This doctor is already in the clinic roster.' };
        const now = new Date().toISOString();
        const doctor = { id: `doc-${(0, node_crypto_1.randomUUID)()}`, tenant_id: tenantId, name, specialty, status: 'active', created_at: now, updated_at: now };
        tenant.doctors.push(doctor);
        this.syncDoctorNames(tenantId);
        try {
            this.persistState();
            await this.waitForPendingPersistence();
        }
        catch (error) {
            tenant.doctors = tenant.doctors.filter((item) => item.id !== doctor.id);
            this.syncDoctorNames(tenantId);
            throw error;
        }
        return doctor;
    }
    async updateDoctor(tenantId, doctorId, payload) {
        const tenant = this.tenants[tenantId];
        const doctor = tenant?.doctors?.find((item) => item.id === doctorId);
        if (!tenant || !doctor)
            return null;
        const previous = { ...doctor };
        const name = payload?.name === undefined ? doctor.name : String(payload.name).trim();
        const specialty = payload?.specialty === undefined ? doctor.specialty : String(payload.specialty || '').trim();
        const status = payload?.status === undefined ? doctor.status : payload.status;
        if (name.length < 2 || name.length > 120)
            return { error: 'Doctor name must be between 2 and 120 characters.' };
        if (specialty.length > 160)
            return { error: 'Specialty must be 160 characters or fewer.' };
        if (!['active', 'inactive'].includes(status))
            return { error: 'Doctor status must be active or inactive.' };
        if (tenant.doctors.some((item) => item.id !== doctorId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
            return { error: 'This doctor is already in the clinic roster.' };
        Object.assign(doctor, { name, specialty, status, updated_at: new Date().toISOString() });
        this.syncDoctorNames(tenantId);
        try {
            this.persistState();
            await this.waitForPendingPersistence();
        }
        catch (error) {
            Object.assign(doctor, previous);
            this.syncDoctorNames(tenantId);
            throw error;
        }
        return doctor;
    }
    syncDoctorNames(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return;
        tenant.voice_agent ||= { ...defaultVoiceAgent };
        tenant.voice_agent.clinic_context ||= { ...defaultClinicContext };
        tenant.voice_agent.clinic_context.doctors = this.getActiveDoctorNames(tenantId);
    }
    timeToMinutes(value) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
            return null;
        const [hours, minutes] = value.split(':').map(Number);
        return hours * 60 + minutes;
    }
    minutesToTime(value) {
        const normalized = ((value % 1440) + 1440) % 1440;
        return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
    }
    appointmentDuration(tenantId) {
        const configured = Number(this.getVoiceAgent(tenantId).appointment_duration_minutes);
        return [15, 20, 30, 45, 60].includes(configured) ? configured : defaultVoiceAgent.appointment_duration_minutes;
    }
    findScheduleConflict(tenantId, date, time, doctor, duration = this.appointmentDuration(tenantId)) {
        const requestedStart = this.timeToMinutes(time);
        if (requestedStart === null || requestedStart + duration > 1440)
            return null;
        const tenant = this.tenants[tenantId];
        const normalizedDoctor = doctor.trim().toLocaleLowerCase();
        return tenant?.bookings.find((booking) => {
            if (booking.appointment_date !== date || booking.status === 'cancelled' || booking.status === 'no_show' || booking.doctor_name.trim().toLocaleLowerCase() !== normalizedDoctor)
                return false;
            const existingStart = this.timeToMinutes(booking.appointment_time);
            if (existingStart === null)
                return false;
            const existingDuration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
            return requestedStart < existingStart + existingDuration && existingStart < requestedStart + duration;
        }) || null;
    }
    scheduleConflictMessage(tenantId, booking) {
        const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
        const start = this.timeToMinutes(booking.appointment_time) ?? 0;
        return `That appointment overlaps an existing booking for this doctor from ${booking.appointment_time} to ${this.minutesToTime(start + duration)}. Ask for a different time.`;
    }
    previewVoiceAgent(tenantId, callerMessage) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const settings = this.getVoiceAgent(tenantId);
        if (!settings.enabled)
            return { reply: `${tenant.name}'s booking assistant is currently unavailable. Please call again later or contact the clinic directly.`, status: 'paused' };
        const query = String(callerMessage || '').trim().toLowerCase();
        const faqMatch = settings.clinic_context.faqs.find((faq) => query && (query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query)));
        if (faqMatch)
            return { reply: faqMatch.answer, status: 'answered_from_clinic_faq' };
        const asksToBook = /book|appointment|visit|doctor|अपॉइंटमेंट|डॉक्टर/i.test(callerMessage);
        if (!asksToBook && query) {
            const context = settings.clinic_context;
            const known = [context.address, context.fees, ...context.services, ...context.doctors].filter(Boolean).some((item) => query.includes(item.toLowerCase()));
            if (known)
                return { reply: `For ${tenant.name}, I can share the clinic information saved in our system. Please ask for a specific service, doctor, fee, or the clinic address.`, status: 'clinic_context_available' };
        }
        if (!asksToBook)
            return { reply: `Hello, you have reached ${tenant.name}. I can help with booking an appointment. What would you like help with?`, status: 'listening' };
        if (settings.availability === 'all_day')
            return { reply: `I can help book an appointment at ${tenant.name}. Please tell me the patient's name, preferred doctor, date, and time.`, status: 'ready_to_collect' };
        const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
        if (currentTime < settings.open_time || currentTime >= settings.close_time) {
            return { reply: `The clinic is currently closed for AI booking. Our booking line is open from ${settings.open_time} to ${settings.close_time} (${settings.timezone}). Please call again during those hours.`, status: 'closed' };
        }
        return { reply: `I can help book an appointment at ${tenant.name}. Our booking line is open until ${settings.close_time} (${settings.timezone}). Please tell me the patient's name, preferred doctor, date, and time.`, status: 'ready_to_collect' };
    }
    updateTenantTelephony(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const voiceProvider = payload.voice_provider === 'exotel_voicebot' ? 'exotel_voicebot' : payload.voice_provider === 'sarvam' || !payload.voice_provider ? 'sarvam' : null;
        if (!voiceProvider)
            return { error: 'Choose a supported AI voice provider.' };
        const existing = tenant.telephony;
        const configFields = ['phone_number', 'account_sid', 'app_id', 'region', 'enabled', 'exotel_voicebot_id', 'sarvam_org_id', 'sarvam_workspace_id', 'sarvam_agent_id', 'sarvam_agent_version', 'sarvam_connection_id'];
        const sanitizeProviderConfig = (value) => Object.fromEntries(configFields.filter((field) => Object.prototype.hasOwnProperty.call(value || {}, field)).map((field) => [field, value[field]]));
        const providerConfigs = Object.fromEntries(Object.entries(existing?.provider_configs || {}).map(([name, value]) => [name, sanitizeProviderConfig(value)]));
        const legacyProvider = existing?.voice_provider || 'sarvam';
        if (existing && !providerConfigs[legacyProvider])
            providerConfigs[legacyProvider] = {
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
        const selected = { ...(providerConfigs[voiceProvider] || {}), ...selectedFields };
        const phoneNumber = String(selected.phone_number || '').trim().replace(/[\s()-]/g, '');
        const accountSid = String(selected.account_sid || '').trim();
        const appId = String(selected.app_id || '').trim();
        const region = selected.region === 'singapore' ? 'singapore' : 'mumbai';
        const exotelVoicebotId = String(selected.exotel_voicebot_id || '').trim();
        const apiKey = String(payload.exotel_api_key || '').trim();
        const apiToken = String(payload.exotel_api_token || '').trim();
        if (apiKey.length > 512 || apiToken.length > 512)
            return { error: 'Exotel API key and token must be 512 characters or fewer.' };
        if (voiceProvider === 'sarvam' && existing?.sarvam_deployment_id) {
            const deployedSarvam = existing.provider_configs?.sarvam;
            if (deployedSarvam && (deployedSarvam.phone_number !== phoneNumber || deployedSarvam.account_sid !== accountSid || deployedSarvam.app_id !== appId || deployedSarvam.region !== region ||
                deployedSarvam.sarvam_org_id !== String(selected.sarvam_org_id || '').trim() || deployedSarvam.sarvam_workspace_id !== String(selected.sarvam_workspace_id || '').trim() ||
                deployedSarvam.sarvam_agent_id !== String(selected.sarvam_agent_id || '').trim() || deployedSarvam.sarvam_agent_version !== (Number(selected.sarvam_agent_version) || undefined) ||
                deployedSarvam.sarvam_connection_id !== String(selected.sarvam_connection_id || '').trim()))
                return { error: 'This Sarvam deployment is already active. Stop the deployment in Sarvam before changing its phone, connection, or agent settings.' };
        }
        if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber))
            return { error: 'Enter the clinic Exophone in international E.164 format, for example +919876543210.' };
        if (Object.values(this.tenants).some((item) => item.id !== tenantId &&
            Object.values(item.telephony?.provider_configs || { [item.telephony?.voice_provider || 'sarvam']: item.telephony }).some((config) => (config?.phone_number || '').replace(/[\s()-]/g, '') === phoneNumber))) {
            return { error: 'This phone number is already assigned to another clinic. Each clinic must have its own unique Exophone.' };
        }
        let enabled = Boolean(selected.enabled);
        if (selected.enabled === false)
            enabled = false;
        if (selected.enabled === true) {
            if (voiceProvider === 'exotel_voicebot') {
                if (!accountSid || !appId || !exotelVoicebotId)
                    return { error: 'For Exotel Voicebot, enter the Account SID, App / Flow ID, and Voicebot ID before enabling inbound calls.' };
                enabled = true;
            }
            else {
                if (!existing?.sarvam_deployment_id)
                    return { error: 'Sarvam inbound calls cannot be enabled until the Sarvam deployment is active. Save the settings, then use Activate inbound calls.' };
                enabled = true;
            }
        }
        const savedSelected = { ...selected, phone_number: phoneNumber, account_sid: accountSid, app_id: appId, region, enabled, exotel_voicebot_id: exotelVoicebotId };
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
    publicTelephony(config) {
        if (!config)
            return { ...defaultTelephony, credentials_configured: false, deployment_status: 'not_configured' };
        const voiceProvider = config.voice_provider || 'sarvam';
        const { exotel_api_key_encrypted: _encryptedKey, exotel_api_token_encrypted: _encryptedToken, ...publicConfig } = config;
        const exotelCredentialsConfigured = Boolean((config.exotel_api_key_encrypted && config.exotel_api_token_encrypted) || (process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN));
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
    async verifyExotelConnection(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const config = tenant.telephony;
        if (!config?.account_sid) {
            return { error: 'Save this clinic’s Exotel Account SID first.' };
        }
        const apiKey = this.decryptCredential(config.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
        const apiToken = this.decryptCredential(config.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
        if (!apiKey || !apiToken)
            return { error: 'Enter this clinic’s Exotel API Key and API Token in calling settings, or configure the legacy server credentials.' };
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
            if (response.status === 403)
                return { error: 'Exotel returned HTTP 403: the Account SID may not belong to this API Key/API Token pair, or the account is not allowed to access this resource. Copy the Account SID from the same Exotel API Settings account and confirm its region.' };
            if (!response.ok)
                return { error: `Exotel account check failed with HTTP ${response.status}.` };
            return { connected: true, provider: 'exotel', region: config.region, message: 'Exotel credentials were accepted for this clinic.' };
        }
        catch {
            return { error: 'Could not reach Exotel. Check server network access and the selected account region.' };
        }
    }
    credentialEncryptionKey() {
        const dedicatedKey = process.env.CREDENTIALS_ENCRYPTION_KEY || '';
        if (process.env.NODE_ENV === 'production' && dedicatedKey.length < 32) {
            throw new Error('Configure CREDENTIALS_ENCRYPTION_KEY with at least 32 characters before saving provider credentials in production.');
        }
        const secret = dedicatedKey || process.env.JWT_SECRET || 'development-only-secret-change-before-production-0123456789';
        if (secret.length < 32)
            throw new Error('Set CREDENTIALS_ENCRYPTION_KEY or a JWT_SECRET of at least 32 characters before saving provider credentials.');
        return (0, node_crypto_1.scryptSync)(secret, 'carestack-provider-credentials-v1', 32);
    }
    encryptCredential(value) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.credentialEncryptionKey(), iv);
        const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
    }
    decryptCredential(value) {
        if (!value)
            return '';
        try {
            const [encodedIv, encodedTag, encodedCiphertext] = value.split('.');
            if (!encodedIv || !encodedTag || !encodedCiphertext)
                return '';
            const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', this.credentialEncryptionKey(), Buffer.from(encodedIv, 'base64'));
            decipher.setAuthTag(Buffer.from(encodedTag, 'base64'));
            return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64')), decipher.final()]).toString('utf8');
        }
        catch {
            return '';
        }
    }
    validateVoiceToolSecret(tenantId, suppliedSecret) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length > 64)
            return false;
        const master = process.env.VOICE_TOOL_SECRET || '';
        if (master.length < 32)
            return false;
        const expected = Buffer.from((0, node_crypto_1.createHmac)('sha256', master).update(tenantId).digest('hex'));
        const supplied = Buffer.from(suppliedSecret || '');
        return supplied.length === expected.length && (0, node_crypto_1.timingSafeEqual)(supplied, expected);
    }
    getVoiceToolSecret(tenantId) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) || tenantId.length > 64)
            return '';
        const master = process.env.VOICE_TOOL_SECRET || '';
        return master.length >= 32 ? (0, node_crypto_1.createHmac)('sha256', master).update(tenantId).digest('hex') : '';
    }
    async activateVoiceDeployment(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const config = tenant.telephony;
        if (config?.voice_provider === 'exotel_voicebot')
            return { error: 'Exotel Voicebot is activated in the Exotel console after its bot and inbound flow are configured.' };
        if (!config?.phone_number || !config.sarvam_org_id || !config.sarvam_workspace_id || !config.sarvam_agent_id ||
            !config.sarvam_agent_version || !config.sarvam_connection_id)
            return { error: 'Complete the clinic number and Sarvam deployment fields first.' };
        if (!process.env.SARVAM_API_KEY)
            return { error: 'SARVAM_API_KEY is not configured on the server.' };
        if ((process.env.VOICE_TOOL_SECRET || '').length < 32)
            return { error: 'VOICE_TOOL_SECRET must be configured on the server with at least 32 characters.' };
        if (config.sarvam_deployment_id)
            return { error: 'A Sarvam deployment is already active for this clinic. Pause or remove it in Sarvam before creating another.' };
        const url = `https://apps.sarvam.ai/api/app-authoring/v1/orgs/${encodeURIComponent(config.sarvam_org_id)}/workspaces/${encodeURIComponent(config.sarvam_workspace_id)}/deployments`;
        const deploymentName = `${tenant.name} inbound receptionist`.replace(/[^\w -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) || 'Clinic inbound receptionist';
        const payload = {
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
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.deployment_id)
                return { error: `Sarvam deployment failed (${response.status}). Check the Sarvam agent, Exotel connection, and phone number configuration.` };
            config.sarvam_deployment_id = result.deployment_id;
            config.enabled = true;
            config.provider_configs = { ...(config.provider_configs || {}), sarvam: { ...(config.provider_configs?.sarvam || {}), enabled: true } };
            this.persistState();
            return { deployment_id: result.deployment_id, telephony: this.publicTelephony(config) };
        }
        catch {
            return { error: 'Could not reach Sarvam. No deployment was confirmed; check Sarvam before retrying to avoid duplicates.' };
        }
    }
    async voiceTool(tenantId, payload) {
        const started = node_perf_hooks_1.performance.now();
        const actionValue = String(payload?.action || '').trim().toLowerCase();
        const action = ['clinic_info', 'faq', 'availability', 'book'].includes(actionValue) ? actionValue : 'unknown';
        let outcome = 'success';
        try {
            const result = await this.dispatchVoiceTool(tenantId, payload);
            if (result && typeof result === 'object' && 'error' in result)
                outcome = result.unavailable ? 'dependency_unavailable' : 'rejected';
            return result;
        }
        catch (error) {
            outcome = 'error';
            throw error;
        }
        finally {
            console.info(JSON.stringify({ event: 'voice_tool.service_timing', tenant_id: tenantId, action, duration_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), outcome }));
        }
    }
    async dispatchVoiceTool(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { error: 'Clinic not found.' };
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
                response_policy: 'Only values returned here are approved. Never invent, guess, autocomplete, or substitute a doctor name. If doctors is empty, say the clinic has not provided a doctor list and offer clinic staff; do not name a doctor. If the caller has no doctor preference, check availability without doctor_name, tell the caller the returned available doctor, and obtain confirmation of the complete booking details before booking. patient_name is the name the appointment is booked under and may differ from the caller. Use only the exact name the caller stated and confirmed; never invent, complete, translate, normalize, or substitute a sample, placeholder, or another caller name. If unclear, ask the caller to repeat or spell it. Never invent a patient phone number or use the clinic phone number for the patient. Use incoming caller ID only when Exotel explicitly exposes it to the agent as verified call context, and ask the caller to confirm it; otherwise ask the caller for a reachable number and repeat it back. Offer a human receptionist for other clinic questions.',
            };
        }
        if (action === 'faq') {
            const query = String(payload?.question || payload?.query || '').trim().toLowerCase();
            if (!query)
                return { matched: false, handoff: true, message: 'Ask a specific clinic question or offer clinic staff.' };
            const match = this.getVoiceAgent(tenantId).clinic_context.faqs.find((faq) => query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query));
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
            if (typeof payload.doctor_name !== 'string')
                return { error: 'doctor_name must be a string. Use an empty string when the caller has no doctor preference.' };
            const date = this.normalizeVoiceDate(tenantId, payload.date);
            const time = this.normalizeVoiceTime(payload.time);
            const doctor = String(payload.doctor_name || '').trim();
            if (!date)
                return { error: 'Please provide a date such as today, tomorrow, or a calendar date.' };
            if (!time)
                return { error: 'Please provide an appointment time, for example 10 AM or 14:30.' };
            if (!this.isFutureClinicDate(tenantId, date, time))
                return { error: 'That time has passed. Please ask for a future appointment time.' };
            const policy = this.validateAgentBooking(tenantId, time);
            if (policy)
                return { available: false, message: policy };
            const clinicDoctors = this.getClinicDoctorCandidates(tenantId);
            const selectedDoctor = doctor
                ? clinicDoctors.find((candidate) => candidate.toLocaleLowerCase() === doctor.toLocaleLowerCase())
                : undefined;
            if (doctor && !selectedDoctor) {
                return { check_status: 'error', available: null, date, time, message: 'Availability was not checked because that doctor is not in the clinic doctor list. Use an exact name returned by clinic_info or leave doctor_name empty to check all configured doctors.' };
            }
            const candidates = selectedDoctor ? [selectedDoctor] : clinicDoctors;
            if (!candidates.length)
                return { check_status: 'error', available: null, date, time, message: 'Availability was not checked because no doctors are configured for this clinic. Please ask the clinic team to add its doctors before booking.' };
            const matches = candidates.map((doctorName) => ({ doctor_name: doctorName, conflict: this.findScheduleConflict(tenantId, date, time, doctorName) }));
            const selected = matches.find((candidate) => !candidate.conflict);
            const availableSlots = [];
            if (!selected) {
                const requestedStart = this.timeToMinutes(time);
                const duration = this.appointmentDuration(tenantId);
                const settings = this.getVoiceAgent(tenantId);
                const opening = settings.availability === 'business_hours' ? (this.timeToMinutes(settings.open_time) ?? 0) : 0;
                const closing = settings.availability === 'business_hours' ? (this.timeToMinutes(settings.close_time) ?? 1440) : 1440;
                for (let offset = 15; offset < 1440 && availableSlots.length < 3; offset += 15) {
                    const starts = [requestedStart + offset, requestedStart - offset];
                    for (const start of starts) {
                        if (start < opening || start + duration > closing || start + duration > 1440)
                            continue;
                        const candidateTime = this.minutesToTime(start);
                        if (!this.isFutureClinicDate(tenantId, date, candidateTime))
                            continue;
                        const freeDoctors = candidates.filter((doctorName) => !this.findScheduleConflict(tenantId, date, candidateTime, doctorName, duration));
                        if (freeDoctors.length) {
                            if (!availableSlots.some((slot) => slot.time === candidateTime)) {
                                availableSlots.push({ time: candidateTime, doctor_names: freeDoctors });
                                if (availableSlots.length >= 3)
                                    break;
                            }
                        }
                    }
                }
                availableSlots.sort((left, right) => Math.abs((this.timeToMinutes(left.time) ?? 0) - requestedStart) - Math.abs((this.timeToMinutes(right.time) ?? 0) - requestedStart));
            }
            return {
                check_status: 'checked', available: Boolean(selected), date, time, duration_minutes: this.appointmentDuration(tenantId),
                ...(selected ? { doctor_name: selected.doctor_name } : { doctor_name: doctor || undefined }),
                available_doctors: matches.filter((candidate) => !candidate.conflict).map((candidate) => candidate.doctor_name),
                ...(availableSlots.length ? { available_slots: availableSlots } : {}),
                source: 'portal appointment calendar',
                message: selected
                    ? `The requested time is available with ${selected.doctor_name}. Tell the caller which doctor is available and get confirmation before booking.`
                    : doctor && matches[0].conflict
                        ? this.scheduleConflictMessage(tenantId, matches[0].conflict)
                        : 'No configured doctor is free at that time. Offer one of the returned available_slots, if any, or ask the caller for another time.',
            };
        }
        if (action === 'book') {
            const requiredFields = ['request_id', 'confirmed', 'patient_name', 'phone_number', 'date', 'time'];
            const missingFields = requiredFields.filter((field) => payload?.[field] === undefined || payload?.[field] === null || (typeof payload[field] === 'string' && !payload[field].trim()));
            if (missingFields.length)
                return { error: `Missing required booking fields: ${missingFields.join(', ')}.` };
            if (payload.confirmed !== true)
                return { error: 'Caller confirmation is required before booking.' };
            const requestId = String(payload.request_id).trim();
            if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId))
                return { error: 'request_id must be 8 to 80 letters, numbers, underscores, or hyphens.' };
            const date = this.normalizeVoiceDate(tenantId, payload.date);
            const time = this.normalizeVoiceTime(payload.time);
            const patientName = String(payload.patient_name).trim();
            const phone = String(payload.phone_number).trim();
            const doctor = String(payload.doctor_name || '').trim();
            const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
            if (patientName.length < 2 || patientName.length > 120)
                return { error: 'patient_name must be between 2 and 120 characters.' };
            if (!/^\+?[\d\s()-]{8,20}$/.test(phone))
                return { error: 'phone_number must contain a valid phone number.' };
            if (doctor.length > 120)
                return { error: 'doctor_name must be 120 characters or fewer.' };
            if (reason.length > 500)
                return { error: 'reason must be 500 characters or fewer.' };
            if (!date || !time)
                return { error: 'Provide a date such as today or tomorrow and a time such as 10 AM or 14:30.' };
            if (!this.isFutureClinicDate(tenantId, date, time))
                return { error: 'That time has passed. Please ask for a future appointment time.' };
            const id = `VOICE-${requestId}`;
            const prior = tenant.bookings.find((booking) => booking.id === id);
            if (prior) {
                await this.waitForPendingPersistence();
                return { appointment: prior, idempotent_replay: true };
            }
            const policy = this.validateAgentBooking(tenantId, time);
            if (policy)
                return { error: policy };
            const duration = this.appointmentDuration(tenantId);
            let assignedDoctor = doctor;
            if (assignedDoctor) {
                const knownDoctor = this.getClinicDoctorCandidates(tenantId)
                    .find((candidate) => candidate.toLocaleLowerCase() === assignedDoctor.toLocaleLowerCase());
                if (!knownDoctor)
                    return { error: 'doctor_name must match a doctor configured for this clinic.' };
                assignedDoctor = knownDoctor;
            }
            if (!assignedDoctor) {
                const availableDoctor = this.getClinicDoctorCandidates(tenantId)
                    .find((candidate) => !this.findScheduleConflict(tenantId, date, time, candidate, duration));
                if (!availableDoctor)
                    return { error: 'No configured doctor is available at that time. Ask the caller for another time or contact the clinic.' };
                return {
                    booked: false, confirmation_required: true, doctor_name: availableDoctor, date, time,
                    message: `No appointment was created. Offer ${availableDoctor} for this time and get the caller's confirmation. Then call book again with doctor_name set to ${availableDoctor}.`,
                };
            }
            const conflict = this.findScheduleConflict(tenantId, date, time, assignedDoctor, duration);
            if (conflict)
                return { error: this.scheduleConflictMessage(tenantId, conflict) };
            const appointment = { id, patient_name: patientName, phone_number: phone, doctor_name: assignedDoctor, appointment_date: date, appointment_time: time, duration_minutes: duration, reason, status: 'confirmed' };
            let saved;
            try {
                saved = await this.addBooking(tenantId, appointment);
            }
            catch {
                return { error: 'Appointment storage is temporarily unavailable; booking was not confirmed.', unavailable: true };
            }
            if (!saved || 'error' in saved)
                return { error: saved && 'error' in saved ? saved.error : 'Could not save appointment.' };
            if (!saved.id)
                return { error: 'Appointment persistence did not return an appointment ID.' };
            return { appointment: saved, idempotent_replay: false };
        }
        if (action === 'cancel' || action === 'reschedule')
            return { error: 'This appointment change is not enabled: patient verification and an authoritative scheduling integration are not configured. Offer a human receptionist.' };
        return { error: 'Unsupported action. Supported actions are clinic_info, faq, availability, and book.' };
    }
    async ingestExotelVoicebotWebhook(tenantId, authorizationHeader, payload) {
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
                authenticated ||= user.length === expectedUser.length && password.length === expectedPassword.length && (0, node_crypto_1.timingSafeEqual)(user, expectedUser) && (0, node_crypto_1.timingSafeEqual)(password, expectedPassword);
            }
            catch {
                authenticated = false;
            }
        }
        if (!tenant || !authenticated)
            return { error: 'Webhook authentication failed.' };
        const callSid = String(payload?.metadata?.call_sid || payload?.external_id || '').trim();
        const sessionId = String(payload?.session_id || '').trim();
        if (!/^[A-Za-z0-9_-]{6,128}$/.test(callSid) || !sessionId || sessionId.length > 128)
            return { error: 'A valid Exotel call SID and session_id are required.' };
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
            if (calls.length > 100)
                calls.splice(0, calls.length - 100);
        }
        call.session_id = sessionId;
        if (payload?.conversation_id)
            call.conversation_id = String(payload.conversation_id).slice(0, 128);
        if (payload?.contact_uri)
            call.caller_phone = String(payload.contact_uri).replace(/^sip:/i, '').split('@')[0].slice(0, 64);
        if (payload?.landing_number)
            call.landing_number = String(payload.landing_number).slice(0, 64);
        if (payload?.session_state)
            call.session_state = String(payload.session_state).slice(0, 40);
        if (payload?.start_time)
            call.started_at = String(payload.start_time).slice(0, 64);
        if (payload?.end_time)
            call.ended_at = String(payload.end_time).slice(0, 64);
        const incomingSegments = (Array.isArray(payload?.events) ? payload.events : [])
            .filter((event) => event?.event_type === 'transcript')
            .flatMap((event) => Array.isArray(event?.event_data?.transcripts) ? event.event_data.transcripts : [])
            .flatMap((transcript) => Array.isArray(transcript?.transcript_segments) ? transcript.transcript_segments : [])
            .filter((segment) => typeof segment?.text === 'string' && segment.text.trim())
            .map((segment) => ({
            speaker: String(segment.speaker || 'unknown').slice(0, 32),
            text: String(segment.text).trim().slice(0, 2000),
            ...(segment.start_timestamp ? { start_timestamp: String(segment.start_timestamp).slice(0, 64) } : {}),
            ...(segment.end_timestamp ? { end_timestamp: String(segment.end_timestamp).slice(0, 64) } : {}),
        }));
        for (const segment of incomingSegments) {
            const duplicate = call.transcript_segments.some((existing) => existing.speaker === segment.speaker && existing.text === segment.text && existing.start_timestamp === segment.start_timestamp);
            if (!duplicate && call.transcript_segments.length < 100)
                call.transcript_segments.push(segment);
        }
        call.updated_at = new Date().toISOString();
        this.persistState();
        await this.waitForPendingPersistence();
        return { accepted: true, call_sid: callSid, transcript_segments_saved: incomingSegments.length };
    }
    listExotelCalls(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        return [...(tenant.exotel_calls || [])]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map(({ call_sid, session_id, conversation_id, caller_phone, landing_number, session_state, started_at, ended_at, transcript_segments, recording_available, updated_at }) => ({
            call_sid, session_id, conversation_id, caller_phone, landing_number, session_state, started_at, ended_at, booking_id: (tenant.exotel_calls || []).find((item) => item.call_sid === call_sid)?.booking_id,
            transcript_segments, recording_available, updated_at,
        }));
    }
    async syncExotelCalls(tenantId, startDate, endDate, after) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
        if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || startDate < new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10) || endDate > new Date().toISOString().slice(0, 10)) {
            return { error: 'Use valid dates within the last six months, with start_date on or before end_date.' };
        }
        if ((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 > 30) {
            return { error: 'Exotel call sync supports date ranges of at most 31 days.' };
        }
        const config = tenant.telephony;
        const apiKey = this.decryptCredential(config?.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
        const apiToken = this.decryptCredential(config?.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
        if (!config?.account_sid || !config.phone_number || !apiKey || !apiToken)
            return { error: 'Save the Exotel Account SID and ExoPhone, and configure the Exotel API credentials first.' };
        const host = config.region === 'singapore' ? 'https://api.exotel.com' : 'https://api.in.exotel.com';
        const query = new URLSearchParams({
            DateCreated: `gte:${startDate} 00:00:00;lte:${endDate} 23:59:59`,
            PhoneNumber: config.phone_number,
            Direction: 'inbound',
            PageSize: '100',
            SortBy: 'DateCreated:desc',
        });
        if (after) {
            if (after.length > 512 || !/^[A-Za-z0-9+/=_-]+$/.test(after))
                return { error: 'Exotel pagination cursor is invalid.' };
            query.set('After', after);
        }
        try {
            const providerCalls = [];
            let nextAfter = '';
            const authorization = `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`;
            for (let page = 0; page < 10; page += 1) {
                const response = await fetch(`${host}/v1/Accounts/${encodeURIComponent(config.account_sid)}/Calls.json?${query}`, {
                    headers: { Authorization: authorization, Accept: 'application/json' },
                });
                if (!response.ok)
                    return { error: `Exotel call history lookup failed with HTTP ${response.status}.` };
                const payload = await response.json();
                providerCalls.push(...(Array.isArray(payload?.Calls) ? payload.Calls : []));
                const nextUri = String(payload?.Metadata?.NextPageUri || '');
                const cursor = nextUri ? new URL(nextUri, host).searchParams.get('After') || '' : '';
                if (!cursor) {
                    nextAfter = '';
                    break;
                }
                nextAfter = cursor;
                query.set('After', cursor);
            }
            const calls = tenant.exotel_calls ||= [];
            let imported = 0;
            for (const providerCall of providerCalls) {
                const callSid = String(providerCall?.Sid || '').trim();
                if (!/^[A-Za-z0-9_-]{6,128}$/.test(callSid))
                    continue;
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
            if (calls.length > 100)
                calls.splice(0, calls.length - 100);
            this.persistState();
            await this.waitForPendingPersistence();
            return { imported, matched: providerCalls.length, has_more: Boolean(nextAfter), ...(nextAfter ? { next_after: nextAfter } : {}), calls: this.listExotelCalls(tenantId) };
        }
        catch {
            return { error: 'Could not retrieve Exotel call history. Check Exotel API access and the selected region.' };
        }
    }
    async bookExotelCall(tenantId, callSid, payload) {
        const tenant = this.tenants[tenantId];
        const call = tenant?.exotel_calls?.find((item) => item.call_sid === callSid);
        if (!tenant || !call)
            return { error: 'Call not found.' };
        const digits = (value) => value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
        if (call.caller_phone && digits(String(payload?.phone_number || '')) !== digits(call.caller_phone)) {
            return { error: 'The booking phone number must match the caller ID recorded by Exotel.' };
        }
        const requestId = `exotel-${callSid}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);
        const result = await this.voiceTool(tenantId, { ...payload, action: 'book', request_id: requestId });
        if ('error' in result)
            return result;
        const appointment = result.appointment;
        call.booking_id = appointment.id;
        call.updated_at = new Date().toISOString();
        this.persistState();
        await this.waitForPendingPersistence();
        return { ...result, call_sid: callSid };
    }
    async getExotelCallRecording(tenantId, callSid) {
        const tenant = this.tenants[tenantId];
        const call = tenant?.exotel_calls?.find((item) => item.call_sid === callSid);
        if (!tenant || !call)
            return { error: 'Call not found.' };
        const config = tenant.telephony;
        const apiKey = this.decryptCredential(config?.exotel_api_key_encrypted) || process.env.EXOTEL_API_KEY || '';
        const apiToken = this.decryptCredential(config?.exotel_api_token_encrypted) || process.env.EXOTEL_API_TOKEN || '';
        if (!config?.account_sid || !apiKey || !apiToken)
            return { error: 'Exotel Call Details credentials are not configured for this clinic.' };
        const host = config.region === 'singapore' ? 'https://api.exotel.com' : 'https://api.in.exotel.com';
        const url = `${host}/v1/Accounts/${encodeURIComponent(config.account_sid)}/Calls/${encodeURIComponent(callSid)}?RecordingUrlValidity=10`;
        try {
            const response = await fetch(url, {
                headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`, Accept: 'application/json, application/xml' },
            });
            if (!response.ok)
                return { error: `Exotel call lookup failed with HTTP ${response.status}.` };
            const raw = await response.text();
            let recordingUrl = '';
            let signedRecordingUrl = false;
            try {
                const parsed = JSON.parse(raw);
                const callData = parsed?.Call || parsed?.call || parsed?.RestResponse?.Call || parsed;
                const signed = callData?.PreSignedRecordingUrl || callData?.presigned_recording_url;
                recordingUrl = String(signed || callData?.RecordingUrl || callData?.recording_url || '');
                signedRecordingUrl = Boolean(signed);
            }
            catch {
                const match = /<(PreSignedRecordingUrl|RecordingUrl)>([\s\S]*?)<\/\1>/i.exec(raw);
                recordingUrl = match?.[2]?.trim().replace(/&amp;/g, '&') || '';
                signedRecordingUrl = match?.[1].toLowerCase() === 'presignedrecordingurl';
            }
            if (recordingUrl && !/^https:\/\//i.test(recordingUrl))
                return { error: 'Exotel returned an invalid recording URL.' };
            call.recording_available = Boolean(recordingUrl);
            call.updated_at = new Date().toISOString();
            this.persistState();
            await this.waitForPendingPersistence();
            return recordingUrl ? { call_sid: callSid, recording_url: recordingUrl, ...(signedRecordingUrl ? { expires_in_minutes: 10 } : {}) } : { call_sid: callSid, recording_url: null, message: 'No recording is available for this call.' };
        }
        catch {
            return { error: 'Could not retrieve the recording details from Exotel.' };
        }
    }
    getClinicDoctorCandidates(tenantId) {
        return this.getActiveDoctorNames(tenantId);
    }
    getActiveClinicDoctorDirectory(tenantId) {
        return (this.tenants[tenantId]?.doctors || [])
            .filter((doctor) => doctor.status === 'active')
            .map(({ name, specialty }) => ({ name, specialty }));
    }
    clinicDateParts(tenantId, date = new Date()) {
        const timezone = this.getVoiceAgent(tenantId).timezone || 'Asia/Kolkata';
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
        const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
    }
    dateKey(year, month, day) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day)
            return null;
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    normalizeVoiceDate(tenantId, input) {
        const raw = String(input || '').trim().toLocaleLowerCase();
        if (!raw)
            return null;
        const today = this.clinicDateParts(tenantId);
        const relative = raw.normalize('NFC');
        let offset = null;
        if (/\b(day after tomorrow|parso)\b|परसों|परसो/u.test(relative))
            offset = 2;
        else if (/\b(today|aaj|aj)\b|आज/u.test(relative))
            offset = 0;
        else if (/\b(tomorrow|kal)\b|कल/u.test(relative))
            offset = 1;
        if (offset !== null) {
            const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
            return this.dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
        }
        let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
        if (match)
            return this.dateKey(Number(match[1]), Number(match[2]), Number(match[3]));
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
    normalizeVoiceTime(input) {
        const raw = String(input || '').trim().toLocaleLowerCase();
        if (!raw)
            return null;
        const match = /(?:^|\b)(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?\s*(?:o'?clock|baje|baj[eé]|bje|बजे)?\b/u.exec(raw);
        if (!match)
            return null;
        let hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const meridiem = match[3]?.replace(/\./g, '')
            || (/\b(subah|morning)\b|सुबह/u.test(raw) ? 'am' : undefined)
            || (/\b(shaam|sham|evening|night|raat)\b|दोपहर|शाम|रात/u.test(raw) ? 'pm' : undefined);
        if (minute > 59)
            return null;
        if (meridiem) {
            if (hour < 1 || hour > 12)
                return null;
            if (meridiem === 'am' && hour === 12)
                hour = 0;
            if (meridiem === 'pm' && hour < 12)
                hour += 12;
        }
        else if (hour > 23)
            return null;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    isFutureClinicDate(tenantId, date, time) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            return false;
        const parsed = new Date(`${date}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
            return false;
        const timezone = this.getVoiceAgent(tenantId).timezone;
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        const today = `${values.year}-${values.month}-${values.day}`;
        return date > today || (date === today && time > `${values.hour}:${values.minute}`);
    }
    validateAgentBooking(tenantId, appointmentTime) {
        if (!this.tenants[tenantId])
            return 'Tenant not found';
        const voiceAgent = this.getVoiceAgent(tenantId);
        if (!voiceAgent.enabled)
            return 'The clinic voice agent is currently disabled.';
        const start = this.timeToMinutes(appointmentTime);
        if (start === null)
            return 'Provide a valid appointment time in 24-hour HH:mm format.';
        const end = start + this.appointmentDuration(tenantId);
        if (end > 1440)
            return 'The appointment would extend past midnight. Choose an earlier time.';
        if (voiceAgent.availability === 'business_hours' && (start < (this.timeToMinutes(voiceAgent.open_time) ?? 0) || end > (this.timeToMinutes(voiceAgent.close_time) ?? 1440))) {
            return `This ${this.appointmentDuration(tenantId)}-minute appointment must finish by ${voiceAgent.close_time} (${voiceAgent.timezone}). Choose a time between ${voiceAgent.open_time} and ${voiceAgent.close_time}.`;
        }
        return null;
    }
    deleteTenant(tenantId) {
        if (!this.tenants[tenantId])
            return false;
        delete this.tenants[tenantId];
        this.persistState();
        return true;
    }
    monthlyRevenueFor(tenant) {
        const plan = this.planCatalog.find((item) => item.id === tenant.plan);
        if (!plan || tenant.subscription_status !== 'active')
            return 0;
        return tenant.billing_cycle === 'annual' ? plan.annual_price / 12 : plan.monthly_price;
    }
    updateAdminPrice(tenant) {
        tenant.monthly_price = this.monthlyRevenueFor(tenant);
    }
    getDashboard(tenantId, activityRange = '7d') {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { statusCode: 404, message: 'Tenant not found' };
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
    getTenantAnalytics(tenant, requestedActivityRange = '7d') {
        const activityRange = ['today', '7d', '30d'].includes(requestedActivityRange) ? requestedActivityRange : '7d';
        const activityDays = activityRange === 'today' ? 1 : activityRange === '30d' ? 30 : 7;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayKey = today.toISOString().slice(0, 10);
        const upcoming = tenant.bookings.filter((booking) => booking.appointment_date >= todayKey && !['cancelled', 'no_show'].includes(booking.status));
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
        const createdInRange = (createdAt, start, end) => {
            if (!createdAt)
                return false;
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
            }, new Map())].map(([doctor, count]) => ({ doctor, count }))
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
    getPatients(tenantId) {
        return this.tenants[tenantId]?.patients || [];
    }
    ensureBookingPatient(tenant, booking) {
        tenant.patients ||= [];
        const name = String(booking.patient_name || '').trim();
        const phone = String(booking.phone_number || '').trim();
        if (!name || !phone)
            return { patient: null, created: false };
        const normalizeName = (value) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
        const normalizePhone = (value) => {
            const digits = value.replace(/\D/g, '');
            return digits.replace(/^0091(?=\d{10}$)/, '').replace(/^91(?=\d{10}$)/, '');
        };
        const patient = tenant.patients.find((item) => normalizeName(item.name) === normalizeName(name) && normalizePhone(item.phone) === normalizePhone(phone));
        if (patient)
            return { patient, created: false };
        const usedIds = new Set(tenant.patients.map((item) => item.id));
        let nextId = tenant.patients.length + 1001;
        while (usedIds.has(`pat-${nextId}`))
            nextId += 1;
        const createdPatient = {
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
    async addBooking(tenantId, booking) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const policyError = this.validateAgentBooking(tenantId, booking.appointment_time);
        if (policyError)
            return { error: policyError };
        const existing = tenant.bookings.find((item) => item.id === booking.id);
        if (existing) {
            const registration = this.ensureBookingPatient(tenant, existing);
            const patientLinkChanged = Boolean(registration.patient && !existing.patient_id);
            const previousPatientId = existing.patient_id;
            if (patientLinkChanged && registration.patient)
                existing.patient_id = registration.patient.id;
            if (registration.created || patientLinkChanged) {
                try {
                    this.persistState();
                    await this.waitForPendingPersistence();
                }
                catch (error) {
                    existing.patient_id = previousPatientId;
                    if (registration.created && registration.patient) {
                        tenant.patients = tenant.patients.filter((item) => item.id !== registration.patient.id);
                    }
                    throw error;
                }
            }
            else {
                await this.waitForPendingPersistence();
            }
            return existing;
        }
        const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
        const conflict = this.findScheduleConflict(tenantId, booking.appointment_date, booking.appointment_time, booking.doctor_name, duration);
        if (conflict)
            return { error: this.scheduleConflictMessage(tenantId, conflict) };
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
        }
        catch (error) {
            const index = tenant.bookings.findIndex((item) => item.id === savedBooking.id);
            if (index !== -1)
                tenant.bookings.splice(index, 1);
            if (registration.created && registration.patient) {
                tenant.patients = tenant.patients.filter((item) => item.id !== registration.patient.id);
            }
            throw error;
        }
        return savedBooking;
    }
    async waitForPendingPersistence() {
        const started = node_perf_hooks_1.performance.now();
        let outcome = 'success';
        try {
            await this.pendingPostgresWrite;
        }
        catch (error) {
            outcome = 'failure';
            throw error;
        }
        finally {
            console.info(JSON.stringify({ event: 'postgres.persist_wait_timing', duration_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), outcome }));
        }
    }
    updateBookingStatus(tenantId, bookingId, status) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { error: 'Tenant not found' };
        const booking = tenant.bookings.find((item) => item.id === bookingId);
        if (!booking)
            return { error: 'Appointment not found' };
        booking.status = status;
        this.persistState();
        return booking;
    }
    addPatient(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { statusCode: 404, message: 'Tenant not found' };
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
    updatePatient(tenantId, patientId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { statusCode: 404, message: 'Tenant not found' };
        const patient = tenant.patients.find((item) => item.id === patientId);
        if (!patient)
            return { statusCode: 404, message: 'Patient not found' };
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
    deletePatient(tenantId, patientId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { statusCode: 404, message: 'Tenant not found' };
        const patientExists = tenant.patients.some((patient) => patient.id === patientId);
        if (!patientExists)
            return { statusCode: 404, message: 'Patient not found' };
        tenant.patients = tenant.patients.filter((patient) => patient.id !== patientId);
        this.persistState();
        return { deleted: true, patient_id: patientId };
    }
}
exports.AppService = AppService;
//# sourceMappingURL=app.service.js.map
