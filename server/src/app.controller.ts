import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, Delete, Get, Headers, Logger, NotFoundException, Param, Patch, Post, Put, Query, Req, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ArrayMaxSize, IsArray, IsByteLength, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AppService } from './app.service';
import { AccessGuard } from './auth/access.guard';
import { Permissions, Roles, TenantScoped } from './auth/access.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class PasswordResetRequestDto {
  @IsEmail()
  email: string;
}

class PasswordResetDto {
  @IsEmail()
  email: string;
  @IsString() @Matches(/^\d{6}$/)
  code: string;
  @IsString() @MinLength(10) @IsByteLength(10, 72)
  password: string;
}

class PasswordChangeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128)
  current_password?: string;
  @IsString() @MinLength(10) @IsByteLength(10, 72)
  password: string;
}

class OwnProfileDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;
  @IsEmail() @MaxLength(254)
  email: string;
  @IsOptional() @IsString() @MaxLength(20)
  @Matches(/^\+?[\d\s()-]{7,20}$/)
  phone?: string | null;
  @IsOptional() @IsString() @MaxLength(700000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatar_data_url?: string | null;
}

class ClinicInterestDto {
  @IsString() @MinLength(2)
  clinic_name: string;
  @IsString() @MinLength(2)
  contact_name: string;
  @IsEmail()
  email: string;
  @IsString() @Matches(/^\+?[\d\s()-]{8,20}$/)
  phone: string;
  @IsString() @MinLength(2)
  plan: string;
}

class TenantOnboardDto {
  @IsString()
  @MinLength(2)
  tenant_name: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tenant_domain: string;

  @IsString()
  @MinLength(2)
  admin_name: string;

  @IsEmail()
  admin_email: string;

  @IsString()
  @MinLength(10)
  admin_phone: string;

  @IsString()
  plan: string;

  @IsString()
  region: string;

  @IsOptional() @IsString() @MinLength(10) @IsByteLength(10, 72)
  admin_password?: string;

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billing_cycle?: string;
}

class TenantUpdateDto {
  @IsOptional() @IsString() @MinLength(2)
  tenant_name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tenant_domain?: string;
  @IsOptional() @IsString() @MinLength(2)
  admin_name?: string;
  @IsOptional() @IsEmail()
  admin_email?: string;
  @IsOptional() @IsString() @MinLength(10)
  admin_phone?: string;
  @IsOptional() @IsString()
  plan?: string;
  @IsOptional() @IsIn(['monthly', 'annual'])
  billing_cycle?: string;
  @IsOptional() @IsIn(['active', 'paused'])
  subscription_status?: string;
  @IsOptional() @IsString()
  region?: string;
}

class TenantPasswordDto {
  @IsString() @MinLength(10) @IsByteLength(10, 72)
  password: string;
}

const STAFF_PERMISSION_OPTIONS = ['overview:view', 'agents:view', 'doctors:view', 'doctors:manage', 'patients:view', 'patients:manage', 'appointments:view', 'appointments:manage', 'reports:view'];
class StaffCreateDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;
  @IsEmail()
  email: string;
  @IsString() @MinLength(10) @IsByteLength(10, 72)
  password: string;
  @IsArray() @ArrayMaxSize(STAFF_PERMISSION_OPTIONS.length) @IsIn(STAFF_PERMISSION_OPTIONS, { each: true })
  permissions: string[];
}
class StaffUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;
  @IsOptional() @IsEmail()
  email?: string;
  @IsOptional() @IsString() @MinLength(10) @IsByteLength(10, 72)
  password?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(STAFF_PERMISSION_OPTIONS.length) @IsIn(STAFF_PERMISSION_OPTIONS, { each: true })
  permissions?: string[];
}

class SubscriptionUpdateDto {
  @IsOptional() @IsString()
  plan?: string;
  @IsOptional() @IsIn(['monthly', 'annual'])
  billing_cycle?: string;
  @IsOptional() @IsIn(['active', 'paused'])
  subscription_status?: string;
}

class PlanDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id?: string;
  @IsOptional() @IsString() @MinLength(2)
  name?: string;
  @IsOptional() @IsInt() @Min(1)
  monthly_price?: number;
  @IsOptional() @IsInt() @Min(1)
  annual_price?: number;
  @IsOptional() @Min(1)
  clinic_limit?: number | null;
  @IsOptional() @Min(1)
  user_limit?: number | null;
}

class PatientDto {
  @IsString() @MinLength(2)
  name: string;
  @IsString() @MinLength(7)
  phone: string;
  @IsOptional() @IsEmail()
  email?: string;
  @IsOptional() @IsInt() @Min(0) @Max(125)
  age?: number;
  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;
  @IsOptional() @IsString()
  notes?: string;
}

class DoctorCreateDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name: string;
  @IsOptional() @IsString() @MaxLength(160)
  specialty?: string;
}

class DoctorUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;
  @IsOptional() @IsString() @MaxLength(160)
  specialty?: string;
  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;
}

class AppointmentStatusDto {
  @IsIn(['confirmed', 'completed', 'cancelled', 'no_show'])
  status: string;
}

class ManualAppointmentDto {
  @IsString() @MinLength(2) @MaxLength(120)
  patient_name: string;
  @IsString() @MinLength(7) @MaxLength(30)
  phone_number: string;
  @IsString() @MinLength(2) @MaxLength(120)
  doctor_name: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  appointment_date: string;
  @IsString() @Matches(/^\d{2}:\d{2}$/)
  appointment_time: string;
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

function safeVoiceBodyFieldNames(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth >= 2) return [];
  return Object.keys(value).slice(0, 30).map((key) => {
    const safeKey = /^[A-Za-z0-9_.-]{1,64}$/.test(key) ? key : '[other]';
    const child = (value as Record<string, unknown>)[key];
    return child && typeof child === 'object' && !Array.isArray(child)
      ? { [safeKey]: safeVoiceBodyFieldNames(child, depth + 1) }
      : safeKey;
  });
}

const voiceToolFieldAliases: Record<string, string> = {
  action: 'action', toolaction: 'action', operation: 'action',
  date: 'date', appointmentdate: 'date',
  time: 'time', appointmenttime: 'time',
  doctorname: 'doctor_name', doctor: 'doctor_name',
  requestid: 'request_id', confirmed: 'confirmed',
  patientname: 'patient_name', phonenumber: 'phone_number', patientphone: 'phone_number', phone: 'phone_number',
  reason: 'reason', question: 'question', query: 'query',
  toolsecret: 'tool_secret', voicetoolsecret: 'tool_secret', xvoicetoolsecret: 'tool_secret',
};

const voiceToolWrapperKeys = new Set(['arguments', 'args', 'parameters', 'params', 'input', 'payload', 'data', 'request', 'toolinput', 'toolarguments']);
const voiceToolSensitiveContextKeys = new Set(['state', 'messages', 'history', 'conversation', 'context', 'headers']);

function extractVoiceToolPayload(body: unknown) {
  const values = new Map<string, unknown>();
  const conflicts = new Set<string>();
  const add = (field: string, value: unknown) => {
    if (value === undefined || value === null || typeof value === 'object') return;
    if (values.has(field) && String(values.get(field)).trim() !== String(value).trim()) conflicts.add(field);
    else values.set(field, value);
  };
  const visit = (node: unknown, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 4) return;
    if (Array.isArray(node)) {
      // Some tool adapters encode body parameters as [{ name, value }, ...].
      for (const entry of node) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const item = entry as Record<string, unknown>;
        const name = typeof item.name === 'string' ? item.name
          : typeof item.key === 'string' ? item.key
            : typeof item.identifier === 'string' ? item.identifier : '';
        const field = voiceToolFieldAliases[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
        if (field && Object.prototype.hasOwnProperty.call(item, 'value')) add(field, item.value);
      }
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const field = voiceToolFieldAliases[normalizedKey];
      if (field) add(field, value);
      else if (!voiceToolSensitiveContextKeys.has(normalizedKey) && (depth === 0 || voiceToolWrapperKeys.has(normalizedKey))) visit(value, depth + 1);
      // Deliberately ignore state/transcript/context objects: they may contain
      // spoken text, but are not trustworthy API arguments.
    }
  };
  visit(body);

  const payload: Record<string, any> = {};
  for (const [field, value] of values) payload[field] = value;
  let actionSource: 'explicit' | 'inferred_from_date_time' | 'missing' = 'explicit';
  if (typeof payload.action === 'string') payload.action = payload.action.trim().toLowerCase();
  if (payload.action === undefined) {
    const bookingFields = ['request_id', 'confirmed', 'patient_name', 'phone_number', 'reason'];
    if (typeof payload.date === 'string' && payload.date.trim() && typeof payload.time === 'string' && payload.time.trim() &&
      !bookingFields.some((field) => payload[field] !== undefined)) {
      payload.action = 'availability';
      actionSource = 'inferred_from_date_time';
    } else actionSource = 'missing';
  }
  if (payload.action === 'availability' && payload.doctor_name === undefined) payload.doctor_name = '';
  return { payload, conflicts: [...conflicts], actionSource };
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService, private readonly jwtService: JwtService) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'Hospital Node API' };
  }

  @Post('api/auth/login')
  async login(@Body() body: LoginDto) {
    const payload = (body ?? {}) as Partial<LoginDto>;
    const email = String(payload.email ?? '').trim().toLowerCase();
    const password = String(payload.password ?? '');

    const user = await this.appService.login(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.user_id,
      role: user.role,
      tenant_id: user.tenant_id,
      email: user.email,
      permissions: ('permissions' in user && user.permissions) || [],
    });

    return {
      user,
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 1800,
      message: 'Login successful',
    };
  }

  @Post('api/auth/password-reset/request')
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    try {
      return await this.appService.requestPasswordReset(body.email);
    } catch {
      throw new ServiceUnavailableException('Password reset email could not be sent. Please try again later.');
    }
  }

  @Post('api/auth/password-reset/confirm')
  async resetPassword(@Body() body: PasswordResetDto) {
    const updated = await this.appService.resetPassword(body.email, body.code, body.password);
    if (!updated) throw new BadRequestException('The reset code is invalid or expired. Request a new code and try again.');
    return { updated: true, message: 'Password updated. You can now sign in.' };
  }

  @Post('api/auth/password/change')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin', 'receptionist', 'super_admin')
  async changeOwnPassword(@Req() request: any, @Body() body: PasswordChangeDto) {
    const updated = await this.appService.changeOwnPassword(request.user.tenant_id, request.user.sub, body.current_password, body.password);
    if (updated === 'not_found') throw new UnauthorizedException('This account is no longer active.');
    if (updated === 'current_password_invalid') throw new BadRequestException('The current password is incorrect.');
    return { updated: true, message: 'Password updated successfully.' };
  }

  @Get('api/auth/profile')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin', 'super_admin')
  getOwnProfile(@Req() request: any) {
    const user = this.appService.getOwnProfile(request.user.tenant_id, request.user.sub);
    if (!user) throw new UnauthorizedException('This account is no longer active.');
    return { user };
  }

  @Patch('api/auth/profile')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin', 'super_admin')
  async updateOwnProfile(@Req() request: any, @Body() body: OwnProfileDto) {
    const updated = await this.appService.updateOwnProfile(request.user.tenant_id, request.user.sub, body);
    if (updated === 'invalid') throw new BadRequestException('Name and email are required.');
    if (updated === 'email_taken') throw new ConflictException('That email address is already being used by another account.');
    if (updated === 'not_found') throw new UnauthorizedException('This account is no longer active.');
    return { user: updated, message: 'Profile updated successfully.' };
  }

  @Get('api/tenant/resolve/:domain')
  resolveTenant(@Param('domain') domain: string) {
    const tenant = this.appService.getTenantByDomain(domain);
    if (!tenant) throw new NotFoundException('Clinic not found');
    return tenant;
  }

  @Get('api/public/plans')
  getPublicPlans() {
    return { plans: this.appService.getPlans().map(({ id, name, monthly_price, annual_price, clinic_limit, user_limit }) => ({ id, name, monthly_price, annual_price, clinic_limit, user_limit })) };
  }

  @Post('api/public/clinic-interest')
  createClinicInterest(@Body() body: ClinicInterestDto) {
    const lead = this.appService.createClinicInterest({ ...body, clinic_name: body.clinic_name.trim(), contact_name: body.contact_name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim() });
    if (!lead) throw new BadRequestException('Choose a currently available clinic plan.');
    return { lead_id: lead.id, message: 'Thanks. Your clinic subscription request has been received.' };
  }

  @Get('api/super-admin/clinic-interests')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  listClinicInterests() {
    return { clinic_interests: this.appService.listClinicInterests() };
  }

  @Get('api/tenants')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  listTenants() {
    return { tenants: this.appService.listTenants() };
  }

  @Get('api/tenants/:tenantId')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  getTenantDetails(@Param('tenantId') tenantId: string) {
    const tenant = this.appService.getTenantDetails(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return { tenant };
  }

  @Get('api/plans')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  listPlans() {
    return { plans: this.appService.getPlans() };
  }

  @Post('api/plans')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  createPlan(@Body() body: PlanDto) {
    const plan = this.appService.createPlan(body);
    if (!plan) throw new ConflictException('Plan id already exists or plan pricing is invalid');
    return { plan, message: 'Plan created successfully' };
  }

  @Put('api/plans/:planId')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  updatePlan(@Param('planId') planId: string, @Body() body: PlanDto) {
    if ((body.monthly_price !== undefined && body.monthly_price <= 0) || (body.annual_price !== undefined && body.annual_price <= 0)) {
      throw new BadRequestException('Plan prices must be greater than zero');
    }
    const plan = this.appService.updatePlan(planId, body);
    if (!plan) throw new NotFoundException('Plan not found');
    return { plan, message: 'Plan updated successfully' };
  }

  @Delete('api/plans/:planId')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  deletePlan(@Param('planId') planId: string) {
    const result = this.appService.deletePlan(planId);
    if (result === 'not_found') throw new NotFoundException('Plan not found');
    if (result === 'in_use') throw new ConflictException('A plan assigned to tenants cannot be deleted');
    return { deleted: true, plan_id: planId };
  }

  @Get('api/super-admin/dashboard')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  getSuperAdminDashboard() {
    return this.appService.getSuperAdminDashboard();
  }

  @Post('api/tenants/onboard')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  async onboardTenant(@Body() body: TenantOnboardDto) {
    const tenant = await this.appService.createTenant(body).catch(() => {
      throw new ServiceUnavailableException('Clinic account could not be created because the administrator email could not be delivered. Check the API email configuration and try again.');
    });
    if (!tenant) throw new ConflictException('Tenant domain or administrator email is already in use');
    return { tenant, message: 'Tenant onboarded successfully' };
  }

  @Put('api/tenants/:tenantId')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  updateTenant(@Param('tenantId') tenantId: string, @Body() body: TenantUpdateDto) {
    try {
      const tenant = this.appService.updateTenant(tenantId, body);
      if (!tenant) throw new NotFoundException('Tenant not found');
      return { tenant, message: 'Tenant updated successfully' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in use')) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Put('api/tenants/:tenantId/password')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  async setTenantAdminPassword(@Param('tenantId') tenantId: string, @Body() body: TenantPasswordDto) {
    const result = await this.appService.setTenantAdminPassword(tenantId, body.password);
    if (result === 'not_found') throw new NotFoundException('Tenant not found');
    if (result === 'admin_not_found') throw new ConflictException('This tenant has no administrator account');
    return { updated: true, message: 'Tenant administrator password updated successfully.' };
  }

  @Put('api/tenants/:tenantId/telephony')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  updateTenantTelephony(@Param('tenantId') tenantId: string, @Body() body: any) {
    const config = this.appService.updateTenantTelephony(tenantId, body || {});
    if (config === null) throw new NotFoundException('Clinic not found');
    if (config && 'error' in config) throw new BadRequestException(config.error);
    if (!config) throw new BadRequestException('Calling settings were not saved. Check the selected provider and its phone number, then try again.');
    return { telephony: config, voice_tool_secret: this.appService.getVoiceToolSecret(tenantId), message: 'Clinic calling settings saved.' };
  }

  @Post('api/tenants/:tenantId/voice-deployment')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  async activateVoiceDeployment(@Param('tenantId') tenantId: string) {
    const result = await this.appService.activateVoiceDeployment(tenantId);
    if (result === null) throw new NotFoundException('Clinic not found');
    if ('error' in result) throw new BadRequestException(result.error);
    return { ...result, message: 'Sarvam inbound deployment created and now active.' };
  }

  @Post('api/tenants/:tenantId/exotel/verify')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  async verifyExotelConnection(@Param('tenantId') tenantId: string) {
    const result = await this.appService.verifyExotelConnection(tenantId);
    if (result === null) throw new NotFoundException('Clinic not found');
    if ('error' in result) throw new BadRequestException(result.error);
    return result;
  }

  @Post('api/exotel/voicebot/webhooks/:tenantId')
  async exotelVoicebotWebhook(@Param('tenantId') tenantId: string, @Headers('authorization') authorization: string, @Body() body: any) {
    const result = await this.appService.ingestExotelVoicebotWebhook(tenantId, authorization, body);
    if ('error' in result && result.error === 'Webhook authentication failed.') throw new UnauthorizedException(result.error);
    if ('error' in result) throw new BadRequestException(result.error);
    return { http_code: 200, response: { data: result } };
  }

  @Post('api/internal/agent/tools/:tenantId')
  async pythonAgentTool(
    @Param('tenantId') tenantId: string,
    @Headers('x-agent-token') suppliedToken: string,
    @Body() body: any,
  ) {
    const configuredToken = process.env.PYTHON_AGENT_SECRET || '';
    const expected = Buffer.from(configuredToken);
    const supplied = Buffer.from(String(suppliedToken || ''));
    if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Agent service authentication failed');
    }
    const action = String(body?.action || '').trim().toLowerCase();
    if (!['clinic_info', 'faq', 'availability', 'book'].includes(action)) {
      throw new BadRequestException('Unsupported agent tool action');
    }
    const result = await this.appService.voiceTool(tenantId, { ...body, action });
    if ('error' in result) throw new BadRequestException(result.error);
    return result;
  }

  @Get('api/tenants/:tenantId/exotel/calls')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  listExotelCalls(@Param('tenantId') tenantId: string) {
    const calls = this.appService.listExotelCalls(tenantId);
    if (!calls) throw new NotFoundException('Clinic not found');
    return { calls };
  }

  @Post('api/tenants/:tenantId/exotel/calls/sync')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  async syncExotelCalls(@Param('tenantId') tenantId: string, @Body() body: any) {
    const result = await this.appService.syncExotelCalls(tenantId, String(body?.start_date || ''), String(body?.end_date || ''), body?.after ? String(body.after) : undefined);
    if (result === null) throw new NotFoundException('Clinic not found');
    if ('error' in result) throw new BadGatewayException(result.error);
    return result;
  }

  @Get('api/tenants/:tenantId/exotel/calls/:callSid/recording')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  async getExotelCallRecording(@Param('tenantId') tenantId: string, @Param('callSid') callSid: string) {
    const result = await this.appService.getExotelCallRecording(tenantId, callSid);
    if ('error' in result && result.error === 'Call not found.') throw new NotFoundException(result.error);
    if ('error' in result) throw new BadGatewayException(result.error);
    return result;
  }

  @Post('api/tenants/:tenantId/exotel/calls/:callSid/book')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  async bookExotelCall(@Param('tenantId') tenantId: string, @Param('callSid') callSid: string, @Body() body: any) {
    const result = await this.appService.bookExotelCall(tenantId, callSid, body);
    if ('error' in result && result.error === 'Call not found.') throw new NotFoundException(result.error);
    if ('error' in result) throw new BadRequestException(result.error);
    return result;
  }

  @Post('api/voice/tools/:tenantId')
  async voiceTool(
    @Param('tenantId') tenantId: string,
    @Headers('x-voice-tool-secret') suppliedSecret: string,
    @Body() body: any,
    @Headers('authorization') authorizationHeader: string,
    @Headers('x-tenant-id') _tenantHeader: string,
    @Headers('content-type') contentType: string,
    @Query('reason') queryReason?: string,
  ) {
    const started = performance.now();
    const traceId = randomUUID();
    const extracted = extractVoiceToolPayload(body);
    const toolPayload = extracted.payload;
    // Exotel can supply the optional visit reason in the query string instead
    // of its POST body schema. Prefer it when present; otherwise keep the
    // existing body value (or let booking default to an empty reason).
    if (queryReason !== undefined) toolPayload.reason = queryReason;
    const rawAction = typeof toolPayload.action === 'string' ? toolPayload.action.trim().toLowerCase() : '';
    const supportedActions = ['clinic_info', 'faq', 'availability', 'book'];
    const actionValue = supportedActions.includes(rawAction) ? rawAction : '';
    const action = actionValue || 'unknown';
    let authenticationMs = 0;
    let dispatchMs = 0;
    let outcome = 'success';
    let failureCode: string | undefined;
    try {
      const authStarted = performance.now();
      const authorization = String(authorizationHeader || '').trim();
      const bearerMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
      // Prefer the dedicated header. Bearer auth supports integrations that expose
      // a standard Authorization field but do not expose arbitrary header names.
      const bodyCredential = String(toolPayload.tool_secret || '').trim();
      const credential = String(suppliedSecret || '').trim() || bearerMatch?.[1] || bodyCredential;
      const authenticated = this.appService.validateVoiceToolSecret(tenantId, credential);
      authenticationMs = performance.now() - authStarted;
      this.logger.log(JSON.stringify({
        event: 'voice_tool.stage', trace_id: traceId, tenant_id: tenantId, action,
        stage: 'authentication', outcome: authenticated ? 'success' : 'failed',
        ...(!authenticated ? { reason_code: 'authentication_failed' } : {}),
      }));
      if (!authenticated) {
        failureCode = 'authentication_failed';
        throw new UnauthorizedException('Voice tool authentication failed');
      }

      if (extracted.conflicts.length) {
        failureCode = 'conflicting_arguments';
        throw new BadRequestException(`Conflicting values for voice tool field(s): ${extracted.conflicts.join(', ')}.`);
      }

      // Exotel can inject its own x-tenant-id metadata. Route tenant and the
      // credential derived for that tenant are authoritative for this endpoint.
      // Only recognized tool arguments reach dispatch. Credentials and arbitrary
      // wrapper/context fields are excluded and never logged.
      delete toolPayload.tool_secret;
      if (toolPayload.action === undefined) {
        failureCode = 'missing_action';
        throw new BadRequestException('Could not determine the tool action. Send action, or provide both date and time for an availability check.');
      }
      const dispatchStarted = performance.now();
      // All caller tools execute in the authenticated Nest service. It owns
      // the live clinic calendar and booking persistence; routing a write via
      // a sleeping proxy adds no guarantees and can hide a committed result.
      // The booking path enforces explicit confirmation and request_id
      // idempotency, so retries with the same ID cannot create duplicates.
      const result = await this.appService.voiceTool(tenantId, toolPayload, traceId);
      dispatchMs = performance.now() - dispatchStarted;
      if ('error' in result && result.error === 'Clinic not found.') throw new NotFoundException('Clinic not found');
      if ('error' in result && result.unavailable === true) {
        throw new ServiceUnavailableException(`${result.error} Retry with the same request_id.`);
      }
      if ('error' in result) throw new BadRequestException(result.error);
      return result;
    } catch (error) {
      outcome = error instanceof ServiceUnavailableException ? 'dependency_unavailable'
        : error instanceof UnauthorizedException ? 'unauthorized'
          : error instanceof BadRequestException ? 'rejected'
            : 'error';
      failureCode ||= error instanceof ServiceUnavailableException ? 'booking_storage_unavailable'
        : error instanceof UnauthorizedException ? 'authentication_failed'
          : error instanceof NotFoundException ? 'clinic_not_found'
            : error instanceof BadRequestException ? 'tool_request_rejected'
              : 'unexpected_exception';
      throw error;
    } finally {
      this.logger.log(JSON.stringify({
        event: 'voice_tool.request_timing', trace_id: traceId, tenant_id: tenantId, action,
        received_action: actionValue || (rawAction ? 'unsupported' : null),
        action_field_present: extracted.actionSource === 'explicit', action_source: extracted.actionSource,
        content_type: String(contentType || '').slice(0, 100) || null,
        body_field_names: safeVoiceBodyFieldNames(body),
        authentication_ms: Number(authenticationMs.toFixed(2)), dispatch_ms: Number(dispatchMs.toFixed(2)),
        total_ms: Number((performance.now() - started).toFixed(2)), outcome,
        ...(failureCode ? { failure_code: failureCode } : {}),
      }));
    }
  }

  @Patch('api/tenants/:tenantId/subscription')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  updateSubscription(@Param('tenantId') tenantId: string, @Body() body: SubscriptionUpdateDto) {
    if (body.subscription_status && !['active', 'paused'].includes(body.subscription_status)) {
      throw new BadRequestException('Subscription status must be active or paused');
    }
    if (body.billing_cycle && !['monthly', 'annual'].includes(body.billing_cycle)) {
      throw new BadRequestException('Billing cycle must be monthly or annual');
    }
    const tenant = this.appService.updateTenant(tenantId, body);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return { tenant, message: 'Subscription updated successfully' };
  }

  @Delete('api/tenants/:tenantId')
  @UseGuards(AccessGuard)
  @Roles('super_admin')
  deleteTenant(@Param('tenantId') tenantId: string) {
    if (!this.appService.deleteTenant(tenantId)) throw new NotFoundException('Tenant not found');
    return { deleted: true, tenant_id: tenantId };
  }

  @Get('api/tenant/:tenantId/dashboard')
  @UseGuards(AccessGuard)
  @TenantScoped()
  getDashboard(@Param('tenantId') tenantId: string, @Query('activity_range') activityRange?: string, @Req() request?: any) {
    const dashboard = this.appService.getDashboard(tenantId, activityRange);
    if (request?.user?.role === 'tenant_admin') return dashboard;
    const permissions = new Set<string>(request?.user?.permissions || []);
    const canSeeOverview = permissions.has('overview:view');
    const canSeeReports = permissions.has('reports:view');
    return {
      ...dashboard,
      voice_agent: permissions.has('agents:view') ? dashboard.voice_agent : undefined,
      telephony: permissions.has('agents:view') ? dashboard.telephony : undefined,
      doctors: permissions.has('doctors:view') || permissions.has('doctors:manage') ? dashboard.doctors : [],
      patients: permissions.has('patients:view') || permissions.has('patients:manage') || canSeeReports ? dashboard.patients : [],
      bookings: permissions.has('appointments:view') || permissions.has('appointments:manage') || canSeeReports ? dashboard.bookings : [],
      summary: canSeeOverview || canSeeReports ? dashboard.summary : undefined,
      analytics: canSeeOverview || canSeeReports ? dashboard.analytics : undefined,
    };
  }

  @Get('api/tenant/:tenantId/staff')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  listStaff(@Param('tenantId') tenantId: string) {
    const staff = this.appService.listStaff(tenantId);
    if (!staff) throw new NotFoundException('Clinic not found');
    return { staff };
  }

  @Post('api/tenant/:tenantId/staff')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  createStaff(@Param('tenantId') tenantId: string, @Body() body: StaffCreateDto) {
    const staff = this.appService.createStaff(tenantId, body);
    if (staff === null) throw new NotFoundException('Clinic not found');
    if (!staff) throw new ConflictException('An account with this email already exists');
    return { staff, message: 'Staff account created.' };
  }

  @Patch('api/tenant/:tenantId/staff/:staffId')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  updateStaff(@Param('tenantId') tenantId: string, @Param('staffId') staffId: string, @Body() body: StaffUpdateDto) {
    const staff = this.appService.updateStaff(tenantId, staffId, body);
    if (staff === null) throw new NotFoundException('Staff account not found');
    if (!staff) throw new ConflictException('An account with this email already exists');
    return { staff, message: 'Staff account updated.' };
  }

  @Delete('api/tenant/:tenantId/staff/:staffId')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  deleteStaff(@Param('tenantId') tenantId: string, @Param('staffId') staffId: string) {
    if (!this.appService.deleteStaff(tenantId, staffId)) throw new NotFoundException('Staff account not found');
    return { deleted: true, staff_id: staffId };
  }

  @Put('api/tenant/:tenantId/voice-agent')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('agents:manage')
  updateVoiceAgent(@Param('tenantId') tenantId: string, @Body() body: any) {
    const settings = this.appService.updateVoiceAgent(tenantId, body || {});
    if (settings === null) throw new NotFoundException('Clinic not found');
    if (!settings) throw new BadRequestException('Check clinic hours and timezone. Calling numbers must use international format and cannot be assigned to another clinic.');
    return { voice_agent: settings, message: 'Voice agent settings saved.' };
  }

  @Get('api/tenant/:tenantId/doctors')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('doctors:view', 'doctors:manage')
  getDoctors(@Param('tenantId') tenantId: string) {
    const doctors = this.appService.getDoctors(tenantId);
    if (!doctors) throw new NotFoundException('Clinic not found');
    return { doctors };
  }

  @Post('api/tenant/:tenantId/doctors')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('doctors:manage')
  async addDoctor(@Param('tenantId') tenantId: string, @Body() body: DoctorCreateDto) {
    const doctor = await this.appService.addDoctor(tenantId, body);
    if (!doctor) throw new NotFoundException('Clinic not found');
    if ('error' in doctor) throw new BadRequestException(doctor.error);
    return { doctor, message: 'Doctor added to clinic roster.' };
  }

  @Patch('api/tenant/:tenantId/doctors/:doctorId')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('doctors:manage')
  async updateDoctor(@Param('tenantId') tenantId: string, @Param('doctorId') doctorId: string, @Body() body: DoctorUpdateDto) {
    const doctor = await this.appService.updateDoctor(tenantId, doctorId, body);
    if (!doctor) throw new NotFoundException('Doctor not found');
    if ('error' in doctor) throw new BadRequestException(doctor.error);
    return { doctor, message: 'Doctor roster updated.' };
  }

  @Post('api/tenant/:tenantId/voice-agent/preview')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('agents:view')
  previewVoiceAgent(@Param('tenantId') tenantId: string, @Body() body: any) {
    const preview = this.appService.previewVoiceAgent(tenantId, String(body?.caller_message || ''));
    if (!preview) throw new NotFoundException('Clinic not found');
    return preview;
  }

  @Get('api/tenant/:tenantId/patients')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('patients:view', 'patients:manage')
  getPatients(@Param('tenantId') tenantId: string) {
    return { patients: this.appService.getPatients(tenantId) };
  }

  @Post('api/tenant/:tenantId/patients')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('patients:manage')
  addPatient(@Param('tenantId') tenantId: string, @Body() body: PatientDto) {
    return { patient: this.appService.addPatient(tenantId, body), message: 'Patient created' };
  }

  @Put('api/tenant/:tenantId/patients/:patientId')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('patients:manage')
  updatePatient(
    @Param('tenantId') tenantId: string,
    @Param('patientId') patientId: string,
    @Body() body: PatientDto,
  ) {
    return { patient: this.appService.updatePatient(tenantId, patientId, body), message: 'Patient updated' };
  }

  @Delete('api/tenant/:tenantId/patients/:patientId')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('patients:manage')
  deletePatient(@Param('tenantId') tenantId: string, @Param('patientId') patientId: string) {
    return this.appService.deletePatient(tenantId, patientId);
  }

  @Patch('api/tenant/:tenantId/appointments/:appointmentId')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('appointments:manage')
  updateAppointmentStatus(
    @Param('tenantId') tenantId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: AppointmentStatusDto,
  ) {
    const allowedStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
    if (!allowedStatuses.includes(body.status)) {
      throw new BadRequestException(`Appointment status must be one of: ${allowedStatuses.join(', ')}`);
    }
    const result = this.appService.updateBookingStatus(tenantId, appointmentId, body.status);
    if ('error' in result) throw new NotFoundException(result.error);
    return { appointment: result, message: 'Appointment status updated' };
  }

  @Post('api/tenant/:tenantId/appointments')
  @UseGuards(AccessGuard)
  @TenantScoped()
  @Permissions('appointments:manage')
  async createManualAppointment(@Param('tenantId') tenantId: string, @Body() body: ManualAppointmentDto) {
    const appointment = await this.appService.addBooking(tenantId, { ...body, id: `APT-${randomUUID()}`, status: 'confirmed' });
    if (!appointment) throw new NotFoundException('Clinic not found');
    if ('error' in appointment) throw new BadRequestException(appointment.error);
    return { appointment, message: 'Appointment booked.' };
  }

  @Post('api/agent/availability')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  async checkAgentAvailability(@Body() body: any) {
    const tenantId = String(body?.tenant_id ?? '');
    if (!tenantId) throw new BadRequestException('tenant_id is required');
    const configuredAgentUrl = (process.env.PYTHON_AGENT_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
    const baseUrl = /^https?:\/\//i.test(configuredAgentUrl) ? configuredAgentUrl : `http://${configuredAgentUrl}`;
    const serviceToken = process.env.PYTHON_AGENT_SECRET || '';
    if (serviceToken.length < 32) throw new ServiceUnavailableException('Python agent authentication is not configured');
    try {
      const fetch = globalThis.fetch;
      const response = await fetch(`${baseUrl}/api/agent/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-token': serviceToken },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          tenant_id: tenantId,
          appointment_date: body.appointment_date,
          appointment_time: body.appointment_time,
          doctor_name: body.doctor_name || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new BadGatewayException(data.detail || 'Python agent could not check availability');
      }
      return { source: 'python_agent', data };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Python agent service is unavailable');
    }
  }

  @Post('api/agent/booking')
  @UseGuards(AccessGuard)
  @Roles('tenant_admin')
  @TenantScoped()
  async triggerOrchestration(@Body() body: any) {
    const tenantId = String(body?.tenant_id ?? '');
    if (!tenantId) throw new BadRequestException('tenant_id is required');
    const configuredAgentUrl = (process.env.PYTHON_AGENT_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
    const baseUrl = /^https?:\/\//i.test(configuredAgentUrl) ? configuredAgentUrl : `http://${configuredAgentUrl}`;
    const agentSecret = process.env.PYTHON_AGENT_SECRET?.trim();
    if (!agentSecret) throw new BadGatewayException('Python agent authentication is not configured');
    try {
      const response = await globalThis.fetch(`${baseUrl}/api/agent/phone-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-token': agentSecret },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          tenant_id: tenantId,
          request_id: body.request_id,
          confirmed: body.confirmed,
          patient_name: body.patient_name,
          phone_number: body.phone_number,
          doctor_name: body.doctor_name,
          appointment_date: body.appointment_date,
          appointment_time: body.appointment_time,
          reason: body.reason || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new BadGatewayException(data.detail || 'Python agent could not complete the booking');
      if (data.status !== 'confirmed') return { source: 'python_agent', data };
      const appointment = data.appointment;
      if (!appointment?.id) throw new BadGatewayException('Clinic scheduling service did not return a confirmed appointment ID');
      return { source: 'python_agent', data, appointment };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Python agent service is unavailable');
    }
  }
}
