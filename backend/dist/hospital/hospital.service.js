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
exports.HospitalService = void 0;
const common_1 = require("@nestjs/common");
const hospital_ai_service_1 = require("./hospital-ai.service");
const hospital_repository_1 = require("./hospital.repository");
let HospitalService = class HospitalService {
    constructor(repository, aiService) {
        this.repository = repository;
        this.aiService = aiService;
    }
    async findAll(organizationId, hospitalId, platformAdmin = false) {
        if (platformAdmin)
            return this.repository.findAllPlatform();
        if (hospitalId)
            return (await this.repository.findOne(hospitalId, organizationId)) ? [await this.repository.findOne(hospitalId, organizationId)] : [];
        return this.repository.findAll(organizationId);
    }
    async findOne(id, organizationId) { return this.getHospital(id, organizationId); }
    create(dto, organizationId) { return this.repository.create(organizationId, dto); }
    async update(id, dto, organizationId) {
        await this.getHospital(id, organizationId);
        return this.repository.update(id, dto);
    }
    async remove(id, organizationId) {
        await this.getHospital(id, organizationId);
        return this.repository.remove(id);
    }
    async findKnowledge(id, organizationId) {
        await this.getHospital(id, organizationId);
        return this.repository.findKnowledge(id);
    }
    async createKnowledge(id, dto, organizationId) {
        await this.getHospital(id, organizationId);
        return this.repository.createKnowledge(id, dto);
    }
    async updateKnowledge(hospitalId, knowledgeId, dto, organizationId) {
        await this.getHospital(hospitalId, organizationId);
        await this.getKnowledge(knowledgeId, hospitalId);
        return this.repository.updateKnowledge(knowledgeId, dto);
    }
    async removeKnowledge(hospitalId, knowledgeId, organizationId) {
        await this.getHospital(hospitalId, organizationId);
        await this.getKnowledge(knowledgeId, hospitalId);
        return this.repository.deleteKnowledge(knowledgeId);
    }
    async assistant(id, question, organizationId) {
        const hospital = await this.getHospital(id, organizationId);
        const settings = hospital.aiSettings;
        if (settings && !settings.assistantEnabled)
            return { implementedAi: false, answer: 'The Hospital AI Assistant is disabled in settings.', source: null };
        return this.aiService.assistant(question, await this.repository.findKnowledge(id));
    }
    async analytics(id, organizationId) {
        const hospital = await this.getHospital(id, organizationId);
        if (hospital.aiSettings && !hospital.aiSettings.analyticsEnabled)
            return { implementedAi: false, message: 'AI analytics are disabled in settings.' };
        return this.aiService.analytics(await this.repository.operationalMetrics(organizationId));
    }
    async settingsRecommendation(id, organizationId) {
        const hospital = await this.getHospital(id, organizationId);
        if (hospital.aiSettings && !hospital.aiSettings.recommendationEnabled)
            return { implementedAi: false, message: 'AI recommendations are disabled in settings.' };
        return this.aiService.settingsRecommendation(await this.repository.operationalMetrics(organizationId));
    }
    async updateAiSettings(id, dto, organizationId) {
        await this.getHospital(id, organizationId);
        return this.repository.updateSettings(id, dto);
    }
    async getHospital(id, organizationId) {
        const hospital = await this.repository.findOne(id, organizationId);
        if (!hospital)
            throw new common_1.NotFoundException('Hospital not found');
        return hospital;
    }
    async getKnowledge(id, hospitalId) {
        const entry = await this.repository.findKnowledgeEntry(id, hospitalId);
        if (!entry)
            throw new common_1.NotFoundException('Knowledge entry not found');
        return entry;
    }
};
exports.HospitalService = HospitalService;
exports.HospitalService = HospitalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [hospital_repository_1.HospitalRepository, hospital_ai_service_1.HospitalAiService])
], HospitalService);
