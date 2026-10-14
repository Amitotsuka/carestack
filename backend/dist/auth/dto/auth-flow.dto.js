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
exports.RejectHospitalRegistrationDto = exports.VerifyMobileOtpDto = exports.RequestMobileOtpDto = exports.RegisterHospitalDto = exports.AcceptInviteDto = exports.InviteUserDto = exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.TokenDto = exports.RefreshTokenDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class RefreshTokenDto {
}
exports.RefreshTokenDto = RefreshTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
class TokenDto {
}
exports.TokenDto = TokenDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TokenDto.prototype, "token", void 0);
class ForgotPasswordDto {
}
exports.ForgotPasswordDto = ForgotPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ForgotPasswordDto.prototype, "email", void 0);
class ResetPasswordDto extends TokenDto {
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 8 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "password", void 0);
class InviteUserDto {
}
exports.InviteUserDto = InviteUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], InviteUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Role }),
    (0, class_validator_1.IsEnum)(client_1.Role),
    __metadata("design:type", typeof (_a = typeof client_1.Role !== "undefined" && client_1.Role) === "function" ? _a : Object)
], InviteUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InviteUserDto.prototype, "hospitalId", void 0);
class AcceptInviteDto extends TokenDto {
}
exports.AcceptInviteDto = AcceptInviteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 8 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], AcceptInviteDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AcceptInviteDto.prototype, "displayName", void 0);
class RegisterHospitalDto {
}
exports.RegisterHospitalDto = RegisterHospitalDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "organizationName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "hospitalName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "hospitalAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "hospitalPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "adminEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "adminName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+919876543210' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+?[1-9]\d{7,14}$/, { message: 'adminPhone must be a valid international phone number' }),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "adminPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 8 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], RegisterHospitalDto.prototype, "adminPassword", void 0);
class RequestMobileOtpDto {
}
exports.RequestMobileOtpDto = RequestMobileOtpDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RequestMobileOtpDto.prototype, "email", void 0);
class VerifyMobileOtpDto extends RequestMobileOtpDto {
}
exports.VerifyMobileOtpDto = VerifyMobileOtpDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 6, maxLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/),
    __metadata("design:type", String)
], VerifyMobileOtpDto.prototype, "otp", void 0);
class RejectHospitalRegistrationDto {
}
exports.RejectHospitalRegistrationDto = RejectHospitalRegistrationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RejectHospitalRegistrationDto.prototype, "reason", void 0);
