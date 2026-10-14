"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotModule = void 0;
const common_1 = require("@nestjs/common");
const appointment_module_1 = require("../appointment/appointment.module");
const prisma_module_1 = require("../prisma/prisma.module");
const copilot_controller_1 = require("./copilot.controller");
const copilot_service_1 = require("./copilot.service");
let CopilotModule = class CopilotModule {
};
exports.CopilotModule = CopilotModule;
exports.CopilotModule = CopilotModule = __decorate([
    (0, common_1.Module)({ imports: [prisma_module_1.PrismaModule, appointment_module_1.AppointmentModule], controllers: [copilot_controller_1.CopilotController], providers: [copilot_service_1.CopilotService] })
], CopilotModule);
