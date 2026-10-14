"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
let QueueService = QueueService_1 = class QueueService {
    constructor() {
        this.appointmentQueue = null;
        this.worker = null;
        this.logger = new common_1.Logger(QueueService_1.name);
    }
    onModuleInit() {
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        const parsed = new URL(redisUrl);
        const connectionOptions = {
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
        };
        this.appointmentQueue = new bullmq_1.Queue('appointments', { connection: connectionOptions });
        this.worker = new bullmq_1.Worker('appointments', async (job) => {
            this.logger.log(`Processing job ${job?.name} (${job?.id})`);
            if (job && job.name === 'appointmentNotification') {
                const { appointmentId } = job.data;
                this.logger.log(`Simulated notification for appointment ${appointmentId}`);
            }
        }, { connection: connectionOptions });
        this.worker.on('failed', (job, err) => {
            this.logger.error(`Job ${job?.id} failed: ${err?.message}`);
        });
    }
    async onModuleDestroy() {
        await this.worker?.close();
        await this.appointmentQueue?.close();
    }
    async addAppointmentJob(appointmentId) {
        if (!this.appointmentQueue) {
            this.logger.warn('Appointment queue is not initialized');
            return null;
        }
        return this.appointmentQueue.add('appointmentNotification', { appointmentId });
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = QueueService_1 = __decorate([
    (0, common_1.Injectable)()
], QueueService);
