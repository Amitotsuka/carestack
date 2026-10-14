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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BillingService = class BillingService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(organizationId) {
        return this.prisma.billingRecord.findMany({
            where: {
                organizationId,
            },
            include: {
                patient: true,
                appointment: true,
            },
        });
    }
    async findOne(id, organizationId) {
        const record = await this.prisma.billingRecord.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                patient: true,
                appointment: true,
            },
        });
        if (!record) {
            throw new common_1.NotFoundException('Billing record not found');
        }
        return record;
    }
    async create(dto, organizationId) {
        await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        await this.ensureAppointmentBelongsToOrganization(dto.appointmentId, organizationId);
        return this.prisma.billingRecord.create({
            data: {
                ...dto,
                organizationId,
            },
            include: {
                patient: true,
                appointment: true,
            },
        });
    }
    async update(id, dto, organizationId) {
        await this.findOne(id, organizationId);
        if (dto.patientId) {
            await this.ensurePatientBelongsToOrganization(dto.patientId, organizationId);
        }
        if (dto.appointmentId) {
            await this.ensureAppointmentBelongsToOrganization(dto.appointmentId, organizationId);
        }
        return this.prisma.billingRecord.update({
            where: {
                id,
            },
            data: dto,
            include: {
                patient: true,
                appointment: true,
            },
        });
    }
    async remove(id, organizationId) {
        await this.findOne(id, organizationId);
        return this.prisma.billingRecord.delete({
            where: {
                id,
            },
        });
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
    async ensureAppointmentBelongsToOrganization(appointmentId, organizationId) {
        const appointment = await this.prisma.appointment.findFirst({
            where: { id: appointmentId, organizationId },
            select: { id: true },
        });
        if (!appointment) {
            throw new common_1.BadRequestException('Appointment does not belong to this organization');
        }
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingService);
