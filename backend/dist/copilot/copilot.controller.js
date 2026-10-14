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
exports.CopilotController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const create_appointment_dto_1 = require("../appointment/dto/create-appointment.dto");
const copilot_message_dto_1 = require("./dto/copilot-message.dto");
const copilot_service_1 = require("./copilot.service");
let CopilotController = class CopilotController {
    constructor(copilot) {
        this.copilot = copilot;
    }
    message(body, req) {
        return this.copilot.message(body.message, req.user.organizationId, req.user.userId);
    }
    bookAppointment(body, req) {
        return this.copilot.bookAppointment(body, req.user.organizationId, req.user.userId);
    }
};
exports.CopilotController = CopilotController;
__decorate([
    (0, common_1.Post)('messages'),
    (0, swagger_1.ApiBody)({ type: copilot_message_dto_1.CopilotMessageDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [copilot_message_dto_1.CopilotMessageDto, typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], CopilotController.prototype, "message", null);
__decorate([
    (0, common_1.Post)('book-appointment'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER', 'RECEPTION', 'DOCTOR'),
    (0, swagger_1.ApiBody)({ type: create_appointment_dto_1.CreateAppointmentDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_appointment_dto_1.CreateAppointmentDto, typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], CopilotController.prototype, "bookAppointment", null);
exports.CopilotController = CopilotController = __decorate([
    (0, swagger_1.ApiTags)('copilot'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('copilot'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [copilot_service_1.CopilotService])
], CopilotController);
