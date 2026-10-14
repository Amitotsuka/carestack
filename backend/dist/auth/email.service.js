"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthEmailService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Delivers auth messages through an HTTP email-provider adapter. Set EMAIL_WEBHOOK_URL
 * to a trusted internal notification service, Resend, SES adapter, or equivalent.
 */
let AuthEmailService = class AuthEmailService {
    constructor() {
        this.baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    }
    async send(to, subject, path, token) {
        const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
        if (!webhookUrl) {
            if (process.env.NODE_ENV === 'production')
                throw new common_1.ServiceUnavailableException('Email delivery is not configured');
            return;
        }
        const response = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, subject, actionUrl: `${this.baseUrl}${path}${encodeURIComponent(token)}` }) });
        if (!response.ok)
            throw new common_1.ServiceUnavailableException('Email delivery provider rejected the message');
    }
};
exports.AuthEmailService = AuthEmailService;
exports.AuthEmailService = AuthEmailService = __decorate([
    (0, common_1.Injectable)()
], AuthEmailService);
