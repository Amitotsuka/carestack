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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmPublicBookingDto = exports.RequestPublicBookingOtpDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class RequestPublicBookingOtpDto {
}
exports.RequestPublicBookingOtpDto = RequestPublicBookingOtpDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "doctorId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+919876543210' }),
    (0, class_validator_1.Matches)(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be a valid international number' }),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'date' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "dob", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], RequestPublicBookingOtpDto.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Explicit consent to use contact details for this appointment.' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.Equals)(true, { message: 'Consent is required to request an appointment' }),
    __metadata("design:type", Boolean)
], RequestPublicBookingOtpDto.prototype, "consentToContact", void 0);
class ConfirmPublicBookingDto {
}
exports.ConfirmPublicBookingDto = ConfirmPublicBookingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 6, maxLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/),
    __metadata("design:type", String)
], ConfirmPublicBookingDto.prototype, "otp", void 0);
