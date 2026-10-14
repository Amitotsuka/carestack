"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const hospital_module_1 = require("./hospital/hospital.module");
const doctor_module_1 = require("./doctor/doctor.module");
const patient_module_1 = require("./patient/patient.module");
const appointment_module_1 = require("./appointment/appointment.module");
const billing_module_1 = require("./billing/billing.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const prisma_module_1 = require("./prisma/prisma.module");
const queue_module_1 = require("./queue/queue.module");
const organization_module_1 = require("./organization/organization.module");
const patient_portal_module_1 = require("./patient-portal/patient-portal.module");
const public_portal_module_1 = require("./public-portal/public-portal.module");
const copilot_module_1 = require("./copilot/copilot.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            hospital_module_1.HospitalModule,
            doctor_module_1.DoctorModule,
            patient_module_1.PatientModule,
            appointment_module_1.AppointmentModule,
            billing_module_1.BillingModule,
            dashboard_module_1.DashboardModule,
            queue_module_1.QueueModule,
            organization_module_1.OrganizationModule,
            patient_portal_module_1.PatientPortalModule,
            public_portal_module_1.PublicPortalModule,
            copilot_module_1.CopilotModule,
        ],
    })
], AppModule);
