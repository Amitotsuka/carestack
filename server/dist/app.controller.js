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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const class_validator_1 = require("class-validator");
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
let AppController = class AppController {
    constructor(appService, jwtService) {
        this.appService = appService;
        this.jwtService = jwtService;
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
    updateTenantTelephony(tenantId, body) {
        const config = this.appService.updateTenantTelephony(tenantId, body || {});
        if (config === null)
            throw new common_1.NotFoundException('Clinic not found');
        if (!config)
            throw new common_1.BadRequestException('Use a unique international format phone number and complete the Sarvam deployment settings.');
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
    async voiceTool(tenantId, suppliedSecret, body) {
        if (!this.appService.validateVoiceToolSecret(tenantId, String(suppliedSecret || ''))) {
            throw new common_1.UnauthorizedException('Voice tool authentication failed');
        }
        const result = this.appService.voiceTool(tenantId, body);
        if ('error' in result && result.error === 'Clinic not found.')
            throw new common_1.NotFoundException('Clinic not found');
        return result;
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
            const appointment = this.appService.addBooking(tenantId, data.appointment);
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
    (0, common_1.Post)('api/voice/tools/:tenantId'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Headers)('x-voice-tool-secret')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
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
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService, jwt_1.JwtService])
], AppController);
//# sourceMappingURL=app.controller.js.map