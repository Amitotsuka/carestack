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
exports.PatientPortalRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PatientPortalRepository = class PatientPortalRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findPatientForLogin(medicalRecord, dob) {
        return this.prisma.patient.findFirst({
            where: {
                medicalRecord,
                dob,
            },
        });
    }
    findMedicalRecords(patientId, organizationId) {
        return this.prisma.medicalRecord.findMany({
            where: { patientId, organizationId },
            orderBy: { recordedAt: 'desc' },
        });
    }
    findPatient(id, organizationId) {
        return this.prisma.patient.findFirst({
            where: {
                id,
                organizationId,
            },
        });
    }
    findHospitals(organizationId) {
        return this.prisma.hospital.findMany({ where: { organizationId }, select: { id: true, name: true, address: true, phone: true }, orderBy: { name: 'asc' } });
    }
    findHospital(id, organizationId) {
        return this.prisma.hospital.findFirst({ where: { id, organizationId }, select: { id: true } });
    }
    findDoctors(organizationId, hospitalId) {
        return this.prisma.doctor.findMany({
            where: { organizationId, hospitalId },
            select: { id: true, firstName: true, lastName: true, specialty: true },
            orderBy: [{ specialty: 'asc' }, { lastName: 'asc' }],
        });
    }
    findDoctor(id, organizationId, hospitalId) {
        return this.prisma.doctor.findFirst({ where: { id, organizationId, hospitalId }, select: { id: true, specialty: true, firstName: true, lastName: true } });
    }
    findConflictingAppointment(doctorId, scheduledAt) {
        return this.prisma.appointment.findFirst({ where: { doctorId, scheduledAt, status: 'SCHEDULED' }, select: { id: true } });
    }
    createPatientAppointment(data) {
        const queueDate = new Date(data.scheduledAt);
        queueDate.setHours(0, 0, 0, 0);
        return this.prisma.$transaction(async (tx) => {
            const counter = await tx.queueTokenCounter.upsert({
                where: { hospitalId_queueDate: { hospitalId: data.hospitalId, queueDate } },
                create: { hospitalId: data.hospitalId, queueDate, nextNumber: 2 },
                update: { nextNumber: { increment: 1 } },
            });
            const tokenNumber = counter.nextNumber - 1;
            const estimatedAt = new Date(data.scheduledAt.getTime() + (tokenNumber - 1) * 15 * 60_000);
            return tx.appointment.create({ data: { ...data, queueDate, tokenNumber, estimatedAt }, include: { doctor: true, hospital: true } });
        });
    }
    findPatientAppointment(id, patientId, organizationId) {
        return this.prisma.appointment.findFirst({ where: { id, patientId, organizationId }, select: { id: true, status: true, scheduledAt: true } });
    }
    cancelPatientAppointment(id) {
        return this.prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED' }, include: { doctor: true } });
    }
    findQueueAppointment(id, patientId, organizationId) {
        return this.prisma.appointment.findFirst({
            where: { id, patientId, organizationId },
            select: { id: true, hospitalId: true, doctorId: true, queueDate: true, tokenNumber: true, scheduledAt: true, status: true, expectedDurationMinutes: true },
        });
    }
    findQueueAhead(appointment) {
        if (!appointment.hospitalId || !appointment.doctorId || !appointment.queueDate || !appointment.tokenNumber)
            return Promise.resolve([]);
        return this.prisma.appointment.findMany({
            where: {
                hospitalId: appointment.hospitalId, doctorId: appointment.doctorId, queueDate: appointment.queueDate,
                tokenNumber: { lt: appointment.tokenNumber }, status: 'SCHEDULED',
            },
            select: { expectedDurationMinutes: true },
        });
    }
    findAppointments(patientId, organizationId) {
        return this.prisma.appointment.findMany({
            where: {
                patientId,
                organizationId,
            },
            include: {
                doctor: true,
            },
            orderBy: {
                scheduledAt: 'asc',
            },
        });
    }
    findBilling(patientId, organizationId) {
        return this.prisma.billingRecord.findMany({
            where: {
                patientId,
                organizationId,
            },
            include: {
                appointment: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
};
exports.PatientPortalRepository = PatientPortalRepository;
exports.PatientPortalRepository = PatientPortalRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PatientPortalRepository);
