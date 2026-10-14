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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const defaultClinicContext = { address: '', services: [], doctors: [], fees: '', languages: ['Hindi', 'Hinglish', 'English'], instructions: '', faqs: [] };
const defaultVoiceAgent = { enabled: true, availability: 'business_hours', open_time: '09:00', close_time: '18:00', timezone: 'Asia/Kolkata', appointment_duration_minutes: 30, clinic_context: defaultClinicContext };
const defaultTelephony = { provider: 'exotel', voice_provider: 'sarvam', exotel_voicebot_id: '', phone_number: '', account_sid: '', app_id: '', region: 'mumbai', enabled: false };
class AppService {
    constructor() {
        this.tenants = {};
        this.clinicInterests = [];
        this.superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@hospital.ai').trim().toLowerCase();
        this.superAdminPasswordHash = bcryptjs_1.default.hashSync(process.env.SUPER_ADMIN_PASSWORD || 'admin123', 12);
        this.planCatalog = [
            { id: 'starter', name: 'Starter', monthly_price: 4999, annual_price: 49990, clinic_limit: 1, user_limit: 3 },
            { id: 'growth', name: 'Growth', monthly_price: 14999, annual_price: 149990, clinic_limit: 5, user_limit: 15 },
            { id: 'enterprise', name: 'Enterprise', monthly_price: 39999, annual_price: 399990, clinic_limit: null, user_limit: null },
        ];
        const databasePath = process.env.DATABASE_PATH || node_path_1.default.resolve(__dirname, '..', 'data', 'hospital.sqlite');
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
            const state = JSON.parse(savedState.payload);
            this.tenants = state.tenants || {};
            this.planCatalog = state.planCatalog || this.planCatalog;
            this.clinicInterests = state.clinicInterests || [];
            this.migratePasswordHashes();
        }
        else {
            if (process.env.NODE_ENV !== 'production')
                this.seed();
            this.persistState();
        }
        if (process.env.NODE_ENV === 'production') {
            const hasDemoPassword = Object.values(this.tenants).some((tenant) => tenant.users.some((user) => bcryptjs_1.default.compareSync('admin123', user.password_hash)));
            if (hasDemoPassword) {
                throw new Error('A tenant still uses the demo password. Rotate credentials or configure a clean production DATABASE_PATH before startup.');
            }
        }
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
            tenant.users.forEach((user) => {
                const legacyUser = user;
                if (!legacyUser.password_hash && legacyUser.password) {
                    legacyUser.password_hash = bcryptjs_1.default.hashSync(legacyUser.password, 12);
                    delete legacyUser.password;
                    migrated = true;
                }
            });
        });
        if (migrated)
            this.persistState();
    }
    persistState() {
        const payload = JSON.stringify({ tenants: this.tenants, planCatalog: this.planCatalog, clinicInterests: this.clinicInterests });
        this.database.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(payload, new Date().toISOString());
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
        if (email === this.superAdminEmail && await bcryptjs_1.default.compare(password, this.superAdminPasswordHash)) {
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
        const temporaryPassword = process.env.NODE_ENV === 'production'
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
            plan: tenant.plan,
            subscription_status: tenant.subscription_status,
            billing_cycle: tenant.billing_cycle,
            temporary_password: temporaryPassword,
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
            address: boundedText(context.address, 500), services: cleanList(context.services, 160), doctors: cleanList(context.doctors, 160),
            fees: boundedText(context.fees, 2000), languages: cleanList(context.languages, 40).slice(0, 8),
            instructions: boundedText(context.instructions, 4000), faqs,
        };
        tenant.voice_agent = next;
        this.persistState();
        return tenant.voice_agent;
    }
    getVoiceAgent(tenantId) {
        const stored = this.tenants[tenantId]?.voice_agent;
        return { ...defaultVoiceAgent, ...(stored || {}), clinic_context: { ...defaultClinicContext, ...(stored?.clinic_context || {}) } };
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
        const phoneNumber = String(payload.phone_number || '').trim().replace(/[\s()-]/g, '');
        const accountSid = String(payload.account_sid || '').trim();
        const appId = String(payload.app_id || '').trim();
        const region = payload.region === 'singapore' ? 'singapore' : 'mumbai';
        const voiceProvider = payload.voice_provider === 'exotel_voicebot' ? 'exotel_voicebot' : payload.voice_provider === 'sarvam' || !payload.voice_provider ? 'sarvam' : null;
        if (!voiceProvider)
            return false;
        const exotelVoicebotId = String(payload.exotel_voicebot_id || '').trim();
        const existing = tenant.telephony;
        const apiKey = String(payload.exotel_api_key || '').trim();
        const apiToken = String(payload.exotel_api_token || '').trim();
        if (apiKey.length > 512 || apiToken.length > 512)
            return false;
        if (existing?.sarvam_deployment_id && (voiceProvider !== 'sarvam' ||
            existing.phone_number !== phoneNumber || existing.account_sid !== accountSid || existing.app_id !== appId || existing.region !== region ||
            existing.sarvam_org_id !== String(payload.sarvam_org_id || '').trim() || existing.sarvam_workspace_id !== String(payload.sarvam_workspace_id || '').trim() ||
            existing.sarvam_agent_id !== String(payload.sarvam_agent_id || '').trim() || existing.sarvam_agent_version !== (Number(payload.sarvam_agent_version) || undefined) ||
            existing.sarvam_connection_id !== String(payload.sarvam_connection_id || '').trim()))
            return false;
        if (phoneNumber && !/^\+[1-9]\d{7,14}$/.test(phoneNumber))
            return false;
        if (phoneNumber && Object.values(this.tenants).some((item) => item.id !== tenantId &&
            (item.telephony?.phone_number || '').replace(/[\s()-]/g, '') === phoneNumber))
            return false;
        let enabled = tenant.telephony?.enabled || false;
        if (payload.enabled === false)
            enabled = false;
        if (payload.enabled === true) {
            if (voiceProvider === 'exotel_voicebot') {
                if (!phoneNumber || !accountSid || !appId || !exotelVoicebotId)
                    return false;
                enabled = true;
            }
            else {
                if (!tenant.telephony?.sarvam_deployment_id)
                    return false;
                enabled = true;
            }
        }
        tenant.telephony = {
            provider: 'exotel', voice_provider: voiceProvider, exotel_voicebot_id: exotelVoicebotId,
            phone_number: phoneNumber, account_sid: accountSid, app_id: appId, region, enabled,
            exotel_api_key_encrypted: apiKey ? this.encryptCredential(apiKey) : existing?.exotel_api_key_encrypted,
            exotel_api_token_encrypted: apiToken ? this.encryptCredential(apiToken) : existing?.exotel_api_token_encrypted,
            sarvam_org_id: String(payload.sarvam_org_id || '').trim(),
            sarvam_workspace_id: String(payload.sarvam_workspace_id || '').trim(),
            sarvam_agent_id: String(payload.sarvam_agent_id || '').trim(),
            sarvam_agent_version: Number(payload.sarvam_agent_version) || undefined,
            sarvam_connection_id: String(payload.sarvam_connection_id || '').trim(),
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
            deployment_status: config.sarvam_deployment_id ? 'active' : voiceProvider === 'exotel_voicebot'
                ? (config.enabled && config.exotel_voicebot_id && config.app_id ? 'active' : config.exotel_voicebot_id ? 'exotel_console_setup' : 'exotel_bot_required') : 'not_deployed',
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
        const master = process.env.VOICE_TOOL_SECRET || '';
        if (master.length < 32)
            return false;
        const expected = Buffer.from((0, node_crypto_1.createHmac)('sha256', master).update(tenantId).digest('hex'));
        const supplied = Buffer.from(suppliedSecret || '');
        return supplied.length === expected.length && (0, node_crypto_1.timingSafeEqual)(supplied, expected);
    }
    getVoiceToolSecret(tenantId) {
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
            this.persistState();
            return { deployment_id: result.deployment_id, telephony: this.publicTelephony(config) };
        }
        catch {
            return { error: 'Could not reach Sarvam. No deployment was confirmed; check Sarvam before retrying to avoid duplicates.' };
        }
    }
    voiceTool(tenantId, payload) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { error: 'Clinic not found.' };
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
            if (!query)
                return { matched: false, handoff: true, message: 'Ask a specific clinic question or offer clinic staff.' };
            const match = this.getVoiceAgent(tenantId).clinic_context.faqs.find((faq) => query.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(query));
            return match ? { matched: true, question: match.question, answer: match.answer, source: 'clinic-approved FAQ' } : { matched: false, handoff: true, message: 'No approved FAQ answer found. Offer clinic staff; do not guess.' };
        }
        if (action === 'availability') {
            const date = String(payload.date || '');
            const time = String(payload.time || '');
            const doctor = String(payload.doctor_name || '').trim();
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !this.isFutureClinicDate(tenantId, date, time) || !doctor)
                return { error: 'Provide a future date, valid time, and doctor name.' };
            const policy = this.validateAgentBooking(tenantId, time);
            if (policy)
                return { available: false, message: policy };
            const conflict = this.findScheduleConflict(tenantId, date, time, doctor);
            return { available: !conflict, date, time, duration_minutes: this.appointmentDuration(tenantId), doctor_name: doctor, source: 'clinic appointment calendar', message: conflict ? this.scheduleConflictMessage(tenantId, conflict) : 'No overlapping appointment is recorded for this doctor in the requested time window. Confirm with the caller before booking.' };
        }
        if (action === 'book') {
            if (payload.confirmed !== true)
                return { error: 'Caller confirmation is required before booking.' };
            const requestId = String(payload.request_id || '');
            if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId))
                return { error: 'A unique request_id is required for safe retries.' };
            const date = String(payload.date || '');
            const time = String(payload.time || '');
            const patientName = String(payload.patient_name || '').trim();
            const phone = String(payload.phone_number || '').trim();
            const doctor = String(payload.doctor_name || '').trim();
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !this.isFutureClinicDate(tenantId, date, time) || patientName.length < 2 || !/^\+?[\d\s()-]{8,20}$/.test(phone) || !doctor)
                return { error: 'Valid patient name, phone, doctor, future date, and time are required.' };
            const id = `VOICE-${requestId}`;
            const prior = tenant.bookings.find((booking) => booking.id === id);
            if (prior)
                return { appointment: prior, idempotent_replay: true };
            const policy = this.validateAgentBooking(tenantId, time);
            if (policy)
                return { error: policy };
            const duration = this.appointmentDuration(tenantId);
            const conflict = this.findScheduleConflict(tenantId, date, time, doctor, duration);
            if (conflict)
                return { error: this.scheduleConflictMessage(tenantId, conflict) };
            const appointment = { id, patient_name: patientName, phone_number: phone, doctor_name: doctor, appointment_date: date, appointment_time: time, duration_minutes: duration, reason: String(payload.reason || 'Inbound voice appointment'), status: 'confirmed' };
            const saved = this.addBooking(tenantId, appointment);
            if (!saved || 'error' in saved)
                return { error: saved && 'error' in saved ? saved.error : 'Could not save appointment.' };
            return { appointment: saved, idempotent_replay: false };
        }
        if (action === 'cancel' || action === 'reschedule')
            return { error: 'This appointment change is not enabled: patient verification and an authoritative scheduling integration are not configured. Offer a human receptionist.' };
        return { error: 'Unsupported action. Supported actions are clinic_info, faq, availability, and book.' };
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
    getDashboard(tenantId) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return { statusCode: 404, message: 'Tenant not found' };
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
    getTenantAnalytics(tenant) {
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
        activityStart.setUTCDate(today.getUTCDate() - 6);
        const priorStart = new Date(today);
        priorStart.setUTCDate(today.getUTCDate() - 13);
        const createdInRange = (createdAt, start, end) => {
            if (!createdAt)
                return false;
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
            activity,
            schedule,
            status_breakdown: statusBreakdown,
            doctor_workload: doctorWorkload,
        };
    }
    getPatients(tenantId) {
        return this.tenants[tenantId]?.patients || [];
    }
    addBooking(tenantId, booking) {
        const tenant = this.tenants[tenantId];
        if (!tenant)
            return null;
        const policyError = this.validateAgentBooking(tenantId, booking.appointment_time);
        if (policyError)
            return { error: policyError };
        const existing = tenant.bookings.find((item) => item.id === booking.id);
        if (existing)
            return existing;
        const duration = Number(booking.duration_minutes) || this.appointmentDuration(tenantId);
        const conflict = this.findScheduleConflict(tenantId, booking.appointment_date, booking.appointment_time, booking.doctor_name, duration);
        if (conflict)
            return { error: this.scheduleConflictMessage(tenantId, conflict) };
        const savedBooking = { ...booking, duration_minutes: duration, created_at: booking.created_at || new Date().toISOString() };
        tenant.bookings.push(savedBooking);
        this.persistState();
        return savedBooking;
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