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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceCallBookingDto = exports.AiBookingDto = exports.RescheduleDto = exports.WaitlistDto = exports.AvailabilityDto = void 0;
const client_1 = require("@prisma/client");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class AvailabilityDto {
}
exports.AvailabilityDto = AvailabilityDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], AvailabilityDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '09:00' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/),
    __metadata("design:type", String)
], AvailabilityDto.prototype, "startTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '17:00' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/),
    __metadata("design:type", String)
], AvailabilityDto.prototype, "endTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5),
    (0, class_validator_1.Max)(120),
    __metadata("design:type", Number)
], AvailabilityDto.prototype, "slotMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AvailabilityDto.prototype, "isActive", void 0);
class WaitlistDto {
}
exports.WaitlistDto = WaitlistDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], WaitlistDto.prototype, "patientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], WaitlistDto.prototype, "hospitalId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], WaitlistDto.prototype, "doctorId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], WaitlistDto.prototype, "preferredAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], WaitlistDto.prototype, "reason", void 0);
class RescheduleDto {
}
exports.RescheduleDto = RescheduleDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RescheduleDto.prototype, "scheduledAt", void 0);
class AiBookingDto {
}
exports.AiBookingDto = AiBookingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AiBookingDto.prototype, "patientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AiBookingDto.prototype, "hospitalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], AiBookingDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.AppointmentBookingChannel }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AppointmentBookingChannel),
    __metadata("design:type", typeof (_a = typeof client_1.AppointmentBookingChannel !== "undefined" && client_1.AppointmentBookingChannel) === "function" ? _a : Object)
], AiBookingDto.prototype, "channel", void 0);
/** Payload accepted only from the configured telephony provider webhook. */
class VoiceCallBookingDto {
}
exports.VoiceCallBookingDto = VoiceCallBookingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Tenant receiving the incoming call' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "organizationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Clinic to book at' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "hospitalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+919876543210', description: 'Verified ANI/caller number supplied by the telephony provider' }),
    (0, class_validator_1.Matches)(/^\+?[1-9]\d{7,14}$/),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "callerPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Follow-up for skin rash' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-08-01T10:00:00.000Z', description: 'Earliest requested time. The next available slot is selected when omitted.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "requestedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'call-8b5b3c', description: 'Unique provider call identifier. Retries with this value return the original booking.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], VoiceCallBookingDto.prototype, "providerCallId", void 0);
