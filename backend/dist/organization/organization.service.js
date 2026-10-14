"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
let OrganizationService = class OrganizationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                hospitals: true,
                users: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        role: true,
                    },
                },
                _count: {
                    select: {
                        patients: true,
                        doctors: true,
                        appointments: true,
                        billingRecords: true,
                    },
                },
            },
        });
    }
    async findOne(id) {
        const organization = await this.prisma.organization.findUnique({
            where: { id },
            include: {
                hospitals: true,
                users: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        role: true,
                    },
                },
            },
        });
        if (!organization) {
            throw new common_1.NotFoundException('Organization not found');
        }
        return organization;
    }
    async onboard(dto) {
        const existingOrganization = await this.prisma.organization.findUnique({
            where: { slug: dto.slug },
        });
        if (existingOrganization) {
            throw new common_1.ConflictException('Organization slug already exists');
        }
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.adminEmail },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Admin email already exists');
        }
        const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
        const organization = await this.prisma.organization.create({
            data: {
                name: dto.organizationName,
                slug: dto.slug,
                subscriptionPlan: dto.subscriptionPlan,
                subscriptionStatus: dto.subscriptionStatus,
                monthlyPrice: dto.monthlyPrice,
                maxHospitals: dto.maxHospitals,
                subscriptionStartsAt: dto.subscriptionStartsAt,
                subscriptionEndsAt: dto.subscriptionEndsAt,
                hospitals: {
                    create: {
                        name: dto.hospitalName,
                        address: dto.address,
                        phone: dto.phone,
                    },
                },
                users: {
                    create: {
                        email: dto.adminEmail,
                        displayName: dto.adminName,
                        passwordHash,
                        role: client_1.Role.ADMIN,
                    },
                },
            },
            include: {
                hospitals: true,
                users: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        role: true,
                    },
                },
            },
        });
        await this.prisma.user.update({ where: { id: organization.users[0].id }, data: { hospitalId: organization.hospitals[0].id } });
        return organization;
    }
    async update(id, dto) {
        await this.findOne(id);
        try {
            return await this.prisma.organization.update({
                where: { id },
                data: dto,
                include: { hospitals: true },
            });
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('Unique constraint')) {
                throw new common_1.ConflictException('Organization slug already exists');
            }
            throw err;
        }
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.$transaction(async (tx) => {
            await tx.billingRecord.deleteMany({ where: { organizationId: id } });
            await tx.appointment.deleteMany({ where: { organizationId: id } });
            await tx.dashboardMetric.deleteMany({ where: { organizationId: id } });
            await tx.doctor.deleteMany({ where: { organizationId: id } });
            await tx.patient.deleteMany({ where: { organizationId: id } });
            await tx.hospital.deleteMany({ where: { organizationId: id } });
            await tx.user.deleteMany({ where: { organizationId: id } });
            return tx.organization.delete({ where: { id } });
        });
    }
};
exports.OrganizationService = OrganizationService;
exports.OrganizationService = OrganizationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationService);
