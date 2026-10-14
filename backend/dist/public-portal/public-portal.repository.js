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
exports.PublicPortalRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let PublicPortalRepository = class PublicPortalRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findOrganizationBySlug(slug) {
        return this.prisma.organization.findUnique({
            where: { slug },
            include: { hospitals: { orderBy: { createdAt: 'asc' } }, _count: { select: { patients: true, doctors: true, users: true } } },
        });
    }
    findDoctors(organizationId, hospitalId) { return this.prisma.doctor.findMany({ where: { organizationId, hospitalId }, select: { id: true, firstName: true, lastName: true, specialty: true, email: true, phone: true }, orderBy: [{ specialty: 'asc' }, { lastName: 'asc' }] }); }
    findDoctor(id, organizationId, hospitalId) { return this.prisma.doctor.findFirst({ where: { id, organizationId, hospitalId }, include: { availability: { where: { isActive: true } } } }); }
    findAppointmentConflict(doctorId, scheduledAt) { return this.prisma.appointment.findFirst({ where: { doctorId, scheduledAt, status: 'SCHEDULED' } }); }
    findScheduledAppointments(doctorId, from, to) { return this.prisma.appointment.findMany({ where: { doctorId, status: 'SCHEDULED', scheduledAt: { gte: from, lte: to } }, select: { scheduledAt: true } }); }
    findPatientByEmail(email, organizationId) { return this.prisma.patient.findFirst({ where: { email: email.toLowerCase(), organizationId } }); }
    createPatient(data) { return this.prisma.patient.create(data); }
    createAppointment(data) { return this.prisma.appointment.create(data); }
    createPublicBookingRequest(data) { return this.prisma.publicBookingRequest.create(data); }
    findPublicBookingByIdempotency(organizationId, idempotencyKey) { return this.prisma.publicBookingRequest.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } }); }
    findPublicBookingRequest(id, organizationId) { return this.prisma.publicBookingRequest.findFirst({ where: { id, organizationId }, include: { doctor: { include: { availability: { where: { isActive: true } } } } } }); }
    recordOtpAttempt(id) { return this.prisma.publicBookingRequest.update({ where: { id }, data: { otpAttempts: { increment: 1 } } }); }
    expirePublicBookingRequest(id) { return this.prisma.publicBookingRequest.update({ where: { id }, data: { status: client_1.PublicBookingStatus.EXPIRED } }); }
    async confirmPublicBooking(requestId, organizationId) {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.publicBookingRequest.findFirst({ where: { id: requestId, organizationId, status: client_1.PublicBookingStatus.PENDING_VERIFICATION, otpExpiresAt: { gt: new Date() } } });
            if (!request)
                return null;
            const conflict = await tx.appointment.findFirst({ where: { doctorId: request.doctorId, scheduledAt: request.scheduledAt, status: 'SCHEDULED' } });
            if (conflict)
                return { conflict: true };
            let patient = await tx.patient.findFirst({ where: { email: request.email, organizationId } });
            if (!patient)
                patient = await tx.patient.create({ data: { organizationId, firstName: request.firstName, lastName: request.lastName, email: request.email, phone: request.phone, dob: request.dob, medicalRecord: `MRN-${request.id.slice(0, 8).toUpperCase()}` } });
            const appointment = await tx.appointment.create({ data: { organizationId, hospitalId: request.hospitalId, patientId: patient.id, doctorId: request.doctorId, scheduledAt: request.scheduledAt, reason: request.reason, notes: request.notes, bookingChannel: 'WEB' } });
            await tx.publicBookingRequest.update({ where: { id: request.id }, data: { status: client_1.PublicBookingStatus.CONFIRMED, verifiedAt: new Date() } });
            return { appointment, patient };
        });
    }
    createEnquiry(data) { return this.prisma.enquiry.create(data); }
    findEnquiries(organizationId) { return this.prisma.enquiry.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, include: { hospital: { select: { name: true } } } }); }
    updateEnquiry(id, organizationId, status) { return this.prisma.enquiry.updateMany({ where: { id, organizationId }, data: { status } }); }
};
exports.PublicPortalRepository = PublicPortalRepository;
exports.PublicPortalRepository = PublicPortalRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublicPortalRepository);
