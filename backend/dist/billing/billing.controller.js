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
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const billing_service_1 = require("./billing.service");
const create_billing_dto_1 = require("./dto/create-billing.dto");
const update_billing_dto_1 = require("./dto/update-billing.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
let BillingController = class BillingController {
    constructor(billingService) {
        this.billingService = billingService;
    }
    async findAll(req) {
        return this.billingService.findAll(req.user.organizationId);
    }
    async create(body, req) {
        return this.billingService.create(body, req.user.organizationId);
    }
    async findOne(id, req) {
        return this.billingService.findOne(id, req.user.organizationId);
    }
    async update(id, body, req) {
        return this.billingService.update(id, body, req.user.organizationId);
    }
    async remove(id, req) {
        return this.billingService.remove(id, req.user.organizationId);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_billing_dto_1.CreateBillingDto, typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_billing_dto_1.UpdateBillingDto, typeof (_d = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "remove", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('billing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('billing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
