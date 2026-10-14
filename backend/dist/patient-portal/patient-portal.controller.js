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
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientPortalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const patient_login_dto_1 = require("./dto/patient-login.dto");
const book_patient_appointment_dto_1 = require("./dto/book-patient-appointment.dto");
const patient_booking_recommendation_dto_1 = require("./dto/patient-booking-recommendation.dto");
const patient_portal_service_1 = require("./patient-portal.service");
let PatientPortalController = class PatientPortalController {
    constructor(patientPortalService) {
        this.patientPortalService = patientPortalService;
    }
    login(body) {
        return this.patientPortalService.login(body);
    }
    overview(req) {
        return this.patientPortalService.getOverview(req.user.patientId ?? req.user.userId, req.user.organizationId);
    }
    clinics(req) {
        return this.patientPortalService.getDoctors(req.user.patientId ?? req.user.userId, req.user.organizationId);
    }
    doctors(id, req) {
        return this.patientPortalService.getClinicDoctors(req.user.patientId ?? req.user.userId, req.user.organizationId, id);
    }
    bookingRecommendation(body, req) {
        return this.patientPortalService.recommendBooking(req.user.patientId ?? req.user.userId, req.user.organizationId, body.hospitalId, body.reason);
    }
    bookAppointment(body, req) {
        return this.patientPortalService.bookAppointment(req.user.patientId ?? req.user.userId, req.user.organizationId, body);
    }
    cancelAppointment(id, req) {
        return this.patientPortalService.cancelAppointment(req.user.patientId ?? req.user.userId, req.user.organizationId, id);
    }
    queueStatus(id, req) {
        return this.patientPortalService.getQueueStatus(req.user.patientId ?? req.user.userId, req.user.organizationId, id);
    }
};
exports.PatientPortalController = PatientPortalController;
__decorate([
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiBody)({ type: patient_login_dto_1.PatientLoginDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [patient_login_dto_1.PatientLoginDto]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('overview'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('clinics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "clinics", null);
__decorate([
    (0, common_1.Get)('clinics/:id/doctors'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "doctors", null);
__decorate([
    (0, common_1.Post)('ai/booking-recommendation'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiBody)({ type: patient_booking_recommendation_dto_1.PatientBookingRecommendationDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [patient_booking_recommendation_dto_1.PatientBookingRecommendationDto, typeof (_d = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "bookingRecommendation", null);
__decorate([
    (0, common_1.Post)('appointments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiBody)({ type: book_patient_appointment_dto_1.BookPatientAppointmentDto }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [book_patient_appointment_dto_1.BookPatientAppointmentDto, typeof (_e = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "bookAppointment", null);
__decorate([
    (0, common_1.Patch)('appointments/:id/cancel'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_f = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "cancelAppointment", null);
__decorate([
    (0, common_1.Get)('appointments/:id/queue-status'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('PATIENT'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_g = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], PatientPortalController.prototype, "queueStatus", null);
exports.PatientPortalController = PatientPortalController = __decorate([
    (0, swagger_1.ApiTags)('patient portal'),
    (0, common_1.Controller)('patient-portal'),
    __metadata("design:paramtypes", [patient_portal_service_1.PatientPortalService])
], PatientPortalController);
