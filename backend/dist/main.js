"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && (!process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET.includes('your_'))) {
        throw new Error('JWT_ACCESS_TOKEN_SECRET must be configured in production');
    }
    if (isProduction && (!process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_TOKEN_SECRET.includes('your_'))) {
        throw new Error('JWT_REFRESH_TOKEN_SECRET must be configured in production');
    }
    if (isProduction && !process.env.CORS_ORIGIN) {
        throw new Error('CORS_ORIGIN must be configured in production');
    }
    if (isProduction && !process.env.EMAIL_WEBHOOK_URL) {
        throw new Error('EMAIL_WEBHOOK_URL must be configured in production');
    }
    if (isProduction && !process.env.SMS_WEBHOOK_URL) {
        throw new Error('SMS_WEBHOOK_URL must be configured in production');
    }
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
    if (isProduction && (!process.env.VOICE_BOOKING_WEBHOOK_SECRET || process.env.VOICE_BOOKING_WEBHOOK_SECRET.includes('replace_with_'))) {
        throw new Error('VOICE_BOOKING_WEBHOOK_SECRET must be configured in production');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        cors: { origin: isProduction ? allowedOrigins : true, credentials: true },
        rawBody: true,
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
    }));
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Hospital Platform API')
        .setDescription('API documentation for hospital operations, scheduling, billing, and authentication.')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const swaggerDocument = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, swaggerDocument);
    await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}
bootstrap();
