import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
    if (process.env.SUPER_ADMIN_PASSWORD && process.env.SUPER_ADMIN_PASSWORD.length < 14) {
      throw new Error('SUPER_ADMIN_PASSWORD must be at least 14 characters when configured');
    }
  }

  const app = await NestFactory.create(AppModule);
  // Render forwards client requests through its proxy. Trust that one proxy so
  // rate limiting can identify the caller correctly from X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const defaultOrigins = isProduction
    ? 'https://carestack-uat-web.onrender.com'
    : 'http://localhost:5173,http://localhost:5175,http://skycare.localhost:5175';
  const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');
  // The public UAT portal must remain allowed even if CORS_ORIGINS contains
  // an old local URL or an extra integration origin.
  const allowedOrigins = [defaultOrigins, process.env.CORS_ORIGINS || '']
    .flatMap((origins) => origins.split(','))
    .map(normalizeOrigin).filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
      if (!isProduction && /^https?:\/\/(?:[a-z0-9-]+\.)?localhost(?::\d+)?$/i.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-voice-tool-secret'],
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet());
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api/public/clinic-interest', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api/voice/tools', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
  await app.listen(Number(process.env.PORT) || 3001, host);
}

bootstrap();
