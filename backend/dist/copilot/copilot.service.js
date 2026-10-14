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
exports.CopilotService = void 0;
const common_1 = require("@nestjs/common");
const appointment_service_1 = require("../appointment/appointment.service");
const prisma_service_1 = require("../prisma/prisma.service");
let CopilotService = class CopilotService {
    constructor(prisma, appointments) {
        this.prisma = prisma;
        this.appointments = appointments;
    }
    async message(message, organizationId, userId) {
        const normalized = message.trim().toLowerCase();
        let response;
        if (/\b(book|schedule|create)\b.*\b(appointment|visit|consultation)\b|\bappointment\b.*\b(book|schedule|create)\b/.test(normalized)) {
            response = { answer: 'I can create this appointment. Select the patient, clinician, time, and visit reason below, then I will submit it to the live schedule.', intent: 'BOOK_APPOINTMENT', action: { type: 'BOOK_APPOINTMENT' } };
        }
        else if (/\b(find|search|look up|lookup)\b.*\b(patient)\b|\bpatient\b.*\b(find|search|look up|lookup)\b/.test(normalized)) {
            const term = this.searchTerm(message, 'patient');
            const patients = term ? await this.prisma.patient.findMany({
                where: { organizationId, OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { medicalRecord: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] },
                select: { id: true, firstName: true, lastName: true, medicalRecord: true, phone: true }, take: 5, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            }) : [];
            response = { answer: term ? (patients.length ? `I found ${patients.length} matching patient record${patients.length === 1 ? '' : 's'}.` : `No patient records match “${term}”.`) : 'Tell me the patient name, medical-record number, or phone number to search.', intent: 'SEARCH_PATIENT', data: patients };
        }
        else if (/\b(find|search|look up|lookup)\b.*\b(doctor|clinician)\b|\b(doctor|clinician)\b.*\b(find|search|look up|lookup)\b/.test(normalized)) {
            const term = this.searchTerm(message, 'doctor|clinician');
            const doctors = term ? await this.prisma.doctor.findMany({
                where: { organizationId, OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { specialty: { contains: term, mode: 'insensitive' } }] },
                select: { id: true, firstName: true, lastName: true, specialty: true }, take: 5, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            }) : [];
            response = { answer: term ? (doctors.length ? `I found ${doctors.length} matching clinician${doctors.length === 1 ? '' : 's'}.` : `No clinicians match “${term}”.`) : 'Tell me the clinician name or specialty to search.', intent: 'SEARCH_DOCTOR', data: doctors };
        }
        else if (/\b(summary|dashboard|operations|pending bill|today)\b/.test(normalized)) {
            const [patients, doctors, scheduled, completed, pending] = await Promise.all([
                this.prisma.patient.count({ where: { organizationId } }),
                this.prisma.doctor.count({ where: { organizationId } }),
                this.prisma.appointment.count({ where: { organizationId, status: 'SCHEDULED' } }),
                this.prisma.appointment.count({ where: { organizationId, status: 'COMPLETED' } }),
                this.prisma.billingRecord.aggregate({ where: { organizationId, status: 'PENDING' }, _count: { _all: true }, _sum: { amount: true } }),
            ]);
            response = { answer: `Operations summary: ${patients} patients, ${doctors} clinicians, ${scheduled} scheduled visits, ${completed} completed visits, and ${pending._count._all} pending invoice${pending._count._all === 1 ? '' : 's'} worth ₹${(pending._sum.amount ?? 0).toLocaleString('en-IN')}.`, intent: 'OPERATIONS_SUMMARY', data: { patients, doctors, scheduled, completed, pendingInvoices: pending._count._all, pendingAmount: pending._sum.amount ?? 0 } };
        }
        else {
            const knowledge = await this.prisma.hospitalKnowledgeEntry.findMany({ where: { hospital: { organizationId } }, select: { title: true, category: true, content: true }, orderBy: { updatedAt: 'desc' }, take: 50 });
            const tokens = normalized.split(/\W+/).filter((word) => word.length > 3);
            const match = knowledge.find((entry) => tokens.some((word) => `${entry.title} ${entry.category} ${entry.content}`.toLowerCase().includes(word)));
            response = match
                ? { answer: `${match.content} Source: ${match.title}.`, intent: 'KNOWLEDGE', data: { source: { title: match.title, category: match.category } } }
                : { answer: 'I can search patients and clinicians, summarize operations, answer from approved hospital knowledge, or create an appointment. Try “find patient Priya”, “find doctor cardiology”, “operations summary”, or “book an appointment”.', intent: 'HELP' };
        }
        await this.prisma.auditLog.create({ data: { organizationId, userId, action: 'COPILOT_MESSAGE', entityType: 'CopilotInteraction', metadata: { intent: response.intent } } });
        return response;
    }
    async bookAppointment(dto, organizationId, userId) {
        const appointment = await this.appointments.create(dto, organizationId);
        await this.prisma.auditLog.create({ data: { organizationId, userId, action: 'COPILOT_BOOK_APPOINTMENT', entityType: 'Appointment', entityId: appointment.id, metadata: { patientId: dto.patientId, doctorId: dto.doctorId } } });
        return appointment;
    }
    searchTerm(message, subject) {
        const escapedSubject = subject.replace('|', '|');
        const result = message.replace(new RegExp(`.*?(?:find|search|look up|lookup)\\s+(?:${escapedSubject})\\s*`, 'i'), '').trim();
        return result.replace(/^(named|for)\s+/i, '').trim();
    }
};
exports.CopilotService = CopilotService;
exports.CopilotService = CopilotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, appointment_service_1.AppointmentService])
], CopilotService);
