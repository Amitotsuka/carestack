import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AppService } from '../app.service';
export declare class AccessGuard implements CanActivate {
    private readonly jwtService;
    private readonly reflector;
    private readonly appService;
    constructor(jwtService: JwtService, reflector: Reflector, appService: AppService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
