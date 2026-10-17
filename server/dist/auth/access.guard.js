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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const access_decorator_1 = require("./access.decorator");
const app_service_1 = require("../app.service");
let AccessGuard = class AccessGuard {
    constructor(jwtService, reflector, appService) {
        this.jwtService = jwtService;
        this.reflector = reflector;
        this.appService = appService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const [scheme, token] = String(request.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token)
            throw new common_1.UnauthorizedException('Bearer access token required');
        try {
            request.user = await this.jwtService.verifyAsync(token);
        }
        catch {
            throw new common_1.UnauthorizedException('Access token is invalid or expired');
        }
        if (request.user.role === 'receptionist') {
            const currentAccess = this.appService.getStaffAccess(request.user.tenant_id || '', request.user.sub);
            if (!currentAccess)
                throw new common_1.UnauthorizedException('This staff account is no longer active');
            request.user.permissions = currentAccess.permissions;
        }
        const roles = this.reflector.getAllAndOverride(access_decorator_1.ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (roles?.length && !roles.includes(request.user.role)) {
            throw new common_1.ForbiddenException('This role cannot access the requested resource');
        }
        if (['tenant_admin', 'receptionist'].includes(request.user.role) && !this.appService.isTenantActive(request.user.tenant_id)) {
            throw new common_1.ForbiddenException('This clinic subscription is paused or unavailable');
        }
        const tenantScoped = this.reflector.getAllAndOverride(access_decorator_1.TENANT_SCOPE_KEY, [context.getHandler(), context.getClass()]);
        if (tenantScoped) {
            const requestedTenantId = request.params.tenantId || request.body?.tenant_id;
            if (!['tenant_admin', 'receptionist'].includes(request.user.role) || !request.user.tenant_id || requestedTenantId !== request.user.tenant_id) {
                throw new common_1.ForbiddenException('Tenant access is restricted to the authenticated clinic');
            }
        }
        const requiredPermissions = this.reflector.getAllAndOverride(access_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (requiredPermissions?.length && request.user.role !== 'tenant_admin') {
            const granted = new Set(request.user.permissions || []);
            if (!requiredPermissions.some((permission) => granted.has(permission))) {
                throw new common_1.ForbiddenException('Your clinic account does not have permission for this action');
            }
        }
        return true;
    }
};
exports.AccessGuard = AccessGuard;
exports.AccessGuard = AccessGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        core_1.Reflector,
        app_service_1.AppService])
], AccessGuard);
//# sourceMappingURL=access.guard.js.map