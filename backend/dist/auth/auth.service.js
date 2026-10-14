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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const email_service_1 = require("./email.service");
const auth_repository_1 = require("./auth.repository");
const sms_service_1 = require("./sms.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, email, repository, sms) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.email = email;
        this.repository = repository;
        this.sms = sms;
    }
    async validateUser(email, password) {
        const user = await this.repository.findUserByEmailWithOrganization(email);
        if (!user || !await bcrypt.compare(password, user.passwordHash))
            return null;
        if (user.role !== client_1.Role.SUPER_ADMIN) {
            if (user.organization.approvalStatus === client_1.TenantApprovalStatus.PENDING)
                throw new common_1.ForbiddenException('Hospital registration is awaiting Super Admin approval');
            if (user.organization.approvalStatus === client_1.TenantApprovalStatus.REJECTED)
                throw new common_1.ForbiddenException(user.organization.rejectionReason || 'Hospital registration was not approved');
            if (!user.emailVerifiedAt)
                throw new common_1.ForbiddenException('Verify your email before signing in');
            if (user.phone && !user.phoneVerifiedAt)
                throw new common_1.ForbiddenException('Verify your mobile number before signing in');
        }
        return this.publicUser(user);
    }
    async login(user, meta = {}) {
        const result = await this.createSession(user, meta);
        await this.audit(user.organizationId, user.id, 'AUTH_LOGIN', 'User', user.id, meta);
        return result;
    }
    async refresh(refreshToken, meta = {}) {
        const session = await this.repository.findSessionByRefreshHash(this.hash(refreshToken));
        if (!session || session.revokedAt || session.expiresAt <= new Date())
            throw new common_1.UnauthorizedException('Refresh token is invalid or expired');
        await this.repository.revokeSession(session.id);
        const result = await this.createSession(session.user, meta);
        await this.audit(session.user.organizationId, session.userId, 'AUTH_REFRESH', 'AuthSession', session.id, meta);
        return result;
    }
    async logout(userId, refreshToken, meta = {}) {
        if (refreshToken)
            await this.prisma.authSession.updateMany({ where: { userId, refreshTokenHash: this.hash(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
        await this.auditForUser(userId, 'AUTH_LOGOUT', 'User', userId, meta);
        return { success: true };
    }
    async sessions(userId) {
        return this.prisma.authSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, deviceName: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true }, orderBy: { lastUsedAt: 'desc' } });
    }
    async revokeSession(userId, sessionId) {
        const result = await this.prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
        if (!result.count)
            throw new common_1.NotFoundException('Session not found');
        await this.auditForUser(userId, 'AUTH_SESSION_REVOKED', 'AuthSession', sessionId);
        return { success: true };
    }
    async register(data) {
        if (data.organizationName)
            return this.registerHospital({ organizationName: data.organizationName, hospitalName: data.hospitalName || data.organizationName, hospitalAddress: data.hospitalAddress || 'To be confirmed', hospitalPhone: data.hospitalPhone || 'To be confirmed', adminEmail: data.email, adminName: data.displayName, adminPhone: '', adminPassword: data.password });
        if (!data.organizationId)
            throw new common_1.BadRequestException('organizationId or organizationName is required');
        const organization = await this.repository.organizationById(data.organizationId);
        if (!organization)
            throw new common_1.NotFoundException('Organization not found');
        await this.assertEmailAvailable(data.email);
        const user = await this.repository.createUser({ data: { email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12), displayName: data.displayName, organization: { connect: { id: data.organizationId } } } });
        const verification = await this.issueToken(user.id, client_1.AuthTokenType.EMAIL_VERIFICATION);
        await this.email.send(user.email, 'Verify your MediFlow email', '/verify-email?token=', verification);
        await this.audit(user.organizationId, user.id, 'AUTH_REGISTERED', 'User', user.id);
        return { user: this.publicUser(user), verificationToken: verification };
    }
    async registerHospital(data) {
        await this.assertEmailAvailable(data.adminEmail);
        const slug = await this.uniqueSlug(data.organizationName);
        const passwordHash = await bcrypt.hash(data.adminPassword, 12);
        const { organization, admin } = await this.prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({ data: { name: data.organizationName, slug, approvalStatus: client_1.TenantApprovalStatus.PENDING, hospitals: { create: { name: data.hospitalName, address: data.hospitalAddress, phone: data.hospitalPhone } } }, include: { hospitals: true } });
            const admin = await tx.user.create({ data: { email: data.adminEmail.toLowerCase(), phone: data.adminPhone, passwordHash, displayName: data.adminName, role: client_1.Role.ADMIN, organizationId: organization.id, hospitalId: organization.hospitals[0].id } });
            return { organization, admin };
        });
        const verification = await this.issueToken(admin.id, client_1.AuthTokenType.EMAIL_VERIFICATION);
        await this.email.send(admin.email, 'Verify your MediFlow email', '/verify-email?token=', verification);
        const mobileOtp = await this.issueMobileOtp(admin.id, admin.phone);
        await this.notifyPlatformApprovers(organization, admin);
        await this.audit(organization.id, admin.id, 'HOSPITAL_REGISTERED', 'Organization', organization.id);
        return { organization: { id: organization.id, name: organization.name, slug: organization.slug, approvalStatus: organization.approvalStatus }, user: this.publicUser(admin), activationRequirements: ['email_verification', 'mobile_otp_verification', 'super_admin_approval'], verificationToken: this.nonProductionValue(verification), mobileOtp: this.nonProductionValue(mobileOtp) };
    }
    async forgotPassword(email) {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user)
            return { success: true }; // Do not disclose account existence.
        const resetToken = await this.issueToken(user.id, client_1.AuthTokenType.PASSWORD_RESET);
        await this.email.send(user.email, 'Reset your MediFlow password', '/reset-password?token=', resetToken);
        await this.audit(user.organizationId, user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
        return { success: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : resetToken };
    }
    async resetPassword(token, password) {
        const record = await this.consumeToken(token, client_1.AuthTokenType.PASSWORD_RESET);
        await this.prisma.$transaction([
            this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
            this.prisma.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
        ]);
        await this.auditForUser(record.userId, 'PASSWORD_RESET_COMPLETED', 'User', record.userId);
        return { success: true };
    }
    async verifyEmail(token) {
        const record = await this.consumeToken(token, client_1.AuthTokenType.EMAIL_VERIFICATION);
        const user = await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
        await this.audit(user.organizationId, user.id, 'EMAIL_VERIFIED', 'User', user.id);
        return { success: true };
    }
    async requestMobileOtp(email) {
        const user = await this.repository.findUserByEmail(email);
        if (!user || !user.phone)
            return { success: true };
        const otp = await this.issueMobileOtp(user.id, user.phone);
        await this.audit(user.organizationId, user.id, 'MOBILE_OTP_REQUESTED', 'User', user.id);
        return { success: true, otp: this.nonProductionValue(otp) };
    }
    async verifyMobileOtp(email, otp) {
        const user = await this.repository.findUserByEmail(email);
        if (!user)
            throw new common_1.BadRequestException('Verification code is invalid or expired');
        const token = await this.prisma.authToken.findFirst({ where: { userId: user.id, type: client_1.AuthTokenType.MOBILE_VERIFICATION, tokenHash: this.hash(otp), usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
        if (!token)
            throw new common_1.BadRequestException('Verification code is invalid or expired');
        await this.prisma.$transaction([
            this.prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } }),
        ]);
        await this.audit(user.organizationId, user.id, 'MOBILE_VERIFIED', 'User', user.id);
        return { success: true };
    }
    async hospitalRegistrations(actor, status) {
        this.requireSuperAdmin(actor);
        const registrations = await this.prisma.organization.findMany({
            where: status ? { approvalStatus: status } : undefined,
            orderBy: { createdAt: 'asc' },
            include: { hospitals: true, users: { where: { role: client_1.Role.ADMIN }, select: { id: true, email: true, displayName: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true } } },
        });
        return registrations.map(({ users, ...registration }) => ({
            ...registration,
            users: users.map(({ emailVerifiedAt, phoneVerifiedAt, ...admin }) => ({ ...admin, emailVerified: Boolean(emailVerifiedAt), phoneVerified: Boolean(phoneVerifiedAt) })),
        }));
    }
    async platformAuditLogs(actor) {
        this.requireSuperAdmin(actor);
        return this.prisma.auditLog.findMany({
            take: 200,
            orderBy: { createdAt: 'desc' },
            include: { organization: { select: { name: true, slug: true } }, user: { select: { email: true, displayName: true } } },
        });
    }
    async approveHospitalRegistration(actor, organizationId) {
        this.requireSuperAdmin(actor);
        const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: { users: { where: { role: client_1.Role.ADMIN }, take: 1 } } });
        if (!organization)
            throw new common_1.NotFoundException('Hospital registration not found');
        if (organization.approvalStatus === client_1.TenantApprovalStatus.REJECTED)
            throw new common_1.BadRequestException('Rejected registrations cannot be approved');
        const approved = await this.prisma.organization.update({ where: { id: organizationId }, data: { approvalStatus: client_1.TenantApprovalStatus.APPROVED, approvedAt: new Date(), approvedById: actor.userId, rejectionReason: null } });
        const admin = organization.users[0];
        if (admin)
            await this.email.send(admin.email, 'Your MediFlow hospital account was approved', '/login', '');
        await this.audit(organizationId, actor.userId, 'HOSPITAL_REGISTRATION_APPROVED', 'Organization', organizationId);
        return { id: approved.id, approvalStatus: approved.approvalStatus, activationReady: Boolean(admin?.emailVerifiedAt && admin?.phoneVerifiedAt) };
    }
    async rejectHospitalRegistration(actor, organizationId, reason) {
        this.requireSuperAdmin(actor);
        const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: { users: { where: { role: client_1.Role.ADMIN }, take: 1 } } });
        if (!organization)
            throw new common_1.NotFoundException('Hospital registration not found');
        const rejected = await this.prisma.organization.update({ where: { id: organizationId }, data: { approvalStatus: client_1.TenantApprovalStatus.REJECTED, approvedAt: null, approvedById: actor.userId, rejectionReason: reason } });
        const admin = organization.users[0];
        if (admin)
            await this.email.send(admin.email, 'Your MediFlow hospital registration needs attention', '/login', '');
        await this.audit(organizationId, actor.userId, 'HOSPITAL_REGISTRATION_REJECTED', 'Organization', organizationId, undefined, { reason });
        return { id: rejected.id, approvalStatus: rejected.approvalStatus };
    }
    async invite(actor, dto) {
        if (!this.repository.roleCanInvite(actor.role))
            throw new common_1.ForbiddenException('Only administrators can invite users');
        if (actor.role !== client_1.Role.SUPER_ADMIN && dto.role === client_1.Role.SUPER_ADMIN)
            throw new common_1.ForbiddenException('Cannot invite a super admin');
        await this.assertEmailAvailable(dto.email);
        if (dto.hospitalId) {
            const hospital = await this.repository.hospitalInOrganization(dto.hospitalId, actor.organizationId);
            if (!hospital)
                throw new common_1.BadRequestException('Hospital does not belong to your organization');
        }
        const rawToken = this.token();
        const invite = await this.repository.createInvite({ data: { organization: { connect: { id: actor.organizationId } }, hospital: dto.hospitalId ?? actor.hospitalId ? { connect: { id: dto.hospitalId ?? actor.hospitalId } } : undefined, invitedBy: { connect: { id: actor.userId } }, email: dto.email.toLowerCase(), role: dto.role, tokenHash: this.hash(rawToken), expiresAt: this.expiresIn('7d') } });
        await this.email.send(invite.email, 'You are invited to MediFlow', '/accept-invite?token=', rawToken);
        await this.audit(actor.organizationId, actor.userId, 'USER_INVITED', 'Invite', invite.id, undefined, { email: invite.email, role: invite.role });
        return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, inviteToken: process.env.NODE_ENV === 'production' ? undefined : rawToken };
    }
    async acceptInvite(dto) {
        const invite = await this.prisma.invite.findUnique({ where: { tokenHash: this.hash(dto.token) } });
        if (!invite || invite.acceptedAt || invite.expiresAt <= new Date())
            throw new common_1.BadRequestException('Invite is invalid or expired');
        await this.assertEmailAvailable(invite.email);
        const user = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({ data: { email: invite.email, displayName: dto.displayName, passwordHash: await bcrypt.hash(dto.password, 12), role: invite.role, organizationId: invite.organizationId, hospitalId: invite.hospitalId } });
            await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
            return user;
        });
        const verificationToken = await this.issueToken(user.id, client_1.AuthTokenType.EMAIL_VERIFICATION);
        await this.email.send(user.email, 'Verify your MediFlow email', '/verify-email?token=', verificationToken);
        await this.audit(user.organizationId, user.id, 'INVITE_ACCEPTED', 'Invite', invite.id);
        return { user: this.publicUser(user), verificationToken };
    }
    async auditLogs(organizationId) { return this.prisma.auditLog.findMany({ where: { organizationId }, include: { user: { select: { email: true, displayName: true } } }, take: 100, orderBy: { createdAt: 'desc' } }); }
    async createSession(user, meta) {
        const payload = { sub: user.id, organizationId: user.organizationId, hospitalId: user.hospitalId ?? undefined, email: user.email, role: user.role };
        const refreshToken = this.jwtService.sign({ ...payload, typ: 'refresh' }, { secret: process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET || 'development-refresh-secret', expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' });
        await this.repository.createSession({ data: { user: { connect: { id: user.id } }, refreshTokenHash: this.hash(refreshToken), deviceName: meta.deviceName, userAgent: meta.userAgent, ipAddress: meta.ipAddress, expiresAt: this.expiresIn(process.env.REFRESH_TOKEN_EXPIRES_IN || '30d') } });
        return { accessToken: this.jwtService.sign(payload), refreshToken, user: this.publicUser(user) };
    }
    publicUser(user) { return { id: user.id, organizationId: user.organizationId, hospitalId: user.hospitalId ?? undefined, email: user.email, displayName: user.displayName, role: user.role, emailVerified: 'emailVerifiedAt' in user ? Boolean(user.emailVerifiedAt) : undefined, mfaEnabled: 'mfaEnabled' in user ? user.mfaEnabled : undefined }; }
    token() { return (0, crypto_1.randomBytes)(32).toString('base64url'); }
    hash(value) { return (0, crypto_1.createHash)('sha256').update(value).digest('hex'); }
    expiresIn(input) { const match = /^(\d+)([smhd])$/.exec(input); const value = match ? Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]] ?? 86400000) : 30 * 86400000; return new Date(Date.now() + value); }
    async issueToken(userId, type) { await this.repository.invalidateUnusedTokens(userId, type); const raw = this.token(); await this.repository.createAuthToken({ data: { user: { connect: { id: userId } }, type, tokenHash: this.hash(raw), expiresAt: this.expiresIn(type === client_1.AuthTokenType.PASSWORD_RESET ? '1h' : '24h') } }); return raw; }
    async issueMobileOtp(userId, phone) { await this.repository.invalidateUnusedTokens(userId, client_1.AuthTokenType.MOBILE_VERIFICATION); const otp = String((0, crypto_1.randomInt)(100000, 1000000)); await this.repository.createAuthToken({ data: { user: { connect: { id: userId } }, type: client_1.AuthTokenType.MOBILE_VERIFICATION, tokenHash: this.hash(otp), expiresAt: this.expiresIn('10m') } }); await this.sms.sendOtp(phone, otp, 'mobile_verification'); return otp; }
    async consumeToken(raw, type) { const record = await this.prisma.authToken.findUnique({ where: { tokenHash: this.hash(raw) } }); if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date())
        throw new common_1.BadRequestException('Token is invalid or expired'); return this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }); }
    async assertEmailAvailable(email) { if (await this.repository.findUserByEmail(email))
        throw new common_1.ConflictException('Email already registered'); }
    async uniqueSlug(name) { const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'hospital'; let slug = base; let suffix = 1; while (await this.repository.organizationBySlug(slug))
        slug = `${base}-${suffix++}`; return slug; }
    async auditForUser(userId, action, entityType, entityId, meta) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } }); if (user)
        await this.audit(user.organizationId, userId, action, entityType, entityId, meta); }
    async audit(organizationId, userId, action, entityType, entityId, meta, metadata) { await this.repository.createAudit({ data: { organization: { connect: { id: organizationId } }, user: userId ? { connect: { id: userId } } : undefined, action, entityType, entityId, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent, metadata } }); }
    requireSuperAdmin(actor) { if (actor.role !== client_1.Role.SUPER_ADMIN)
        throw new common_1.ForbiddenException('Only Super Admins can review hospital registrations'); }
    nonProductionValue(value) { return process.env.NODE_ENV === 'production' ? undefined : value; }
    async notifyPlatformApprovers(organization, admin) { const superAdmins = await this.prisma.user.findMany({ where: { role: client_1.Role.SUPER_ADMIN }, select: { email: true } }); await Promise.all(superAdmins.map((superAdmin) => this.email.send(superAdmin.email, `Hospital approval required: ${organization.name}`, `/super-admin/approvals?organizationId=${organization.id}`, ''))); }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, typeof (_a = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _a : Object, email_service_1.AuthEmailService, auth_repository_1.AuthRepository, sms_service_1.AuthSmsService])
], AuthService);
