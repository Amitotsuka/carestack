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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const swagger_1 = require("@nestjs/swagger");
const appointment_service_1 = require("./appointment.service");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const update_appointment_dto_1 = require("./dto/update-appointment.dto");
const appointment_platform_dto_1 = require("./dto/appointment-platform.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
let AppointmentController = class AppointmentController {
    constructor(appointmentService) {
        this.appointmentService = appointmentService;
    }
    async findAll(req) {
        return this.appointmentService.findAll(req.user.organizationId);
    }
    async create(body, req) {
        return this.appointmentService.create(body, req.user.organizationId);
    }
    async findOne(id, req) {
        return this.appointmentService.findOne(id, req.user.organizationId);
    }
    async update(id, body, req) {
        return this.appointmentService.update(id, body, req.user.organizationId);
    }
    async remove(id, req) {
        return this.appointmentService.remove(id, req.user.organizationId);
    }
    calendar(req, from, to) { return this.appointmentService.calendar(req.user.organizationId, new Date(from), new Date(to)); }
    availability(doctorId, req) { return this.appointmentService.availability(doctorId, req.user.organizationId); }
    setAvailability(doctorId, body, req) { return this.appointmentService.setAvailability(doctorId, req.user.organizationId, body); }
    getWaitlist(req) { return this.appointmentService.getWaitlist(req.user.organizationId); }
    waitlist(body, req) { return this.appointmentService.waitlist(req.user.organizationId, body); }
    reschedule(id, body, req) { return this.appointmentService.reschedule(id, req.user.organizationId, body); }
    cancel(id, req) { return this.appointmentService.cancel(id, req.user.organizationId); }
    aiBook(body, req) { return this.appointmentService.aiBook(req.user.organizationId, body); }
    voiceBook(body, req) { return this.appointmentService.aiBook(req.user.organizationId, { ...body, channel: client_1.AppointmentBookingChannel.VOICE }); }
    whatsappBook(body, req) { return this.appointmentService.aiBook(req.user.organizationId, { ...body, channel: client_1.AppointmentBookingChannel.WHATSAPP }); }
    analytics(req) { return this.appointmentService.analytics(req.user.organizationId); }
    noShowPrediction(id, req) { return this.appointmentService.noShowPrediction(id, req.user.organizationId); }
    waitTimePrediction(id, req) { return this.appointmentService.waitTimePrediction(id, req.user.organizationId); }
};
exports.AppointmentController = AppointmentController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], AppointmentController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'RECEPTION', 'DOCTOR'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_appointment_dto_1.CreateAppointmentDto, typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], AppointmentController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('item/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], AppointmentController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'RECEPTION', 'DOCTOR'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_appointment_dto_1.UpdateAppointmentDto, typeof (_d = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], AppointmentController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], AppointmentController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('calendar/range'),
    (0, swagger_1.ApiQuery)({ name: 'from' }),
    (0, swagger_1.ApiQuery)({ name: 'to' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _f : Object, String, String]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)('doctors/:doctorId/availability'),
    __param(0, (0, common_1.Param)('doctorId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_g = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "availability", null);
__decorate([
    (0, common_1.Post)('doctors/:doctorId/availability'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'DOCTOR'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.AvailabilityDto }),
    __param(0, (0, common_1.Param)('doctorId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, appointment_platform_dto_1.AvailabilityDto, typeof (_h = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _h : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "setAvailability", null);
__decorate([
    (0, common_1.Get)('waitlist'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _j : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "getWaitlist", null);
__decorate([
    (0, common_1.Post)('waitlist'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.WaitlistDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [appointment_platform_dto_1.WaitlistDto, typeof (_k = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _k : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "waitlist", null);
__decorate([
    (0, common_1.Patch)(':id/reschedule'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.RescheduleDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, appointment_platform_dto_1.RescheduleDto, typeof (_l = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "reschedule", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_m = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _m : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('ai/book'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.AiBookingDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [appointment_platform_dto_1.AiBookingDto, typeof (_o = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _o : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "aiBook", null);
__decorate([
    (0, common_1.Post)('ai/voice-book'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.AiBookingDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [appointment_platform_dto_1.AiBookingDto, typeof (_p = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _p : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "voiceBook", null);
__decorate([
    (0, common_1.Post)('ai/whatsapp-book'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION'),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.AiBookingDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [appointment_platform_dto_1.AiBookingDto, typeof (_q = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _q : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "whatsappBook", null);
__decorate([
    (0, common_1.Get)('ai/analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_r = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _r : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)(':id/ai/no-show'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_s = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _s : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "noShowPrediction", null);
__decorate([
    (0, common_1.Get)(':id/ai/wait-time'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_t = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _t : Object]),
    __metadata("design:returntype", void 0)
], AppointmentController.prototype, "waitTimePrediction", null);
exports.AppointmentController = AppointmentController = __decorate([
    (0, swagger_1.ApiTags)('appointments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('appointments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [appointment_service_1.AppointmentService])
], AppointmentController);
