import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, Delete, Get, Headers, NotFoundException, Param, Patch, Post, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import { AppService } from './app.service';
import { AccessGuard } from './auth/access.guard';
import { Roles, TenantScoped } from './auth/access.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
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

class AppointmentStatusDto {
  @IsIn(['confirmed', 'completed', 'cancelled', 'no_show'])
  status: string;
}

@Controller()
export class AppController {
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
    });

    return {
      user,
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 1800,
      message: 'Login successful',
    };
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
  onboardTenant(@Body() body: TenantOnboardDto) {
    const tenant = this.appService.createTenant(body);
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

  @Post('api/voice/tools/:tenantId')
  async voiceTool(@Param('tenantId') tenantId: string, @Headers('x-voice-tool-secret') suppliedSecret: string, @Body() body: any) {
    if (!this.appService.validateVoiceToolSecret(tenantId, String(suppliedSecret || ''))) {
      throw new UnauthorizedException('Voice tool authentication failed');
    }
    const result = this.appService.voiceTool(tenantId, body);
    if ('error' in result && result.error === 'Clinic not found.') throw new NotFoundException('Clinic not found');
    return result;
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
  getDashboard(@Param('tenantId') tenantId: string) {
    const dashboard = this.appService.getDashboard(tenantId);
    return dashboard;
  }

  @Put('api/tenant/:tenantId/voice-agent')
  @UseGuards(AccessGuard)
  @TenantScoped()
  updateVoiceAgent(@Param('tenantId') tenantId: string, @Body() body: any) {
    const settings = this.appService.updateVoiceAgent(tenantId, body || {});
    if (settings === null) throw new NotFoundException('Clinic not found');
    if (!settings) throw new BadRequestException('Check clinic hours and timezone. Calling numbers must use international format and cannot be assigned to another clinic.');
    return { voice_agent: settings, message: 'Voice agent settings saved.' };
  }

  @Post('api/tenant/:tenantId/voice-agent/preview')
  @UseGuards(AccessGuard)
  @TenantScoped()
  previewVoiceAgent(@Param('tenantId') tenantId: string, @Body() body: any) {
    const preview = this.appService.previewVoiceAgent(tenantId, String(body?.caller_message || ''));
    if (!preview) throw new NotFoundException('Clinic not found');
    return preview;
  }

  @Get('api/tenant/:tenantId/patients')
  @UseGuards(AccessGuard)
  @TenantScoped()
  getPatients(@Param('tenantId') tenantId: string) {
    return { patients: this.appService.getPatients(tenantId) };
  }

  @Post('api/tenant/:tenantId/patients')
  @UseGuards(AccessGuard)
  @TenantScoped()
  addPatient(@Param('tenantId') tenantId: string, @Body() body: PatientDto) {
    return { patient: this.appService.addPatient(tenantId, body), message: 'Patient created' };
  }

  @Put('api/tenant/:tenantId/patients/:patientId')
  @UseGuards(AccessGuard)
  @TenantScoped()
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
  deletePatient(@Param('tenantId') tenantId: string, @Param('patientId') patientId: string) {
    return this.appService.deletePatient(tenantId, patientId);
  }

  @Patch('api/tenant/:tenantId/appointments/:appointmentId')
  @UseGuards(AccessGuard)
  @TenantScoped()
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

  @Post('api/agent/booking')
  @UseGuards(AccessGuard)
  @TenantScoped()
  async triggerOrchestration(@Body() body: any) {
    const tenantId = String(body?.tenant_id ?? '');
    if (!tenantId) throw new BadRequestException('tenant_id is required');
    const policyError = this.appService.validateAgentBooking(tenantId, String(body?.appointment_time ?? ''));
    if (policyError) throw new BadRequestException(policyError);

    const configuredAgentUrl = (process.env.PYTHON_AGENT_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
    const baseUrl = /^https?:\/\//i.test(configuredAgentUrl) ? configuredAgentUrl : `http://${configuredAgentUrl}`;
    try {
      const fetch = globalThis.fetch;
      const response = await fetch(`${baseUrl}/api/agent/phone-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: body.patient_name,
          phone_number: body.phone_number,
          doctor_name: body.doctor_name,
          appointment_date: body.appointment_date,
          appointment_time: body.appointment_time,
          reason: body.reason,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.appointment) {
        throw new BadGatewayException(data.detail || 'Python agent could not complete the booking');
      }

      const appointment = this.appService.addBooking(tenantId, data.appointment);
      if (!appointment) throw new BadRequestException('Tenant not found');
      if ('error' in appointment) throw new BadRequestException(appointment.error);

      return { source: 'python_agent', data, appointment };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) throw error;
      throw new BadGatewayException('Python agent service is unavailable');
    }
  }
}
