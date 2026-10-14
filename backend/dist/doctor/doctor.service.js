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
exports.DoctorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DoctorService = class DoctorService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(organizationId) {
        return this.prisma.doctor.findMany({
            where: {
                organizationId,
            },
        });
    }
    async findOne(id, organizationId) {
        const doctor = await this.prisma.doctor.findFirst({
            where: {
                id,
                organizationId,
            },
        });
        if (!doctor) {
            throw new common_1.NotFoundException('Doctor not found');
        }
        return doctor;
    }
    async create(dto, organizationId) {
        await this.ensureHospitalBelongsToOrganization(dto.hospitalId, organizationId);
        return this.prisma.doctor.create({
            data: {
                ...dto,
                organizationId,
            },
        });
    }
    async update(id, dto, organizationId) {
        await this.findOne(id, organizationId);
        if (dto.hospitalId)
            await this.ensureHospitalBelongsToOrganization(dto.hospitalId, organizationId);
        return this.prisma.doctor.update({
            where: {
                id,
            },
            data: dto,
        });
    }
    async remove(id, organizationId) {
        await this.findOne(id, organizationId);
        return this.prisma.doctor.delete({
            where: {
                id,
            },
        });
    }
    async ensureHospitalBelongsToOrganization(hospitalId, organizationId) {
        const hospital = await this.prisma.hospital.findFirst({ where: { id: hospitalId, organizationId }, select: { id: true } });
        if (!hospital)
            throw new common_1.BadRequestException('Selected clinic does not belong to this organization');
    }
};
exports.DoctorService = DoctorService;
exports.DoctorService = DoctorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DoctorService);
