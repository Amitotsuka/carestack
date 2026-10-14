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
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
/** Persistence boundary for all security-sensitive authentication reads/writes. */
let AuthRepository = class AuthRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findUserByEmail(email) { return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } }); }
    findUserByEmailWithOrganization(email) { return this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { organization: { select: { approvalStatus: true, rejectionReason: true } } } }); }
    findUserById(id) { return this.prisma.user.findUnique({ where: { id } }); }
    findSessionByRefreshHash(refreshTokenHash) { return this.prisma.authSession.findUnique({ where: { refreshTokenHash }, include: { user: true } }); }
    createSession(args) { return this.prisma.authSession.create(args); }
    revokeSession(id) { return this.prisma.authSession.update({ where: { id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } }); }
    createAudit(args) { return this.prisma.auditLog.create(args); }
    createInvite(args) { return this.prisma.invite.create(args); }
    createAuthToken(args) { return this.prisma.authToken.create(args); }
    invalidateUnusedTokens(userId, type) { return this.prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }); }
    createUser(args) { return this.prisma.user.create(args); }
    updateUser(id, data) { return this.prisma.user.update({ where: { id }, data }); }
    organizationBySlug(slug) { return this.prisma.organization.findUnique({ where: { slug } }); }
    organizationById(id) { return this.prisma.organization.findUnique({ where: { id } }); }
    hospitalInOrganization(id, organizationId) { return this.prisma.hospital.findFirst({ where: { id, organizationId } }); }
    createHospitalTenant(data) { return this.prisma.organization.create(data); }
    roleCanInvite(role) { return role === client_1.Role.ADMIN || role === client_1.Role.SUPER_ADMIN; }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthRepository);
