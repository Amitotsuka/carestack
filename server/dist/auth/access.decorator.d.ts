export declare const ROLES_KEY = "access:roles";
export declare const TENANT_SCOPE_KEY = "access:tenant-scope";
export declare const Roles: (...roles: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const TenantScoped: () => import("@nestjs/common").CustomDecorator<string>;
