"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const express = __importStar(require("express"));
const app_module_1 = require("./app.module");
dotenv_1.default.config();
async function bootstrap() {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        if ((process.env.JWT_SECRET || '').length < 32)
            throw new Error('JWT_SECRET must be at least 32 characters');
        if (process.env.SUPER_ADMIN_PASSWORD && process.env.SUPER_ADMIN_PASSWORD.length < 14) {
            throw new Error('SUPER_ADMIN_PASSWORD must be at least 14 characters when configured');
        }
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    const defaultOrigins = isProduction
        ? 'https://carestack-uat-web.onrender.com'
        : 'http://localhost:5173,http://localhost:5175,http://skycare.localhost:5175';
    const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, '');
    const allowedOrigins = [defaultOrigins, process.env.CORS_ORIGINS || '']
        .flatMap((origins) => origins.split(','))
        .map(normalizeOrigin).filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(normalizeOrigin(origin)))
                return callback(null, true);
            if (!isProduction && /^https?:\/\/(?:[a-z0-9-]+\.)?localhost(?::\d+)?$/i.test(origin))
                return callback(null, true);
            return callback(null, false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-voice-tool-secret'],
    });
    app.getHttpAdapter().getInstance().disable('x-powered-by');
    app.use((0, helmet_1.default)());
    app.use('/api/auth/login', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use('/api/auth/password-reset/request', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use('/api/auth/password-reset/confirm', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use('/api/public/clinic-interest', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use('/api/voice/tools', (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use('/api/exotel/voicebot/webhooks', (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
    await app.listen(Number(process.env.PORT) || 3001, host);
}
bootstrap();
//# sourceMappingURL=main.js.map