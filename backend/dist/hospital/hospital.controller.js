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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const hospital_service_1 = require("./hospital.service");
const create_hospital_dto_1 = require("./dto/create-hospital.dto");
const update_hospital_dto_1 = require("./dto/update-hospital.dto");
const create_knowledge_entry_dto_1 = require("./dto/create-knowledge-entry.dto");
const update_knowledge_entry_dto_1 = require("./dto/update-knowledge-entry.dto");
const hospital_assistant_dto_1 = require("./dto/hospital-assistant.dto");
const update_hospital_ai_settings_dto_1 = require("./dto/update-hospital-ai-settings.dto");
let HospitalController = class HospitalController {
    constructor(hospitalService) {
        this.hospitalService = hospitalService;
    }
    findAll(req) { return this.hospitalService.findAll(req.user.organizationId, req.user.hospitalId, req.user.role === 'SUPER_ADMIN'); }
    findOne(id, req) { this.assertAssignedHospital(id, req); return this.hospitalService.findOne(id, req.user.organizationId); }
    create(body, req) { return this.hospitalService.create(body, req.user.organizationId); }
    update(id, body, req) { this.assertAssignedHospital(id, req); return this.hospitalService.update(id, body, req.user.organizationId); }
    remove(id, req) { return this.hospitalService.remove(id, req.user.organizationId); }
    knowledge(id, req) { this.assertAssignedHospital(id, req); return this.hospitalService.findKnowledge(id, req.user.organizationId); }
    createKnowledge(id, body, req) { this.assertAssignedHospital(id, req); return this.hospitalService.createKnowledge(id, body, req.user.organizationId); }
    updateKnowledge(id, knowledgeId, body, req) { this.assertAssignedHospital(id, req); return this.hospitalService.updateKnowledge(id, knowledgeId, body, req.user.organizationId); }
    removeKnowledge(id, knowledgeId, req) { this.assertAssignedHospital(id, req); return this.hospitalService.removeKnowledge(id, knowledgeId, req.user.organizationId); }
    assistant(id, body, req) { this.assertAssignedHospital(id, req); return this.hospitalService.assistant(id, body.question, req.user.organizationId); }
    analytics(id, req) { this.assertAssignedHospital(id, req); return this.hospitalService.analytics(id, req.user.organizationId); }
    settingsRecommendation(id, req) { this.assertAssignedHospital(id, req); return this.hospitalService.settingsRecommendation(id, req.user.organizationId); }
    updateSettings(id, body, req) { this.assertAssignedHospital(id, req); return this.hospitalService.updateAiSettings(id, body, req.user.organizationId); }
    assertAssignedHospital(id, req) {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.hospitalId !== id)
            throw new common_1.ForbiddenException('Hospital admins can only manage their assigned clinic');
    }
};
exports.HospitalController = HospitalController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _a : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_b = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    (0, swagger_1.ApiBody)({ type: create_hospital_dto_1.CreateHospitalDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_hospital_dto_1.CreateHospitalDto, typeof (_c = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, swagger_1.ApiBody)({ type: update_hospital_dto_1.UpdateHospitalDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_hospital_dto_1.UpdateHospitalDto, typeof (_d = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/knowledge'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_f = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "knowledge", null);
__decorate([
    (0, common_1.Post)(':id/knowledge'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, swagger_1.ApiBody)({ type: create_knowledge_entry_dto_1.CreateKnowledgeEntryDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_knowledge_entry_dto_1.CreateKnowledgeEntryDto, typeof (_g = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _g : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "createKnowledge", null);
__decorate([
    (0, common_1.Patch)(':id/knowledge/:knowledgeId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, swagger_1.ApiBody)({ type: update_knowledge_entry_dto_1.UpdateKnowledgeEntryDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('knowledgeId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_knowledge_entry_dto_1.UpdateKnowledgeEntryDto, typeof (_h = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _h : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "updateKnowledge", null);
__decorate([
    (0, common_1.Delete)(':id/knowledge/:knowledgeId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('knowledgeId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_j = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _j : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "removeKnowledge", null);
__decorate([
    (0, common_1.Post)(':id/ai/assistant'),
    (0, swagger_1.ApiBody)({ type: hospital_assistant_dto_1.HospitalAssistantDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hospital_assistant_dto_1.HospitalAssistantDto, typeof (_k = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _k : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "assistant", null);
__decorate([
    (0, common_1.Get)(':id/ai/analytics'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_l = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _l : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)(':id/ai/settings-recommendation'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_m = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _m : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "settingsRecommendation", null);
__decorate([
    (0, common_1.Patch)(':id/ai/settings'),
    (0, roles_decorator_1.Roles)('ADMIN', 'MANAGER'),
    (0, swagger_1.ApiBody)({ type: update_hospital_ai_settings_dto_1.UpdateHospitalAiSettingsDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_hospital_ai_settings_dto_1.UpdateHospitalAiSettingsDto, typeof (_o = typeof authenticated_request_1.AuthenticatedRequest !== "undefined" && authenticated_request_1.AuthenticatedRequest) === "function" ? _o : Object]),
    __metadata("design:returntype", void 0)
], HospitalController.prototype, "updateSettings", null);
exports.HospitalController = HospitalController = __decorate([
    (0, swagger_1.ApiTags)('hospitals'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('hospitals'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [hospital_service_1.HospitalService])
], HospitalController);
