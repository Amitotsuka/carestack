"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalAiService = void 0;
const common_1 = require("@nestjs/common");
let HospitalAiService = class HospitalAiService {
    assistant(question, knowledge) {
        const normalizedQuestion = question.toLowerCase();
        const match = knowledge.find((entry) => `${entry.title} ${entry.category} ${entry.content}`.toLowerCase()
            .split(/\W+/).some((word) => word.length > 3 && normalizedQuestion.includes(word)));
        return {
            implementedAi: true,
            answer: match
                ? `${match.content} Source: ${match.title}.`
                : 'I could not find a matching approved hospital procedure. Please confirm the next step with the hospital administrator.',
            source: match ? { title: match.title, category: match.category } : null,
            safetyNote: 'This assistant provides operational guidance only; it does not provide clinical diagnosis or emergency advice.',
        };
    }
    analytics(metrics) {
        const completionRate = metrics.appointments ? Math.round((metrics.completed / metrics.appointments) * 100) : 0;
        const recommendations = [];
        if (metrics.scheduled > metrics.completed)
            recommendations.push('Use automated reminders to reduce no-shows and balance the scheduled queue.');
        if (metrics.pendingBills > 0)
            recommendations.push('Prioritize billing follow-up for pending balances to improve collection speed.');
        if (metrics.doctors === 0)
            recommendations.push('Add clinician capacity before opening appointment slots.');
        if (!recommendations.length)
            recommendations.push('Operational indicators are stable; review demand weekly before changing capacity.');
        return {
            implementedAi: true, scope: 'Organization-level operational data; appointments are not currently assigned to a facility.',
            metrics: { ...metrics, completionRate }, recommendations,
            canAiAutomateThisTask: true, canAiReduceManpower: true, canAiImprovePatientExperience: true,
            canAiIncreaseHospitalRevenue: metrics.pendingBills > 0, canAiReduceWaitingTime: true, canAiMakeBetterDecisions: true,
        };
    }
    settingsRecommendation(metrics) {
        return {
            implementedAi: true,
            assistantEnabled: true,
            analyticsEnabled: true,
            recommendationEnabled: true,
            responseTone: 'professional',
            reason: metrics.scheduled > 0 || metrics.pendingBills > 0
                ? 'Enable reminders and analytics to guide the active appointment and billing workflow.'
                : 'Keep the assistant enabled so approved hospital processes remain available as operations scale.',
        };
    }
};
exports.HospitalAiService = HospitalAiService;
exports.HospitalAiService = HospitalAiService = __decorate([
    (0, common_1.Injectable)()
], HospitalAiService);
