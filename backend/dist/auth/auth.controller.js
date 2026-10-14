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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_service_1 = require("./auth.service");
const local_auth_guard_1 = require("./local-auth.guard");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const auth_flow_dto_1 = require("./dto/auth-flow.dto");
const userId = (request) => request.user.userId ?? request.user.id;
const meta = (request) => ({ ipAddress: request.ip, userAgent: request.get('user-agent'), deviceName: request.get('x-device-name') });
const actor = (request) => ({ userId: userId(request), role: request.user.role });
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    login(req) { return this.authService.login({ id: userId(req), organizationId: req.user.organizationId, hospitalId: req.user.hospitalId ?? null, email: req.user.email, role: req.user.role, displayName: req.user.displayName ?? '' }, meta(req)); }
    register(body) { return this.authService.register(body); }
    registerHospital(body) { return this.authService.registerHospital(body); }
    refresh(body, req) { return this.authService.refresh(body.refreshToken, meta(req)); }
    logout(req, body) { return this.authService.logout(userId(req), body?.refreshToken, meta(req)); }
    forgotPassword(body) { return this.authService.forgotPassword(body.email); }
    resetPassword(body) { return this.authService.resetPassword(body.token, body.password); }
    verifyEmail(body) { return this.authService.verifyEmail(body.token); }
    requestMobileOtp(body) { return this.authService.requestMobileOtp(body.email); }
    verifyMobileOtp(body) { return this.authService.verifyMobileOtp(body.email, body.otp); }
    hospitalRegistrations(req, status) { return this.authService.hospitalRegistrations(actor(req), status); }
    platformAuditLogs(req) { return this.authService.platformAuditLogs(actor(req)); }
    approveHospitalRegistration(req, organizationId) { return this.authService.approveHospitalRegistration(actor(req), organizationId); }
    rejectHospitalRegistration(req, organizationId, body) { return this.authService.rejectHospitalRegistration(actor(req), organizationId, body.reason); }
    sessions(req) { return this.authService.sessions(userId(req)); }
    revokeSession(req, id) { return this.authService.revokeSession(userId(req), id); }
    invite(req, body) { return this.authService.invite({ userId: userId(req), organizationId: req.user.organizationId, role: req.user.role, hospitalId: req.user.hospitalId }, body); }
    acceptInvite(body) { return this.authService.acceptInvite(body); }
    auditLogs(req) { return this.authService.auditLogs(req.user.organizationId); }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.UseGuards)(local_auth_guard_1.LocalAuthGuard),
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a device-bound JWT session' }),
    (0, swagger_1.ApiBody)({ type: login_dto_1.LoginDto }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a user or, with organizationName, a hospital tenant' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('hospital-registration'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a hospital tenant and its administrator' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.RegisterHospitalDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "registerHospital", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.RefreshTokenDto, typeof (_a = typeof express_1.Request !== "undefined" && express_1.Request) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_flow_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.TokenDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('mobile-otp/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.RequestMobileOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestMobileOtp", null);
__decorate([
    (0, common_1.Post)('mobile-otp/verify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.VerifyMobileOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyMobileOtp", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('hospital-registrations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof client_1.TenantApprovalStatus !== "undefined" && client_1.TenantApprovalStatus) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "hospitalRegistrations", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('platform-audit-logs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "platformAuditLogs", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('hospital-registrations/:organizationId/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "approveHospitalRegistration", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('hospital-registrations/:organizationId/reject'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('organizationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, auth_flow_dto_1.RejectHospitalRegistrationDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "rejectHospitalRegistration", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sessions", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)('sessions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "revokeSession", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('invites'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_flow_dto_1.InviteUserDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invites/accept'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_flow_dto_1.AcceptInviteDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "acceptInvite", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "auditLogs", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
