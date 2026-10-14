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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientPortalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_1 = require("@nestjs/jwt");
const patient_portal_ai_service_1 = require("./patient-portal-ai.service");
const patient_portal_repository_1 = require("./patient-portal.repository");
let PatientPortalService = class PatientPortalService {
    constructor(repository, jwtService, aiService) {
        this.repository = repository;
        this.jwtService = jwtService;
        this.aiService = aiService;
    }
    async login(dto) {
        const patient = await this.repository.findPatientForLogin(dto.medicalRecord, new Date(dto.dob));
        if (!patient) {
            throw new common_1.UnauthorizedException('Invalid medical record or date of birth');
        }
        const payload = {
            sub: patient.id,
            patientId: patient.id,
            organizationId: patient.organizationId,
            email: patient.email ?? undefined,
            role: 'PATIENT',
        };
        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: patient.id,
                patientId: patient.id,
                organizationId: patient.organizationId,
                email: patient.email,
                role: 'PATIENT',
            },
        };
    }
    async getOverview(patientId, organizationId) {
        const patient = await this.getPatient(patientId, organizationId);
        const [appointments, billing, medicalRecords] = await Promise.all([
            this.repository.findAppointments(patientId, organizationId),
            this.repository.findBilling(patientId, organizationId),
            this.repository.findMedicalRecords(patientId, organizationId),
        ]);
        return {
            patient,
            appointments,
            billing,
            medicalRecords,
            ai: this.aiService.generateInsights({ appointments, billing, medicalRecords }),
        };
    }
    async getDoctors(patientId, organizationId) {
        await this.getPatient(patientId, organizationId);
        return this.repository.findHospitals(organizationId);
    }
    async getClinicDoctors(patientId, organizationId, hospitalId) {
        await this.getPatient(patientId, organizationId);
        await this.ensureHospital(hospitalId, organizationId);
        return this.repository.findDoctors(organizationId, hospitalId);
    }
    async recommendBooking(patientId, organizationId, hospitalId, reason) {
        await this.getPatient(patientId, organizationId);
        await this.ensureHospital(hospitalId, organizationId);
        return this.aiService.recommendDoctor(reason, await this.repository.findDoctors(organizationId, hospitalId));
    }
    async bookAppointment(patientId, organizationId, dto) {
        await this.getPatient(patientId, organizationId);
        const scheduledAt = new Date(dto.scheduledAt);
        if (scheduledAt <= new Date())
            throw new common_1.BadRequestException('Please choose a future appointment time');
        const [doctor, conflict] = await Promise.all([
            this.repository.findDoctor(dto.doctorId, organizationId, dto.hospitalId),
            this.repository.findConflictingAppointment(dto.doctorId, scheduledAt),
        ]);
        if (!doctor)
            throw new common_1.BadRequestException('Selected doctor is not available');
        if (conflict)
            throw new common_1.BadRequestException('This appointment time is no longer available. Please choose another time.');
        await this.ensureHospital(dto.hospitalId, organizationId);
        try {
            return await this.repository.createPatientAppointment({ patientId, organizationId, hospitalId: dto.hospitalId, doctorId: dto.doctorId, scheduledAt, reason: dto.reason, notes: dto.notes });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new common_1.ConflictException('This appointment time is no longer available. Please choose another time.');
            }
            throw error;
        }
    }
    async cancelAppointment(patientId, organizationId, appointmentId) {
        const appointment = await this.repository.findPatientAppointment(appointmentId, patientId, organizationId);
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        if (appointment.status !== 'SCHEDULED')
            throw new common_1.BadRequestException('Only scheduled appointments can be cancelled');
        if (appointment.scheduledAt <= new Date())
            throw new common_1.BadRequestException('Past appointments cannot be cancelled');
        return this.repository.cancelPatientAppointment(appointmentId);
    }
    async getQueueStatus(patientId, organizationId, appointmentId) {
        const appointment = await this.repository.findQueueAppointment(appointmentId, patientId, organizationId);
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        const ahead = await this.repository.findQueueAhead(appointment);
        const estimatedWaitMinutes = ahead.reduce((total, item) => total + item.expectedDurationMinutes, 0);
        const estimatedConsultationAt = new Date(Math.max(appointment.scheduledAt.getTime(), Date.now()) + estimatedWaitMinutes * 60_000);
        return {
            implementedAi: true,
            tokenNumber: appointment.tokenNumber,
            patientsAhead: ahead.length,
            estimatedWaitMinutes,
            estimatedConsultationAt,
            message: ahead.length
                ? `There are ${ahead.length} patient(s) ahead. Your AI-estimated wait is about ${estimatedWaitMinutes} minutes.`
                : 'You are next in the active queue. Please remain available for the care team.',
            advice: estimatedWaitMinutes > 20 ? 'You can arrive closer to the estimated time; check this status again before leaving.' : 'Please arrive 15 minutes before your appointment for check-in.',
        };
    }
    async getPatient(patientId, organizationId) {
        const patient = await this.repository.findPatient(patientId, organizationId);
        if (!patient) {
            throw new common_1.NotFoundException('Patient not found');
        }
        return patient;
    }
    async ensureHospital(hospitalId, organizationId) {
        if (!await this.repository.findHospital(hospitalId, organizationId))
            throw new common_1.BadRequestException('Selected clinic is not available');
    }
};
exports.PatientPortalService = PatientPortalService;
exports.PatientPortalService = PatientPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [patient_portal_repository_1.PatientPortalRepository, typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object, patient_portal_ai_service_1.PatientPortalAiService])
], PatientPortalService);
