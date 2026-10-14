"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientPortalAiService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PatientPortalAiService = class PatientPortalAiService {
    recommendDoctor(reason, doctors) {
        const text = reason.toLowerCase();
        const keywordSpecialty = text.match(/skin|rash|derma/) ? 'dermatology'
            : text.match(/child|pediatric|baby/) ? 'pediatrics'
                : text.match(/heart|chest|cardiac/) ? 'cardiology'
                    : 'general medicine';
        const recommended = doctors.find((doctor) => doctor.specialty.toLowerCase().includes(keywordSpecialty)) ?? doctors[0];
        return {
            implementedAi: true,
            recommendedDoctorId: recommended?.id ?? null,
            summary: recommended
                ? `Based on your visit reason, Dr. ${recommended.firstName} ${recommended.lastName} (${recommended.specialty}) is a suitable starting point.`
                : 'No clinician is currently configured for this clinic. Please select another clinic or contact reception.',
            safetyNote: 'This recommendation supports appointment routing only and is not a medical diagnosis.',
        };
    }
    generateInsights(input) {
        const now = new Date();
        const upcomingAppointments = input.appointments.filter((appointment) => appointment.scheduledAt >= now);
        const pendingBills = input.billing.filter((bill) => bill.status === client_1.BillingStatus.PENDING);
        const pendingAmount = pendingBills.reduce((total, bill) => total + bill.amount, 0);
        const nextAppointment = upcomingAppointments[0];
        const allergies = [...new Set(input.medicalRecords.flatMap((record) => record.allergies))];
        const medications = [...new Set(input.medicalRecords.flatMap((record) => record.medications))];
        return {
            canAiAutomateThisTask: true,
            canAiReduceManpower: true,
            canAiImprovePatientExperience: true,
            canAiIncreaseHospitalRevenue: pendingAmount > 0,
            canAiReduceWaitingTime: true,
            canAiMakeBetterDecisions: true,
            implementedAi: true,
            summary: this.buildSummary(nextAppointment, pendingBills.length, pendingAmount),
            recommendedActions: this.buildActions(nextAppointment, pendingBills.length, allergies, medications),
            automation: [
                'AI can remind patients about appointments and documents before arrival.',
                'AI can highlight pending bills before discharge or follow-up visits.',
                'AI can route patients to reception, billing, or consultation based on current status.',
                'AI can flag recorded allergies and medication reconciliation items for care-team review.',
            ],
        };
    }
    buildSummary(nextAppointment, pendingBillCount, pendingAmount) {
        if (nextAppointment && pendingBillCount > 0) {
            return `Upcoming ${nextAppointment.reason} visit found. ${pendingBillCount} pending bill(s) need attention, totaling ${pendingAmount}.`;
        }
        if (nextAppointment) {
            return `Upcoming ${nextAppointment.reason} visit found. No pending billing action is currently required.`;
        }
        if (pendingBillCount > 0) {
            return `${pendingBillCount} pending bill(s) need attention, totaling ${pendingAmount}.`;
        }
        return 'No immediate appointment or billing action is required.';
    }
    buildActions(nextAppointment, pendingBillCount, allergies, medications) {
        const actions = [];
        if (nextAppointment) {
            actions.push('Arrive 15 minutes early and keep your medical record number ready.');
        }
        else {
            actions.push('Book a follow-up or wellness visit directly from the patient portal if you need care.');
        }
        if (pendingBillCount > 0) {
            actions.push('Visit billing before or after consultation to clear pending payments.');
        }
        if (allergies.length > 0) {
            actions.push(`Ask your care team to confirm your recorded allergy: ${allergies.join(', ')}.`);
        }
        if (medications.length > 0) {
            actions.push(`Bring an up-to-date medication list; our record includes ${medications.join(', ')}.`);
        }
        if (!actions.length) {
            actions.push('Keep your profile contact details updated for future hospital reminders.');
        }
        return actions;
    }
};
exports.PatientPortalAiService = PatientPortalAiService;
exports.PatientPortalAiService = PatientPortalAiService = __decorate([
    (0, common_1.Injectable)()
], PatientPortalAiService);
