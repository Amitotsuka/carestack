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
exports.PublicPortalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_enquiry_dto_1 = require("./dto/create-enquiry.dto");
const public_booking_dto_1 = require("./dto/public-booking.dto");
const update_enquiry_dto_1 = require("./dto/update-enquiry.dto");
const public_portal_service_1 = require("./public-portal.service");
let PublicPortalController = class PublicPortalController {
    constructor(service) {
        this.service = service;
    }
    landing(slug) { return this.service.landing(slug); }
    enquiry(slug, dto) { return this.service.createEnquiry(slug, dto); }
    slots(slug, doctorId, from, to) { return this.service.slots(slug, doctorId, from, to); }
    requestBookingOtp(slug, dto, idempotencyKey) { return this.service.requestBookingOtp(slug, dto, idempotencyKey); }
    confirmBooking(slug, requestId, dto) { return this.service.confirmBooking(slug, requestId, dto); }
    enquiries(req) { return this.service.enquiries(req.user.organizationId); }
    updateEnquiry(req, id, dto) { return this.service.updateEnquiry(req.user.organizationId, id, dto.status); }
};
exports.PublicPortalController = PublicPortalController;
__decorate([
    (0, common_1.Get)('public/hospitals/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "landing", null);
__decorate([
    (0, common_1.Post)('public/hospitals/:slug/enquiries'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_enquiry_dto_1.CreateEnquiryDto]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "enquiry", null);
__decorate([
    (0, common_1.Get)('public/hospitals/:slug/doctors/:doctorId/slots'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Param)('doctorId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "slots", null);
__decorate([
    (0, common_1.Post)('public/hospitals/:slug/bookings/otp/request'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, public_booking_dto_1.RequestPublicBookingOtpDto, String]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "requestBookingOtp", null);
__decorate([
    (0, common_1.Post)('public/hospitals/:slug/bookings/:requestId/confirm'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, public_booking_dto_1.ConfirmPublicBookingDto]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "confirmBooking", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, common_1.Get)('enquiries'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "enquiries", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, common_1.Patch)('enquiries/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object, String, update_enquiry_dto_1.UpdateEnquiryDto]),
    __metadata("design:returntype", void 0)
], PublicPortalController.prototype, "updateEnquiry", null);
exports.PublicPortalController = PublicPortalController = __decorate([
    (0, swagger_1.ApiTags)('public hospital'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [public_portal_service_1.PublicPortalService])
], PublicPortalController);
