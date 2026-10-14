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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardOrganizationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class OnboardOrganizationDto {
    constructor() {
        this.subscriptionPlan = client_1.SubscriptionPlan.STARTER;
        this.subscriptionStatus = client_1.SubscriptionStatus.TRIAL;
        this.monthlyPrice = 0;
        this.maxHospitals = 1;
    }
}
exports.OnboardOrganizationDto = OnboardOrganizationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 160 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "organizationName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 80 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "slug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 160 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "hospitalName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 300 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'email' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "adminEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "adminName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 8 }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "adminPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SubscriptionPlan, default: client_1.SubscriptionPlan.STARTER }),
    (0, class_validator_1.IsEnum)(client_1.SubscriptionPlan),
    __metadata("design:type", typeof (_a = typeof client_1.SubscriptionPlan !== "undefined" && client_1.SubscriptionPlan) === "function" ? _a : Object)
], OnboardOrganizationDto.prototype, "subscriptionPlan", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SubscriptionStatus, default: client_1.SubscriptionStatus.TRIAL }),
    (0, class_validator_1.IsEnum)(client_1.SubscriptionStatus),
    __metadata("design:type", typeof (_b = typeof client_1.SubscriptionStatus !== "undefined" && client_1.SubscriptionStatus) === "function" ? _b : Object)
], OnboardOrganizationDto.prototype, "subscriptionStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 9999 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OnboardOrganizationDto.prototype, "monthlyPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], OnboardOrganizationDto.prototype, "maxHospitals", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-07-03T00:00:00.000Z', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "subscriptionStartsAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2027-07-03T00:00:00.000Z', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OnboardOrganizationDto.prototype, "subscriptionEndsAt", void 0);
