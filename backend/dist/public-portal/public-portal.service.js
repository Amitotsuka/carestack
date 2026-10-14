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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicPortalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const email_service_1 = require("../auth/email.service");
const sms_service_1 = require("../auth/sms.service");
const public_portal_repository_1 = require("./public-portal.repository");
let PublicPortalService = class PublicPortalService {
    constructor(repository, email, sms) {
        this.repository = repository;
        this.email = email;
        this.sms = sms;
    }
    async landing(slug) {
        const organization = await this.organization(slug);
        const hospital = organization.hospitals[0];
        if (!hospital)
            throw new common_1.NotFoundException('Hospital is not available');
        const doctors = await this.repository.findDoctors(organization.id, hospital.id);
        return {
            organization: { id: organization.id, name: organization.name, slug: organization.slug },
            hospital: { id: hospital.id, name: hospital.name, address: hospital.address, phone: hospital.phone },
            doctors,
            statistics: { patients: organization._count.patients, doctors: organization._count.doctors, careTeam: organization._count.users, yearsOfCare: new Date().getFullYear() - hospital.createdAt.getFullYear() + 1 },
        };
    }
    async createEnquiry(slug, dto) {
        const organization = await this.organization(slug);
        const hospital = organization.hospitals[0];
        const enquiry = await this.repository.createEnquiry({ data: { organization: { connect: { id: organization.id } }, hospital: hospital ? { connect: { id: hospital.id } } : undefined, name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, subject: dto.subject, message: dto.message } });
        return { id: enquiry.id, status: enquiry.status, message: 'Your enquiry has been received. Our care team will contact you shortly.' };
    }
    async slots(slug, doctorId, from, to) {
        const organization = await this.organization(slug);
        const hospital = organization.hospitals[0];
        if (!hospital)
            throw new common_1.NotFoundException('Hospital is not available');
        const doctor = await this.repository.findDoctor(doctorId, organization.id, hospital.id);
        if (!doctor)
            throw new common_1.BadRequestException('Selected doctor is unavailable');
        const start = this.boundDate(from, 0);
        const end = this.boundDate(to, 13, true);
        if (end.getTime() - start.getTime() > 14 * 24 * 60 * 60 * 1000)
            throw new common_1.BadRequestException('Slots can be requested for up to 14 days');
        const booked = new Set((await this.repository.findScheduledAppointments(doctor.id, start, end)).map((appointment) => appointment.scheduledAt.toISOString()));
        const slots = [];
        for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
            for (const availability of doctor.availability.filter((item) => item.dayOfWeek === cursor.getUTCDay())) {
                for (let time = this.atTime(cursor, availability.startTime); time < this.atTime(cursor, availability.endTime); time = new Date(time.getTime() + availability.slotMinutes * 60_000)) {
                    if (time > new Date() && !booked.has(time.toISOString()))
                        slots.push(time.toISOString());
                }
            }
        }
        return { doctorId: doctor.id, timezone: 'UTC', slots };
    }
    async requestBookingOtp(slug, dto, idempotencyKey) {
        const organization = await this.organization(slug);
        const hospital = organization.hospitals[0];
        if (!hospital)
            throw new common_1.NotFoundException('Hospital is not available');
        const scheduledAt = new Date(dto.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())
            throw new common_1.BadRequestException('Please select a future appointment time');
        const [doctor, conflict] = await Promise.all([this.repository.findDoctor(dto.doctorId, organization.id, hospital.id), this.repository.findAppointmentConflict(dto.doctorId, scheduledAt)]);
        if (!doctor || !this.isWithinAvailability(scheduledAt, doctor.availability))
            throw new common_1.BadRequestException('Selected appointment slot is unavailable');
        if (conflict)
            throw new common_1.ConflictException('This time is no longer available. Please select another slot.');
        if (idempotencyKey) {
            const existing = await this.repository.findPublicBookingByIdempotency(organization.id, idempotencyKey);
            if (existing && existing.status === client_1.PublicBookingStatus.PENDING_VERIFICATION && existing.otpExpiresAt > new Date())
                return { requestId: existing.id, expiresAt: existing.otpExpiresAt, message: 'A verification code was already sent for this request.' };
        }
        const otp = String((0, crypto_1.randomInt)(100000, 1_000_000));
        try {
            const request = await this.repository.createPublicBookingRequest({ data: { organization: { connect: { id: organization.id } }, hospital: { connect: { id: hospital.id } }, doctor: { connect: { id: doctor.id } }, firstName: dto.firstName, lastName: dto.lastName, email: dto.email.toLowerCase(), phone: dto.phone, dob: new Date(dto.dob), scheduledAt, reason: dto.reason, notes: dto.notes, consentAt: new Date(), otpHash: this.hash(otp), otpExpiresAt: new Date(Date.now() + 10 * 60_000), idempotencyKey } });
            await this.sms.sendOtp(dto.phone, otp, 'mobile_verification');
            return { requestId: request.id, expiresAt: request.otpExpiresAt, message: 'Enter the OTP sent to your mobile number to confirm this appointment.', otp: this.nonProductionValue(otp) };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencyKey) {
                const existing = await this.repository.findPublicBookingByIdempotency(organization.id, idempotencyKey);
                if (existing)
                    return { requestId: existing.id, expiresAt: existing.otpExpiresAt, message: 'A verification code was already sent for this request.' };
            }
            throw error;
        }
    }
    async confirmBooking(slug, requestId, dto) {
        const organization = await this.organization(slug);
        const request = await this.repository.findPublicBookingRequest(requestId, organization.id);
        if (!request || request.status !== client_1.PublicBookingStatus.PENDING_VERIFICATION)
            throw new common_1.BadRequestException('Booking verification request is invalid');
        if (request.otpExpiresAt <= new Date()) {
            await this.repository.expirePublicBookingRequest(request.id);
            throw new common_1.BadRequestException('Verification code has expired. Request a new appointment code.');
        }
        if (request.otpAttempts >= 5)
            throw new common_1.BadRequestException('Too many verification attempts. Request a new appointment code.');
        if (this.hash(dto.otp) !== request.otpHash) {
            await this.repository.recordOtpAttempt(request.id);
            throw new common_1.BadRequestException('Verification code is invalid');
        }
        if (!this.isWithinAvailability(request.scheduledAt, request.doctor.availability))
            throw new common_1.BadRequestException('Selected appointment slot is no longer available');
        try {
            const result = await this.repository.confirmPublicBooking(request.id, organization.id);
            if (!result)
                throw new common_1.BadRequestException('Booking verification request is invalid or expired');
            if ('conflict' in result)
                throw new common_1.ConflictException('This time is no longer available. Please select another slot.');
            await this.email.send(request.email, 'Your MediFlow appointment is confirmed', '/patient-login', '');
            return { id: result.appointment.id, scheduledAt: result.appointment.scheduledAt, patientMedicalRecord: result.patient.medicalRecord, message: 'Appointment confirmed. Use your medical record number and date of birth to access the patient portal.' };
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                throw new common_1.ConflictException('This time is no longer available. Please select another slot.');
            throw error;
        }
    }
    async enquiries(organizationId) { return this.repository.findEnquiries(organizationId); }
    async updateEnquiry(organizationId, id, status) { const result = await this.repository.updateEnquiry(id, organizationId, status); if (!result.count)
        throw new common_1.NotFoundException('Enquiry not found'); return this.enquiries(organizationId); }
    async organization(slug) { const organization = await this.repository.findOrganizationBySlug(slug); if (!organization)
        throw new common_1.NotFoundException('Hospital not found'); return organization; }
    hash(value) { return (0, crypto_1.createHash)('sha256').update(value).digest('hex'); }
    nonProductionValue(value) { return process.env.NODE_ENV === 'production' ? undefined : value; }
    isWithinAvailability(scheduledAt, availability) { const time = scheduledAt.toISOString().slice(11, 16); return availability.some((item) => item.dayOfWeek === scheduledAt.getUTCDay() && time >= item.startTime && time < item.endTime && ((this.minutes(time) - this.minutes(item.startTime)) % item.slotMinutes === 0)); }
    minutes(time) { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; }
    boundDate(input, defaultAdditionalDays, endOfDay = false) { const value = input ? new Date(input) : new Date(); if (Number.isNaN(value.getTime()))
        throw new common_1.BadRequestException('Invalid slot date range'); value.setUTCHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 0); if (!input)
        value.setUTCDate(value.getUTCDate() + defaultAdditionalDays); return value; }
    atTime(date, time) { const [hours, minutes] = time.split(':').map(Number); const result = new Date(date); result.setUTCHours(hours, minutes, 0, 0); return result; }
};
exports.PublicPortalService = PublicPortalService;
exports.PublicPortalService = PublicPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [public_portal_repository_1.PublicPortalRepository, email_service_1.AuthEmailService, sms_service_1.AuthSmsService])
], PublicPortalService);
