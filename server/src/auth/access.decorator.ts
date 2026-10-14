import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'access:roles';
export const TENANT_SCOPE_KEY = 'access:tenant-scope';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const TenantScoped = () => SetMetadata(TENANT_SCOPE_KEY, true);