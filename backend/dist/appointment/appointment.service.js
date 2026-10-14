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
var AppointmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_service_1 = require("../queue/queue.service");
let AppointmentService = AppointmentService_1 = class AppointmentService {
    constructor(prisma, queueService) {
        this.prisma = prisma;
        this.queueService = queueService;
        this.logger = new common_1.Logger(AppointmentService_1.name);
    }
    async findAll(organizationId) {
        return this.prisma.appointment.findMany({
            where: {
                organizationId,
            },
            include: {
                patient: true,
                doctor: true,
            },
        });
    }
    async findOne(id, organizationId) {
        const appointment = await this.prisma.appointment.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                patient: true,
                doctor: true,
            },
        });
        if (!appointment) {
            throw new common_1.NotFoundException('Appointment not found');
        }
        return appointment;
    }
    async create(dto, organizationId) {
        await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        if (dto.doctorId) {
            await this.ensureDoctorBelongsToOrganization(dto.doctorId, organizationId);
        }
        let created;
        try {
            created = await this.prisma.appointment.create({
                data: { ...dto, organizationId },
                include: { patient: true, doctor: true },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new common_1.ConflictException('The selected doctor already has an appointment at this time');
            }
            throw error;
        }
        try {
            await this.queueService.addAppointmentJob(created.id);
        }
        catch (err) {
            this.logger.error('Failed to enqueue appointment job', err instanceof Error ? err.stack : String(err));
        }
        return created;
    }
    async update(id, dto, organizationId) {
        await this.findOne(id, organizationId);
        if (dto.patientId) {
            await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        }
        if (dto.doctorId) {
            await this.ensureDoctorBelongsToOrganization(dto.doctorId, organizationId);
        }
        return this.prisma.appointment.update({
            where: {
                id,
            },
            data: dto,
            include: {
                patient: true,
                doctor: true,
            },
        });
    }
    async remove(id, organizationId) {
        await this.findOne(id, organizationId);
        return this.prisma.appointment.delete({
            where: {
                id,
            },
        });
    }
    calendar(organizationId, from, to) {
        return this.prisma.appointment.findMany({ where: { organizationId, scheduledAt: { gte: from, lte: to } }, include: { patient: true, doctor: true, hospital: true }, orderBy: { scheduledAt: 'asc' } });
    }
    async availability(doctorId, organizationId) {
        await this.ensureDoctorBelongsToOrganization(doctorId, organizationId);
        return this.prisma.doctorAvailability.findMany({ where: { doctorId, isActive: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    }
    async setAvailability(doctorId, organizationId, dto) {
        await this.ensureDoctorBelongsToOrganization(doctorId, organizationId);
        if (dto.startTime >= dto.endTime)
            throw new common_1.BadRequestException('Availability end time must be after the start time');
        return this.prisma.doctorAvailability.upsert({
            where: { doctorId_dayOfWeek_startTime: { doctorId, dayOfWeek: dto.dayOfWeek, startTime: dto.startTime } },
            update: { endTime: dto.endTime, slotMinutes: dto.slotMinutes ?? 15, isActive: dto.isActive ?? true },
            create: { doctorId, dayOfWeek: dto.dayOfWeek, startTime: dto.startTime, endTime: dto.endTime, slotMinutes: dto.slotMinutes ?? 15, isActive: dto.isActive ?? true },
        });
    }
    async waitlist(organizationId, dto) {
        await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        const hospital = await this.prisma.hospital.findFirst({ where: { id: dto.hospitalId, organizationId }, select: { id: true } });
        if (!hospital)
            throw new common_1.BadRequestException('Clinic does not belong to this organization');
        if (dto.doctorId)
            await this.ensureDoctorBelongsToOrganization(dto.doctorId, organizationId);
        return this.prisma.appointmentWaitlist.create({ data: { ...dto, preferredAt: new Date(dto.preferredAt), organizationId } });
    }
    getWaitlist(organizationId) {
        return this.prisma.appointmentWaitlist.findMany({ where: { organizationId }, include: { patient: true, doctor: true, hospital: true }, orderBy: { preferredAt: 'asc' } });
    }
    async reschedule(id, organizationId, dto) {
        await this.findOne(id, organizationId);
        const scheduledAt = new Date(dto.scheduledAt);
        if (scheduledAt <= new Date())
            throw new common_1.BadRequestException('Rescheduled time must be in the future');
        return this.prisma.appointment.update({ where: { id }, data: { scheduledAt }, include: { patient: true, doctor: true } });
    }
    async cancel(id, organizationId) {
        await this.findOne(id, organizationId);
        const cancelled = await this.prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED' }, include: { patient: true, doctor: true } });
        await this.prisma.appointmentAutomationEvent.create({ data: { appointmentId: id, channel: client_1.AppointmentBookingChannel.STAFF, eventType: 'cancellation', payload: 'Appointment cancelled; waiting-list offer can be initiated.' } });
        return cancelled;
    }
    async aiBook(organizationId, dto) {
        await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        const doctors = await this.prisma.doctor.findMany({ where: { organizationId, hospitalId: dto.hospitalId }, orderBy: { specialty: 'asc' } });
        if (!doctors.length)
            throw new common_1.BadRequestException('No doctors are configured for this clinic');
        const reason = dto.reason.toLowerCase();
        const specialty = reason.match(/skin|rash/) ? 'dermat' : reason.match(/child|baby/) ? 'pediatr' : reason.match(/heart|chest/) ? 'cardio' : 'general';
        const doctor = doctors.find((item) => item.specialty.toLowerCase().includes(specialty)) ?? doctors[0];
        const nextSlot = new Date();
        nextSlot.setMinutes(Math.ceil(nextSlot.getMinutes() / 15) * 15 + 30, 0, 0);
        const appointment = await this.prisma.appointment.create({ data: { organizationId, hospitalId: dto.hospitalId, patientId: dto.patientId, doctorId: doctor.id, scheduledAt: nextSlot, reason: dto.reason, bookingChannel: dto.channel ?? client_1.AppointmentBookingChannel.WEB, noShowRisk: this.noShowRisk(dto.reason), reminderAt: new Date(nextSlot.getTime() - 24 * 60 * 60_000), followUpDueAt: new Date(nextSlot.getTime() + 14 * 24 * 60 * 60_000) }, include: { doctor: true, patient: true } });
        await this.prisma.appointmentAutomationEvent.createMany({ data: [
                { appointmentId: appointment.id, channel: dto.channel ?? client_1.AppointmentBookingChannel.WEB, eventType: 'booking_confirmation', payload: `Booked with Dr. ${doctor.firstName} ${doctor.lastName}`, sentAt: new Date() },
                { appointmentId: appointment.id, channel: dto.channel ?? client_1.AppointmentBookingChannel.WEB, eventType: 'reminder', payload: 'Appointment reminder', scheduledAt: appointment.reminderAt },
                { appointmentId: appointment.id, channel: dto.channel ?? client_1.AppointmentBookingChannel.WEB, eventType: 'follow_up', payload: 'Follow-up check-in', scheduledAt: appointment.followUpDueAt },
            ] });
        return { appointment, ai: { recommendedDoctor: `${doctor.firstName} ${doctor.lastName}`, noShowRisk: appointment.noShowRisk, smartSchedulingReason: 'Earliest 15-minute slot selected from clinic routing rules.' } };
    }
    /**
     * Books an incoming, provider-verified call against an existing patient only.
     * Historic records stay in the database and are never returned to the caller.
     */
    async bookVerifiedVoiceCall(dto) {
        const existing = await this.prisma.appointment.findFirst({
            where: { organizationId: dto.organizationId, providerCallId: dto.providerCallId },
            include: { doctor: true, patient: { select: { clinicalRecords: { select: { id: true }, take: 1 } } } },
        });
        if (existing)
            return this.voiceBookingResult(existing, existing.patient.clinicalRecords.length > 0, true);
        const patients = await this.prisma.patient.findMany({
            where: { organizationId: dto.organizationId, phone: { in: this.phoneCandidates(dto.callerPhone) } },
            select: { id: true, medicalRecord: true, clinicalRecords: { select: { id: true }, take: 1 } },
            take: 2,
        });
        if (!patients.length) {
            throw new common_1.NotFoundException('No existing patient matches this verified caller number. Create the patient through the reception workflow before booking.');
        }
        if (patients.length > 1) {
            throw new common_1.ConflictException('More than one patient matches this caller number. Reception verification is required before booking.');
        }
        const patient = patients[0];
        const hospital = await this.prisma.hospital.findFirst({
            where: { id: dto.hospitalId, organizationId: dto.organizationId },
            select: { id: true },
        });
        if (!hospital)
            throw new common_1.BadRequestException('Clinic does not belong to this organization');
        const doctors = await this.prisma.doctor.findMany({
            where: { organizationId: dto.organizationId, hospitalId: dto.hospitalId },
            include: { availability: { where: { isActive: true } } },
            orderBy: { specialty: 'asc' },
        });
        if (!doctors.length)
            throw new common_1.BadRequestException('No doctors are configured for this clinic');
        const reason = dto.reason.toLowerCase();
        const specialty = reason.match(/skin|rash/) ? 'dermat' : reason.match(/child|baby/) ? 'pediatr' : reason.match(/heart|chest/) ? 'cardio' : 'general';
        const rankedDoctors = [...doctors].sort((a, b) => Number(!a.specialty.toLowerCase().includes(specialty)) - Number(!b.specialty.toLowerCase().includes(specialty)));
        const earliest = dto.requestedAt ? new Date(dto.requestedAt) : new Date();
        const slot = await this.findEarliestAvailableSlot(rankedDoctors, earliest);
        if (!slot)
            throw new common_1.ConflictException('No available appointment slot was found in the next 30 days');
        try {
            const appointment = await this.prisma.$transaction(async (tx) => {
                const created = await tx.appointment.create({
                    data: {
                        organizationId: dto.organizationId, hospitalId: dto.hospitalId, patientId: patient.id, doctorId: slot.doctorId,
                        scheduledAt: slot.scheduledAt, reason: dto.reason, bookingChannel: client_1.AppointmentBookingChannel.VOICE, providerCallId: dto.providerCallId,
                        noShowRisk: this.noShowRisk(dto.reason), reminderAt: new Date(slot.scheduledAt.getTime() - 24 * 60 * 60_000), followUpDueAt: new Date(slot.scheduledAt.getTime() + 14 * 24 * 60 * 60_000),
                    }, include: { doctor: true },
                });
                await tx.appointmentAutomationEvent.create({ data: { appointmentId: created.id, channel: client_1.AppointmentBookingChannel.VOICE, eventType: 'voice_booking_confirmation', payload: `Provider call ${dto.providerCallId}`, sentAt: new Date() } });
                return created;
            });
            return this.voiceBookingResult(appointment, patient.clinicalRecords.length > 0, false);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const retry = await this.prisma.appointment.findFirst({ where: { organizationId: dto.organizationId, providerCallId: dto.providerCallId }, include: { doctor: true, patient: { select: { clinicalRecords: { select: { id: true }, take: 1 } } } } });
                if (retry)
                    return this.voiceBookingResult(retry, retry.patient.clinicalRecords.length > 0, true);
                throw new common_1.ConflictException('That slot was just booked. Ask the caller to try again for the next available slot.');
            }
            throw error;
        }
    }
    async analytics(organizationId) {
        const [appointments, cancelled, completed, waitlist] = await Promise.all([
            this.prisma.appointment.count({ where: { organizationId } }), this.prisma.appointment.count({ where: { organizationId, status: 'CANCELLED' } }), this.prisma.appointment.count({ where: { organizationId, status: 'COMPLETED' } }), this.prisma.appointmentWaitlist.count({ where: { organizationId, status: 'WAITING' } }),
        ]);
        return { implementedAi: true, appointments, cancelled, completed, waitingList: waitlist, cancellationRate: appointments ? Math.round(cancelled / appointments * 100) : 0, recommendation: waitlist ? 'Offer newly cancelled slots to waitlisted patients automatically.' : 'Monitor no-show risk and reminder delivery before peak hours.' };
    }
    async noShowPrediction(id, organizationId) {
        const appointment = await this.findOne(id, organizationId);
        const daysUntilVisit = Math.max(0, Math.ceil((appointment.scheduledAt.getTime() - Date.now()) / 86_400_000));
        const score = Math.min(0.95, appointment.noShowRisk + (daysUntilVisit > 14 ? 0.1 : 0));
        await this.prisma.appointment.update({ where: { id }, data: { noShowRisk: score } });
        return { implementedAi: true, noShowRisk: score, level: score >= 0.5 ? 'HIGH' : score >= 0.25 ? 'MEDIUM' : 'LOW', action: score >= 0.5 ? 'Send WhatsApp and voice confirmation now.' : 'Keep the scheduled reminder workflow active.' };
    }
    async waitTimePrediction(id, organizationId) {
        const appointment = await this.findOne(id, organizationId);
        if (!appointment.doctorId || !appointment.hospitalId || !appointment.queueDate || !appointment.tokenNumber)
            return { implementedAi: true, estimatedWaitMinutes: 0, message: 'Queue token is not assigned for this appointment.' };
        const ahead = await this.prisma.appointment.findMany({ where: { hospitalId: appointment.hospitalId, doctorId: appointment.doctorId, queueDate: appointment.queueDate, tokenNumber: { lt: appointment.tokenNumber }, status: 'SCHEDULED' }, select: { expectedDurationMinutes: true } });
        const estimatedWaitMinutes = ahead.reduce((sum, item) => sum + item.expectedDurationMinutes, 0);
        return { implementedAi: true, tokenNumber: appointment.tokenNumber, patientsAhead: ahead.length, estimatedWaitMinutes, estimatedConsultationAt: new Date(Math.max(Date.now(), appointment.scheduledAt.getTime()) + estimatedWaitMinutes * 60_000) };
    }
    noShowRisk(reason) { return reason.trim().length < 8 ? 0.45 : 0.15; }
    voiceBookingResult(appointment, hasMedicalHistory, idempotentReplay) {
        return { appointment: { id: appointment.id, scheduledAt: appointment.scheduledAt, doctor: appointment.doctor ? `${appointment.doctor.firstName} ${appointment.doctor.lastName}` : null }, patient: { matchedExistingRecord: true, hasMedicalHistory }, idempotentReplay };
    }
    phoneCandidates(phone) {
        const digits = phone.replace(/\D/g, '');
        const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
        return [...new Set([phone, digits, local, `+${digits}`, `+91${local}`])];
    }
    async findEarliestAvailableSlot(doctors, earliest) {
        const start = new Date(Math.max(earliest.getTime(), Date.now()));
        let best;
        for (const doctor of doctors) {
            for (let offset = 0; offset <= 30; offset += 1) {
                const day = new Date(start);
                day.setDate(start.getDate() + offset);
                day.setHours(0, 0, 0, 0);
                const rules = doctor.availability.filter((item) => item.dayOfWeek === day.getDay());
                for (const rule of rules) {
                    const [startHour, startMinute] = rule.startTime.split(':').map(Number);
                    const [endHour, endMinute] = rule.endTime.split(':').map(Number);
                    const cursor = new Date(day);
                    cursor.setHours(startHour, startMinute, 0, 0);
                    const end = new Date(day);
                    end.setHours(endHour, endMinute, 0, 0);
                    while (cursor < end) {
                        const candidate = new Date(cursor);
                        cursor.setMinutes(cursor.getMinutes() + rule.slotMinutes);
                        if (candidate < start || candidate >= end || (best && candidate >= best.scheduledAt))
                            continue;
                        const conflict = await this.prisma.appointment.findFirst({ where: { doctorId: doctor.id, scheduledAt: candidate, status: 'SCHEDULED' }, select: { id: true } });
                        if (!conflict)
                            best = { doctorId: doctor.id, scheduledAt: candidate };
                    }
                }
            }
        }
        return best;
    }
    async ensurePatientBelongsToOrganization(patientId, organizationId) {
        const patient = await this.prisma.patient.findFirst({
            where: { id: patientId, organizationId },
            select: { id: true },
        });
        if (!patient) {
            throw new common_1.BadRequestException('Patient does not belong to this organization');
        }
    }
    async ensureDoctorBelongsToOrganization(doctorId, organizationId) {
        const doctor = await this.prisma.doctor.findFirst({
            where: { id: doctorId, organizationId },
            select: { id: true },
        });
        if (!doctor) {
            throw new common_1.BadRequestException('Doctor does not belong to this organization');
        }
    }
};
exports.AppointmentService = AppointmentService;
exports.AppointmentService = AppointmentService = AppointmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_service_1.QueueService])
], AppointmentService);
