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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMetrics(organizationId) {
        const organizationWhere = { organizationId };
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        const todayWhere = {
            ...organizationWhere,
            scheduledAt: { gte: startOfToday, lt: startOfTomorrow },
        };
        const [appointmentCount, patientCount, doctorCount, billingSum, todayScheduled, todayCompleted, todayCancelled, pendingBills, paidBills] = await Promise.all([
            this.prisma.appointment.count({ where: organizationWhere }),
            this.prisma.patient.count({ where: organizationWhere }),
            this.prisma.doctor.count({ where: organizationWhere }),
            this.prisma.billingRecord.aggregate({ where: organizationWhere, _sum: { amount: true } }),
            this.prisma.appointment.count({ where: { ...todayWhere, status: 'SCHEDULED' } }),
            this.prisma.appointment.count({ where: { ...todayWhere, status: 'COMPLETED' } }),
            this.prisma.appointment.count({ where: { ...todayWhere, status: 'CANCELLED' } }),
            this.prisma.billingRecord.aggregate({ where: { ...organizationWhere, status: 'PENDING' }, _count: { _all: true }, _sum: { amount: true } }),
            this.prisma.billingRecord.aggregate({ where: { ...organizationWhere, status: 'PAID' }, _sum: { amount: true } }),
        ]);
        return {
            appointmentCount,
            patientCount,
            doctorCount,
            billingTotal: billingSum._sum.amount ?? 0,
            today: { scheduled: todayScheduled, completed: todayCompleted, cancelled: todayCancelled },
            billing: {
                pendingCount: pendingBills._count._all,
                pendingAmount: pendingBills._sum.amount ?? 0,
                paidAmount: paidBills._sum.amount ?? 0,
            },
            generatedAt: new Date().toISOString(),
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
