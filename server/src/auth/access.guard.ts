import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY, PERMISSIONS_KEY, ROLES_KEY, TENANT_SCOPE_KEY } from './access.decorator';
import { AppService } from '../app.service';

type SessionClaims = {
  sub: string;
  role: string;
  tenant_id: string | null;
  email: string;
  permissions?: string[];
};

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly appService: AppService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [scheme, token] = String(request.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Bearer access token required');

    try {
      request.user = await this.jwtService.verifyAsync<SessionClaims>(token);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const clinicStaff = request.user.role !== 'tenant_admin' && request.user.role !== 'super_admin' && Boolean(request.user.tenant_id);
    if (clinicStaff) {
      const currentAccess = this.appService.getStaffAccess(request.user.tenant_id || '', request.user.sub);
      if (!currentAccess) throw new UnauthorizedException('This staff account is no longer active');
      request.user.role = currentAccess.role;
      request.user.permissions = currentAccess.permissions;
    }

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(request.user.role) && !(clinicStaff && roles.includes('receptionist'))) {
      throw new ForbiddenException('This role cannot access the requested resource');
    }
    if ((request.user.role === 'tenant_admin' || clinicStaff) && !this.appService.isTenantActive(request.user.tenant_id)) {
      throw new ForbiddenException('This clinic subscription is paused or unavailable');
    }

    const tenantScoped = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (tenantScoped) {
      const requestedTenantId = request.params.tenantId || request.body?.tenant_id;
      if (!(request.user.role === 'tenant_admin' || clinicStaff) || !request.user.tenant_id || requestedTenantId !== request.user.tenant_id) {
        throw new ForbiddenException('Tenant access is restricted to the authenticated clinic');
      }
    }

    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [context.getHandler(), context.getClass()]);
    if (requiredFeatures?.length && request.user.role !== 'super_admin') {
      const tenantId = request.user.tenant_id;
      if (!tenantId || !requiredFeatures.some((feature) => this.appService.tenantHasFeature(tenantId, feature))) {
        throw new ForbiddenException('This feature is not included in the clinic subscription plan');
      }
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (requiredPermissions?.length && request.user.role !== 'tenant_admin') {
      const granted = new Set(request.user.permissions || []);
      if (!requiredPermissions.some((permission) => granted.has(permission))) {
        throw new ForbiddenException('Your clinic account does not have permission for this action');
      }
    }

    return true;
  }
}
