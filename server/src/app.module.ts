import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from '@nestjs/jwt';
import { AccessGuard } from './auth/access.guard';

@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET || 'development-only-secret-change-before-production-0123456789',
    signOptions: { expiresIn: '30m' },
  })],
  controllers: [AppController],
  providers: [AppService, AccessGuard],
})
export class AppModule {}
