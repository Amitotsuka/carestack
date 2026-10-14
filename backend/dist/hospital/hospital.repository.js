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
exports.HospitalRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let HospitalRepository = class HospitalRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(organizationId) {
        return this.prisma.hospital.findMany({
            where: { organizationId },
            include: { organization: true, aiSettings: true, _count: { select: { knowledgeEntries: true } } },
            orderBy: { name: 'asc' },
        });
    }
    findAllPlatform() {
        return this.prisma.hospital.findMany({ include: { organization: true, aiSettings: true, _count: { select: { knowledgeEntries: true } } }, orderBy: { name: 'asc' } });
    }
    findOne(id, organizationId) {
        return this.prisma.hospital.findFirst({
            where: { id, organizationId },
            include: { organization: true, aiSettings: true, _count: { select: { knowledgeEntries: true } } },
        });
    }
    create(organizationId, data) {
        return this.prisma.hospital.create({
            data: { ...data, organizationId, aiSettings: { create: {} } },
            include: { organization: true, aiSettings: true, _count: { select: { knowledgeEntries: true } } },
        });
    }
    update(id, data) {
        return this.prisma.hospital.update({
            where: { id }, data,
            include: { organization: true, aiSettings: true, _count: { select: { knowledgeEntries: true } } },
        });
    }
    remove(id) {
        return this.prisma.hospital.delete({ where: { id } });
    }
    findKnowledge(hospitalId) {
        return this.prisma.hospitalKnowledgeEntry.findMany({ where: { hospitalId }, orderBy: { updatedAt: 'desc' } });
    }
    createKnowledge(hospitalId, data) {
        return this.prisma.hospitalKnowledgeEntry.create({ data: { hospitalId, ...data } });
    }
    updateKnowledge(id, data) {
        return this.prisma.hospitalKnowledgeEntry.update({ where: { id }, data });
    }
    deleteKnowledge(id) {
        return this.prisma.hospitalKnowledgeEntry.delete({ where: { id } });
    }
    findKnowledgeEntry(id, hospitalId) {
        return this.prisma.hospitalKnowledgeEntry.findFirst({ where: { id, hospitalId } });
    }
    updateSettings(hospitalId, data) {
        return this.prisma.hospitalAiSettings.upsert({
            where: { hospitalId }, update: data, create: { hospitalId, ...data },
        });
    }
    async operationalMetrics(organizationId) {
        const [patients, doctors, appointments, pendingBilling, scheduled, completed] = await Promise.all([
            this.prisma.patient.count({ where: { organizationId } }),
            this.prisma.doctor.count({ where: { organizationId } }),
            this.prisma.appointment.count({ where: { organizationId } }),
            this.prisma.billingRecord.aggregate({ where: { organizationId, status: 'PENDING' }, _sum: { amount: true }, _count: true }),
            this.prisma.appointment.count({ where: { organizationId, status: 'SCHEDULED' } }),
            this.prisma.appointment.count({ where: { organizationId, status: 'COMPLETED' } }),
        ]);
        return { patients, doctors, appointments, scheduled, completed, pendingBills: pendingBilling._count, pendingAmount: pendingBilling._sum.amount ?? 0 };
    }
};
exports.HospitalRepository = HospitalRepository;
exports.HospitalRepository = HospitalRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HospitalRepository);
