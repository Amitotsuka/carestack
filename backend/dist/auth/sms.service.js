"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSmsService = void 0;
const common_1 = require("@nestjs/common");
/** Sends authentication OTPs through an approved SMS-provider webhook. */
let AuthSmsService = class AuthSmsService {
    async sendOtp(to, otp, purpose) {
        const webhookUrl = process.env.SMS_WEBHOOK_URL;
        if (!webhookUrl) {
            if (process.env.NODE_ENV === 'production')
                throw new common_1.ServiceUnavailableException('SMS delivery is not configured');
            return;
        }
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ to, purpose, message: `Your MediFlow verification code is ${otp}. It expires in 10 minutes.` }),
        });
        if (!response.ok)
            throw new common_1.ServiceUnavailableException('SMS delivery provider rejected the message');
    }
};
exports.AuthSmsService = AuthSmsService;
exports.AuthSmsService = AuthSmsService = __decorate([
    (0, common_1.Injectable)()
], AuthSmsService);
