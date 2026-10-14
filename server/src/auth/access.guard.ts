import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, TENANT_SCOPE_KEY } from './access.decorator';
import { AppService } from '../app.service';

type SessionClaims = {
  sub: string;
  role: string;
  tenant_id: string | null;
  email: string;
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

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(request.user.role)) {
      throw new ForbiddenException('This role cannot access the requested resource');
    }
    if (request.user.role === 'tenant_admin' && !this.appService.isTenantActive(request.user.tenant_id)) {
      throw new ForbiddenException('This clinic subscription is paused or unavailable');
    }

    const tenantScoped = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (tenantScoped) {
      const requestedTenantId = request.params.tenantId || request.body?.tenant_id;
      if (request.user.role !== 'tenant_admin' || !request.user.tenant_id || requestedTenantId !== request.user.tenant_id) {
        throw new ForbiddenException('Tenant access is restricted to the authenticated clinic');
      }
    }

    return true;
  }
}