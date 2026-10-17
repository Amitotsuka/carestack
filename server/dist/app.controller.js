"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AppController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const app_service_1 = require("./app.service");
const access_guard_1 = require("./auth/access.guard");
const access_decorator_1 = require("./auth/access.decorator");
class LoginDto {
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class ClinicInterestDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], ClinicInterestDto.prototype, "clinic_name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], ClinicInterestDto.prototype, "contact_name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ClinicInterestDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+?[\d\s()-]{8,20}$/),
    __metadata("design:type", String)
], ClinicInterestDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], ClinicInterestDto.prototype, "plan", void 0);
class TenantOnboardDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "tenant_name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "tenant_domain", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "admin_name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "admin_email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "admin_phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    (0, class_validator_1.IsByteLength)(10, 72),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "admin_password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['monthly', 'annual']),
    __metadata("design:type", String)
], TenantOnboardDto.prototype, "billing_cycle", void 0);
class TenantUpdateDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "tenant_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "tenant_domain", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "admin_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "admin_email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "admin_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['monthly', 'annual']),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "billing_cycle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'paused']),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "subscription_status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TenantUpdateDto.prototype, "region", void 0);
class TenantPasswordDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    (0, class_validator_1.IsByteLength)(10, 72),
    __metadata("design:type", String)
], TenantPasswordDto.prototype, "password", void 0);
class SubscriptionUpdateDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "plan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['monthly', 'annual']),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "billing_cycle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'paused']),
    __metadata("design:type", String)
], SubscriptionUpdateDto.prototype, "subscription_status", void 0);
class PlanDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    __metadata("design:type", String)
], PlanDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], PlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PlanDto.prototype, "monthly_price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PlanDto.prototype, "annual_price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PlanDto.prototype, "clinic_limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PlanDto.prototype, "user_limit", void 0);
class PatientDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], PatientDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(7),
    __metadata("design:type", String)
], PatientDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], PatientDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(125),
    __metadata("design:type", Number)
], PatientDto.prototype, "age", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'inactive']),
    __metadata("design:type", String)
], PatientDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatientDto.prototype, "notes", void 0);
class AppointmentStatusDto {
}
__decorate([
    (0, class_validator_1.IsIn)(['confirmed', 'completed', 'cancelled', 'no_show']),
    __metadata("design:type", String)
], AppointmentStatusDto.prototype, "status", void 0);
function safeVoiceBodyFieldNames(value, depth = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth >= 2)
        return [];
    return Object.keys(value).slice(0, 30).map((key) => {
        const safeKey = /^[A-Za-z0-9_.-]{1,64}$/.test(key) ? key : '[other]';
        const child = value[key];
        return child && typeof child === 'object' && !Array.isArray(child)
            ? { [safeKey]: safeVoiceBodyFieldNames(child, depth + 1) }
            : safeKey;
    });
}
const voiceToolFieldAliases = {
    action: 'action', toolaction: 'action', operation: 'action',
    date: 'date', appointmentdate: 'date',
    time: 'time', appointmenttime: 'time',
    doctorname: 'doctor_name', doctor: 'doctor_name',
    requestid: 'request_id', confirmed: 'confirmed',
    patientname: 'patient_name', phonenumber: 'phone_number', patientphone: 'phone_number', phone: 'phone_number',
    reason: 'reason', question: 'question', query: 'query',
    toolsecret: 'tool_secret', voicetoolsecret: 'tool_secret', xvoicetoolsecret: 'tool_secret',
};
const voiceToolWrapperKeys = new Set(['arguments', 'args', 'parameters', 'params', 'input', 'payload', 'data', 'request', 'toolinput', 'toolarguments']);
const voiceToolSensitiveContextKeys = new Set(['state', 'messages', 'history', 'conversation', 'context', 'headers']);
function extractVoiceToolPayload(body) {
    const values = new Map();
    const conflicts = new Set();
    const add = (field, value) => {
        if (value === undefined || value === null || typeof value === 'object')
            return;
        if (values.has(field) && String(values.get(field)).trim() !== String(value).trim())
            conflicts.add(field);
        else
            values.set(field, value);
    };
    const visit = (node, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 4)
            return;
        if (Array.isArray(node)) {
            for (const entry of node) {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry))
                    continue;
                const item = entry;
                const name = typeof item.name === 'string' ? item.name
                    : typeof item.key === 'string' ? item.key
                        : typeof item.identifier === 'string' ? item.identifier : '';
                const field = voiceToolFieldAliases[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
                if (field && Object.prototype.hasOwnProperty.call(item, 'value'))
                    add(field, item.value);
            }
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const field = voiceToolFieldAliases[normalizedKey];
            if (field)
                add(field, value);
            else if (!voiceToolSensitiveContextKeys.has(normalizedKey) && (depth === 0 || voiceToolWrapperKeys.has(normalizedKey)))
                visit(value, depth + 1);
        }
    };
    visit(body);
    const payload = {};
    for (const [field, value] of values)
        payload[field] = value;
    let actionSource = 'explicit';
    if (typeof payload.action === 'string')
        payload.action = payload.action.trim().toLowerCase();
    if (payload.action === undefined) {
        const bookingFields = ['request_id', 'confirmed', 'patient_name', 'phone_number', 'reason'];
        if (typeof payload.date === 'string' && payload.date.trim() && typeof payload.time === 'string' && payload.time.trim() &&
            !bookingFields.some((field) => payload[field] !== undefined)) {
            payload.action = 'availability';
            actionSource = 'inferred_from_date_time';
        }
        else
            actionSource = 'missing';
    }
    if (payload.action === 'availability' && payload.doctor_name === undefined)
        payload.doctor_name = '';
    return { payload, conflicts: [...conflicts], actionSource };
}
let AppController = AppController_1 = class AppController {
    constructor(appService, jwtService) {
        this.appService = appService;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AppController_1.name);
    }
    getHealth() {
        return { status: 'ok', service: 'Hospital Node API' };
    }
    async login(body) {
        const payload = (body ?? {});
        const email = String(payload.email ?? '').trim().toLowerCase();
        const password = String(payload.password ?? '');
        const user = await this.appService.login(email, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const accessToken = await this.jwtService.signAsync({
            sub: user.user_id,
            role: user.role,
            tenant_id: user.tenant_id,
            email: user.email,
        });
        return {
            user,
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 1800,
            message: 'Login successful',
        };
    }
    resolveTenant(domain) {
        const tenant = this.appService.getTenantByDomain(domain);
        if (!tenant)
            throw new common_1.NotFoundException('Clinic not found');
        return tenant;
    }
    getPublicPlans() {
        return { plans: this.appService.getPlans().map(({ id, name, monthly_price, annual_price, clinic_limit, user_limit }) => ({ id, name, monthly_price, annual_price, clinic_limit, user_limit })) };
    }
    createClinicInterest(body) {
        const lead = this.appService.createClinicInterest({ ...body, clinic_name: body.clinic_name.trim(), contact_name: body.contact_name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim() });
        if (!lead)
            throw new common_1.BadRequestException('Choose a currently available clinic plan.');
        return { lead_id: lead.id, message: 'Thanks. Your clinic subscription request has been received.' };
    }
    listClinicInterests() {
        return { clinic_interests: this.appService.listClinicInterests() };
    }
    listTenants() {
        return { tenants: this.appService.listTenants() };
    }
    listPlans() {
        return { plans: this.appService.getPlans() };
    }
    createPlan(body) {
        const plan = this.appService.createPlan(body);
        if (!plan)
            throw new common_1.ConflictException('Plan id already exists or plan pricing is invalid');
        return { plan, message: 'Plan created successfully' };
    }
    updatePlan(planId, body) {
        if ((body.monthly_price !== undefined && body.monthly_price <= 0) || (body.annual_price !== undefined && body.annual_price <= 0)) {
            throw new common_1.BadRequestException('Plan prices must be greater than zero');
        }
        const plan = this.appService.updatePlan(planId, body);
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        return { plan, message: 'Plan updated successfully' };
    }
    deletePlan(planId) {
        const result = this.appService.deletePlan(planId);
        if (result === 'not_found')
            throw new common_1.NotFoundException('Plan not found');
        if (result === 'in_use')
            throw new common_1.ConflictException('A plan assigned to tenants cannot be deleted');
        return { deleted: true, plan_id: planId };
    }
    getSuperAdminDashboard() {
        return this.appService.getSuperAdminDashboard();
    }
    onboardTenant(body) {
        const tenant = this.appService.createTenant(body);
        if (!tenant)
            throw new common_1.ConflictException('Tenant domain or administrator email is already in use');
        return { tenant, message: 'Tenant onboarded successfully' };
    }
    updateTenant(tenantId, body) {
        try {
            const tenant = this.appService.updateTenant(tenantId, body);
            if (!tenant)
                throw new common_1.NotFoundException('Tenant not found');
            return { tenant, message: 'Tenant updated successfully' };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('already in use')) {
                throw new common_1.ConflictException(error.message);
            }
            throw error;
        }
    }
    async setTenantAdminPassword(tenantId, body) {
        const result = await this.appService.setTenantAdminPassword(tenantId, body.password);
        if (result === 'not_found')
            throw new common_1.NotFoundException('Tenant not found');
        if (result === 'admin_not_found')
            throw new common_1.ConflictException('This tenant has no administrator account');
        return { updated: true, message: 'Tenant administrator password updated successfully.' };
    }
    updateTenantTelephony(tenantId, body) {
        const config = this.appService.updateTenantTelephony(tenantId, body || {});
        if (config === null)
            throw new common_1.NotFoundException('Clinic not found');
        if (config && 'error' in config)
            throw new common_1.BadRequestException(config.error);
        if (!config)
            throw new common_1.BadRequestException('Calling settings were not saved. Check the selected provider and its phone number, then try again.');
        return { telephony: config, voice_tool_secret: this.appService.getVoiceToolSecret(tenantId), message: 'Clinic calling settings saved.' };
    }
    async activateVoiceDeployment(tenantId) {
        const result = await this.appService.activateVoiceDeployment(tenantId);
        if (result === null)
            throw new common_1.NotFoundException('Clinic not found');
        if ('error' in result)
            throw new common_1.BadRequestException(result.error);
        return { ...result, message: 'Sarvam inbound deployment created and now active.' };
    }
    async verifyExotelConnection(tenantId) {
        const result = await this.appService.verifyExotelConnection(tenantId);
        if (result === null)
            throw new common_1.NotFoundException('Clinic not found');
        if ('error' in result)
            throw new common_1.BadRequestException(result.error);
        return result;
    }
    async exotelVoicebotWebhook(tenantId, authorization, body) {
        const result = await this.appService.ingestExotelVoicebotWebhook(tenantId, authorization, body);
        if ('error' in result && result.error === 'Webhook authentication failed.')
            throw new common_1.UnauthorizedException(result.error);
        if ('error' in result)
            throw new common_1.BadRequestException(result.error);
        return { http_code: 200, response: { data: result } };
    }
    listExotelCalls(tenantId) {
        const calls = this.appService.listExotelCalls(tenantId);
        if (!calls)
            throw new common_1.NotFoundException('Clinic not found');
        return { calls };
    }
    async syncExotelCalls(tenantId, body) {
        const result = await this.appService.syncExotelCalls(tenantId, String(body?.start_date || ''), String(body?.end_date || ''), body?.after ? String(body.after) : undefined);
        if (result === null)
            throw new common_1.NotFoundException('Clinic not found');
        if ('error' in result)
            throw new common_1.BadGatewayException(result.error);
        return result;
    }
    async getExotelCallRecording(tenantId, callSid) {
        const result = await this.appService.getExotelCallRecording(tenantId, callSid);
        if ('error' in result && result.error === 'Call not found.')
            throw new common_1.NotFoundException(result.error);
        if ('error' in result)
            throw new common_1.BadGatewayException(result.error);
        return result;
    }
    async bookExotelCall(tenantId, callSid, body) {
        const result = await this.appService.bookExotelCall(tenantId, callSid, body);
        if ('error' in result && result.error === 'Call not found.')
            throw new common_1.NotFoundException(result.error);
        if ('error' in result)
            throw new common_1.BadRequestException(result.error);
        return result;
    }
    async voiceTool(tenantId, suppliedSecret, body, authorizationHeader, _tenantHeader, contentType) {
        const started = node_perf_hooks_1.performance.now();
        const traceId = (0, node_crypto_1.randomUUID)();
        const extracted = extractVoiceToolPayload(body);
        const toolPayload = extracted.payload;
        const rawAction = typeof toolPayload.action === 'string' ? toolPayload.action.trim().toLowerCase() : '';
        const supportedActions = ['clinic_info', 'faq', 'availability', 'book'];
        const actionValue = supportedActions.includes(rawAction) ? rawAction : '';
        const action = actionValue || 'unknown';
        let authenticationMs = 0;
        let dispatchMs = 0;
        let outcome = 'success';
        try {
            const authStarted = node_perf_hooks_1.performance.now();
            const authorization = String(authorizationHeader || '').trim();
            const bearerMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
            const bodyCredential = String(toolPayload.tool_secret || '').trim();
            const credential = String(suppliedSecret || '').trim() || bearerMatch?.[1] || bodyCredential;
            const authenticated = this.appService.validateVoiceToolSecret(tenantId, credential);
            authenticationMs = node_perf_hooks_1.performance.now() - authStarted;
            if (!authenticated)
                throw new common_1.UnauthorizedException('Voice tool authentication failed');
            if (extracted.conflicts.length) {
                throw new common_1.BadRequestException(`Conflicting values for voice tool field(s): ${extracted.conflicts.join(', ')}.`);
            }
            delete toolPayload.tool_secret;
            if (toolPayload.action === undefined) {
                throw new common_1.BadRequestException('Could not determine the tool action. Send action, or provide both date and time for an availability check.');
            }
            const dispatchStarted = node_perf_hooks_1.performance.now();
            const result = await this.appService.voiceTool(tenantId, toolPayload);
            dispatchMs = node_perf_hooks_1.performance.now() - dispatchStarted;
            if ('error' in result && result.error === 'Clinic not found.')
                throw new common_1.NotFoundException('Clinic not found');
            if ('error' in result && result.unavailable === true) {
                throw new common_1.ServiceUnavailableException(`${result.error} Retry with the same request_id.`);
            }
            if ('error' in result)
                throw new common_1.BadRequestException(result.error);
            return result;
        }
        catch (error) {
            outcome = error instanceof common_1.ServiceUnavailableException ? 'dependency_unavailable'
                : error instanceof common_1.UnauthorizedException ? 'unauthorized'
                    : error instanceof common_1.BadRequestException ? 'rejected'
                        : 'error';
            throw error;
        }
        finally {
            this.logger.log(JSON.stringify({
                event: 'voice_tool.request_timing', trace_id: traceId, tenant_id: tenantId, action,
                received_action: actionValue || (rawAction ? 'unsupported' : null),
                action_field_present: extracted.actionSource === 'explicit', action_source: extracted.actionSource,
                content_type: String(contentType || '').slice(0, 100) || null,
                body_field_names: safeVoiceBodyFieldNames(body),
                authentication_ms: Number(authenticationMs.toFixed(2)), dispatch_ms: Number(dispatchMs.toFixed(2)),
                total_ms: Number((node_perf_hooks_1.performance.now() - started).toFixed(2)), outcome,
            }));
        }
    }
    updateSubscription(tenantId, body) {
        if (body.subscription_status && !['active', 'paused'].includes(body.subscription_status)) {
            throw new common_1.BadRequestException('Subscription status must be active or paused');
        }
        if (body.billing_cycle && !['monthly', 'annual'].includes(body.billing_cycle)) {
            throw new common_1.BadRequestException('Billing cycle must be monthly or annual');
        }
        const tenant = this.appService.updateTenant(tenantId, body);
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        return { tenant, message: 'Subscription updated successfully' };
    }
    deleteTenant(tenantId) {
        if (!this.appService.deleteTenant(tenantId))
            throw new common_1.NotFoundException('Tenant not found');
        return { deleted: true, tenant_id: tenantId };
    }
    getDashboard(tenantId) {
        const dashboard = this.appService.getDashboard(tenantId);
        return dashboard;
    }
    updateVoiceAgent(tenantId, body) {
        const settings = this.appService.updateVoiceAgent(tenantId, body || {});
        if (settings === null)
            throw new common_1.NotFoundException('Clinic not found');
        if (!settings)
            throw new common_1.BadRequestException('Check clinic hours and timezone. Calling numbers must use international format and cannot be assigned to another clinic.');
        return { voice_agent: settings, message: 'Voice agent settings saved.' };
    }
    previewVoiceAgent(tenantId, body) {
        const preview = this.appService.previewVoiceAgent(tenantId, String(body?.caller_message || ''));
        if (!preview)
            throw new common_1.NotFoundException('Clinic not found');
        return preview;
    }
    getPatients(tenantId) {
        return { patients: this.appService.getPatients(tenantId) };
    }
    addPatient(tenantId, body) {
        return { patient: this.appService.addPatient(tenantId, body), message: 'Patient created' };
    }
    updatePatient(tenantId, patientId, body) {
        return { patient: this.appService.updatePatient(tenantId, patientId, body), message: 'Patient updated' };
    }
    deletePatient(tenantId, patientId) {
        return this.appService.deletePatient(tenantId, patientId);
    }
    updateAppointmentStatus(tenantId, appointmentId, body) {
        const allowedStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
        if (!allowedStatuses.includes(body.status)) {
            throw new common_1.BadRequestException(`Appointment status must be one of: ${allowedStatuses.join(', ')}`);
        }
        const result = this.appService.updateBookingStatus(tenantId, appointmentId, body.status);
        if ('error' in result)
            throw new common_1.NotFoundException(result.error);
        return { appointment: result, message: 'Appointment status updated' };
    }
    async triggerOrchestration(body) {
        const tenantId = String(body?.tenant_id ?? '');
        if (!tenantId)
            throw new common_1.BadRequestException('tenant_id is required');
        const policyError = this.appService.validateAgentBooking(tenantId, String(body?.appointment_time ?? ''));
        if (policyError)
            throw new common_1.BadRequestException(policyError);
        const configuredAgentUrl = (process.env.PYTHON_AGENT_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
        const baseUrl = /^https?:\/\//i.test(configuredAgentUrl) ? configuredAgentUrl : `http://${configuredAgentUrl}`;
        try {
            const fetch = globalThis.fetch;
            const response = await fetch(`${baseUrl}/api/agent/phone-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_name: body.patient_name,
                    phone_number: body.phone_number,
                    doctor_name: body.doctor_name,
                    appointment_date: body.appointment_date,
                    appointment_time: body.appointment_time,
                    reason: body.reason,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.appointment) {
                throw new common_1.BadGatewayException(data.detail || 'Python agent could not complete the booking');
            }
            const appointment = await this.appService.addBooking(tenantId, data.appointment);
            if (!appointment)
                throw new common_1.BadRequestException('Tenant not found');
            if ('error' in appointment)
                throw new common_1.BadRequestException(appointment.error);
            return { source: 'python_agent', data, appointment };
        }
        catch (error) {
            if (error instanceof common_1.BadGatewayException || error instanceof common_1.BadRequestException)
                throw error;
            throw new common_1.BadGatewayException('Python agent service is unavailable');
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Post)('api/auth/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('api/tenant/resolve/:domain'),
    __param(0, (0, common_1.Param)('domain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "resolveTenant", null);
__decorate([
    (0, common_1.Get)('api/public/plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getPublicPlans", null);
__decorate([
    (0, common_1.Post)('api/public/clinic-interest'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ClinicInterestDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "createClinicInterest", null);
__decorate([
    (0, common_1.Get)('api/super-admin/clinic-interests'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "listClinicInterests", null);
__decorate([
    (0, common_1.Get)('api/tenants'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "listTenants", null);
__decorate([
    (0, common_1.Get)('api/plans'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Post)('api/plans'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PlanDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "createPlan", null);
__decorate([
    (0, common_1.Put)('api/plans/:planId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('planId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PlanDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Delete)('api/plans/:planId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('planId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Get)('api/super-admin/dashboard'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getSuperAdminDashboard", null);
__decorate([
    (0, common_1.Post)('api/tenants/onboard'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TenantOnboardDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "onboardTenant", null);
__decorate([
    (0, common_1.Put)('api/tenants/:tenantId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TenantUpdateDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateTenant", null);
__decorate([
    (0, common_1.Put)('api/tenants/:tenantId/password'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TenantPasswordDto]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "setTenantAdminPassword", null);
__decorate([
    (0, common_1.Put)('api/tenants/:tenantId/telephony'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateTenantTelephony", null);
__decorate([
    (0, common_1.Post)('api/tenants/:tenantId/voice-deployment'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "activateVoiceDeployment", null);
__decorate([
    (0, common_1.Post)('api/tenants/:tenantId/exotel/verify'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "verifyExotelConnection", null);
__decorate([
    (0, common_1.Post)('api/exotel/voicebot/webhooks/:tenantId'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "exotelVoicebotWebhook", null);
__decorate([
    (0, common_1.Get)('api/tenants/:tenantId/exotel/calls'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('tenant_admin'),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "listExotelCalls", null);
__decorate([
    (0, common_1.Post)('api/tenants/:tenantId/exotel/calls/sync'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('tenant_admin'),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "syncExotelCalls", null);
__decorate([
    (0, common_1.Get)('api/tenants/:tenantId/exotel/calls/:callSid/recording'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('tenant_admin'),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('callSid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getExotelCallRecording", null);
__decorate([
    (0, common_1.Post)('api/tenants/:tenantId/exotel/calls/:callSid/book'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('tenant_admin'),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('callSid')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "bookExotelCall", null);
__decorate([
    (0, common_1.Post)('api/voice/tools/:tenantId'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Headers)('x-voice-tool-secret')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-tenant-id')),
    __param(5, (0, common_1.Headers)('content-type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "voiceTool", null);
__decorate([
    (0, common_1.Patch)('api/tenants/:tenantId/subscription'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SubscriptionUpdateDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateSubscription", null);
__decorate([
    (0, common_1.Delete)('api/tenants/:tenantId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.Roles)('super_admin'),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "deleteTenant", null);
__decorate([
    (0, common_1.Get)('api/tenant/:tenantId/dashboard'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Put)('api/tenant/:tenantId/voice-agent'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateVoiceAgent", null);
__decorate([
    (0, common_1.Post)('api/tenant/:tenantId/voice-agent/preview'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "previewVoiceAgent", null);
__decorate([
    (0, common_1.Get)('api/tenant/:tenantId/patients'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getPatients", null);
__decorate([
    (0, common_1.Post)('api/tenant/:tenantId/patients'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PatientDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "addPatient", null);
__decorate([
    (0, common_1.Put)('api/tenant/:tenantId/patients/:patientId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('patientId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, PatientDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updatePatient", null);
__decorate([
    (0, common_1.Delete)('api/tenant/:tenantId/patients/:patientId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('patientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "deletePatient", null);
__decorate([
    (0, common_1.Patch)('api/tenant/:tenantId/appointments/:appointmentId'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Param)('appointmentId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, AppointmentStatusDto]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateAppointmentStatus", null);
__decorate([
    (0, common_1.Post)('api/agent/booking'),
    (0, common_1.UseGuards)(access_guard_1.AccessGuard),
    (0, access_decorator_1.TenantScoped)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "triggerOrchestration", null);
exports.AppController = AppController = AppController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService, jwt_1.JwtService])
], AppController);
//# sourceMappingURL=app.controller.js.map