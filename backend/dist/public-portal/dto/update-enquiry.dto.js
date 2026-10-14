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
exports.UpdateEnquiryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class UpdateEnquiryDto {
}
exports.UpdateEnquiryDto = UpdateEnquiryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.EnquiryStatus }),
    (0, class_validator_1.IsEnum)(client_1.EnquiryStatus),
    __metadata("design:type", typeof (_a = typeof client_1.EnquiryStatus !== "undefined" && client_1.EnquiryStatus) === "function" ? _a : Object)
], UpdateEnquiryDto.prototype, "status", void 0);
