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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceBookingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const crypto_1 = require("crypto");
const appointment_service_1 = require("./appointment.service");
const appointment_platform_dto_1 = require("./dto/appointment-platform.dto");
let VoiceBookingController = class VoiceBookingController {
    constructor(appointmentService) {
        this.appointmentService = appointmentService;
    }
    async incomingCall(body, timestamp, signature, request) {
        if (!this.isTrustedProvider(timestamp, signature, request?.rawBody)) {
            throw new common_1.UnauthorizedException('Untrusted voice booking provider');
        }
        return this.appointmentService.bookVerifiedVoiceCall(body);
    }
    isTrustedProvider(timestamp, signature, rawBody) {
        const configuredSecret = process.env.VOICE_BOOKING_WEBHOOK_SECRET;
        const seconds = Number(timestamp);
        if (!configuredSecret || !timestamp || !signature || !rawBody || !Number.isInteger(seconds) || Math.abs(Date.now() - seconds * 1000) > 5 * 60_000)
            return false;
        const expected = (0, crypto_1.createHmac)('sha256', configuredSecret).update(`${timestamp}.`).update(rawBody).digest('hex');
        const expectedBuffer = Buffer.from(expected, 'hex');
        const receivedBuffer = Buffer.from(signature, 'hex');
        return expectedBuffer.length === receivedBuffer.length && (0, crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer);
    }
};
exports.VoiceBookingController = VoiceBookingController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    (0, swagger_1.ApiHeader)({ name: 'x-mediflow-timestamp', required: true, description: 'Unix timestamp in seconds' }),
    (0, swagger_1.ApiHeader)({ name: 'x-mediflow-signature', required: true, description: 'HMAC-SHA256 of `${timestamp}.${rawBody}` using VOICE_BOOKING_WEBHOOK_SECRET' }),
    (0, swagger_1.ApiBody)({ type: appointment_platform_dto_1.VoiceCallBookingDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-mediflow-timestamp')),
    __param(2, (0, common_1.Headers)('x-mediflow-signature')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [appointment_platform_dto_1.VoiceCallBookingDto, String, String, Object]),
    __metadata("design:returntype", Promise)
], VoiceBookingController.prototype, "incomingCall", null);
exports.VoiceBookingController = VoiceBookingController = __decorate([
    (0, swagger_1.ApiTags)('voice bookings'),
    (0, common_1.Controller)('voice-bookings'),
    __metadata("design:paramtypes", [appointment_service_1.AppointmentService])
], VoiceBookingController);
