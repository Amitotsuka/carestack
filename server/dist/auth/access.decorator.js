"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantScoped = exports.Roles = exports.TENANT_SCOPE_KEY = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'access:roles';
exports.TENANT_SCOPE_KEY = 'access:tenant-scope';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
const TenantScoped = () => (0, common_1.SetMetadata)(exports.TENANT_SCOPE_KEY, true);
exports.TenantScoped = TenantScoped;
//# sourceMappingURL=access.decorator.js.map