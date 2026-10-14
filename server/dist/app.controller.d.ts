import { JwtService } from '@nestjs/jwt';
import { AppService } from './app.service';
declare class LoginDto {
    email: string;
    password: string;
}
declare class ClinicInterestDto {
    clinic_name: string;
    contact_name: string;
    email: string;
    phone: string;
    plan: string;
}
declare class TenantOnboardDto {
    tenant_name: string;
    tenant_domain: string;
    admin_name: string;
    admin_email: string;
    admin_phone: string;
    plan: string;
    region: string;
    billing_cycle?: string;
}
declare class TenantUpdateDto {
    tenant_name?: string;
    tenant_domain?: string;
    admin_name?: string;
    admin_email?: string;
    admin_phone?: string;
    plan?: string;
    billing_cycle?: string;
    subscription_status?: string;
    region?: string;
}
declare class SubscriptionUpdateDto {
    plan?: string;
    billing_cycle?: string;
    subscription_status?: string;
}
declare class PlanDto {
    id?: string;
    name?: string;
    monthly_price?: number;
    annual_price?: number;
    clinic_limit?: number | null;
    user_limit?: number | null;
}
declare class PatientDto {
    name: string;
    phone: string;
    email?: string;
    age?: number;
    status?: string;
    notes?: string;
}
declare class AppointmentStatusDto {
    status: string;
}
export declare class AppController {
    private readonly appService;
    private readonly jwtService;
    constructor(appService: AppService, jwtService: JwtService);
    getHealth(): {
        status: string;
        service: string;
    };
    login(body: LoginDto): Promise<{
        user: {
            user_id: string;
            role: string;
            name: string;
            tenant_id: any;
            email: string;
            tenant_domain?: undefined;
        } | {
            user_id: string;
            role: string;
            name: string;
            tenant_id: string;
            tenant_domain: string;
            email: string;
        };
        access_token: string;
        token_type: string;
        expires_in: number;
        message: string;
    }>;
    resolveTenant(domain: string): {
        id: string;
        name: string;
        domain: string;
        subscription_status: "active" | "paused";
    };
    getPublicPlans(): {
        plans: {
            id: string;
            name: string;
            monthly_price: number;
            annual_price: number;
            clinic_limit: number;
            user_limit: number;
        }[];
    };
    createClinicInterest(body: ClinicInterestDto): {
        lead_id: string;
        message: string;
    };
    listClinicInterests(): {
        clinic_interests: {
            id: string;
            clinic_name: string;
            contact_name: string;
            email: string;
            phone: string;
            plan: string;
            created_at: string;
        }[];
    };
    listTenants(): {
        tenants: {
            id: string;
            name: string;
            domain: string;
            admin_name: string;
            admin_email: string;
            admin_phone: string;
            plan: string;
            subscription_status: "active" | "paused";
            billing_cycle: "monthly" | "annual";
            monthly_price: number;
            region: string;
            patient_count: number;
            booking_count: number;
            telephony: {
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                voice_provider: "sarvam";
                exotel_voicebot_id: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai";
                enabled: boolean;
            } | {
                voice_provider: "sarvam" | "exotel_voicebot";
                enabled: boolean;
                exotel_credentials_configured: boolean;
                provider_credentials_configured: boolean;
                voice_tools_configured: boolean;
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                exotel_voicebot_id?: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai" | "singapore";
                sarvam_org_id?: string;
                sarvam_workspace_id?: string;
                sarvam_agent_id?: string;
                sarvam_agent_version?: number;
                sarvam_connection_id?: string;
                sarvam_deployment_id?: string;
            };
        }[];
    };
    listPlans(): {
        plans: {
            id: string;
            name: string;
            monthly_price: number;
            annual_price: number;
            clinic_limit: number | null;
            user_limit: number | null;
        }[];
    };
    createPlan(body: PlanDto): {
        plan: {
            id: string;
            name: string;
            monthly_price: number;
            annual_price: number;
            clinic_limit: number | null;
            user_limit: number | null;
        };
        message: string;
    };
    updatePlan(planId: string, body: PlanDto): {
        plan: {
            id: string;
            name: string;
            monthly_price: number;
            annual_price: number;
            clinic_limit: number | null;
            user_limit: number | null;
        };
        message: string;
    };
    deletePlan(planId: string): {
        deleted: boolean;
        plan_id: string;
    };
    getSuperAdminDashboard(): {
        summary: {
            tenants: number;
            active: number;
            paused: number;
            monthly_recurring_revenue: number;
        };
        plan_breakdown: {
            id: string;
            name: string;
            count: number;
        }[];
    };
    onboardTenant(body: TenantOnboardDto): {
        tenant: {
            tenant_id: string;
            tenant_name: string;
            domain: string;
            admin_email: string;
            plan: string;
            subscription_status: "active" | "paused";
            billing_cycle: "monthly" | "annual";
            temporary_password: string;
        };
        message: string;
    };
    updateTenant(tenantId: string, body: TenantUpdateDto): {
        tenant: {
            id: string;
            name: string;
            domain: string;
            admin_name: string;
            admin_email: string;
            admin_phone: string;
            plan: string;
            subscription_status: "active" | "paused";
            billing_cycle: "monthly" | "annual";
            monthly_price: number;
            region: string;
            patient_count: number;
            booking_count: number;
            telephony: {
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                voice_provider: "sarvam";
                exotel_voicebot_id: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai";
                enabled: boolean;
            } | {
                voice_provider: "sarvam" | "exotel_voicebot";
                enabled: boolean;
                exotel_credentials_configured: boolean;
                provider_credentials_configured: boolean;
                voice_tools_configured: boolean;
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                exotel_voicebot_id?: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai" | "singapore";
                sarvam_org_id?: string;
                sarvam_workspace_id?: string;
                sarvam_agent_id?: string;
                sarvam_agent_version?: number;
                sarvam_connection_id?: string;
                sarvam_deployment_id?: string;
            };
        };
        message: string;
    };
    updateTenantTelephony(tenantId: string, body: any): {
        telephony: {
            credentials_configured: boolean;
            deployment_status: string;
            provider: "exotel";
            voice_provider: "sarvam";
            exotel_voicebot_id: string;
            phone_number: string;
            account_sid: string;
            app_id: string;
            region: "mumbai";
            enabled: boolean;
        } | {
            voice_provider: "sarvam" | "exotel_voicebot";
            enabled: boolean;
            exotel_credentials_configured: boolean;
            provider_credentials_configured: boolean;
            voice_tools_configured: boolean;
            credentials_configured: boolean;
            deployment_status: string;
            provider: "exotel";
            exotel_voicebot_id?: string;
            phone_number: string;
            account_sid: string;
            app_id: string;
            region: "mumbai" | "singapore";
            sarvam_org_id?: string;
            sarvam_workspace_id?: string;
            sarvam_agent_id?: string;
            sarvam_agent_version?: number;
            sarvam_connection_id?: string;
            sarvam_deployment_id?: string;
        };
        voice_tool_secret: string;
        message: string;
    };
    activateVoiceDeployment(tenantId: string): Promise<{
        message: string;
        deployment_id: string;
        telephony: {
            credentials_configured: boolean;
            deployment_status: string;
            provider: "exotel";
            voice_provider: "sarvam";
            exotel_voicebot_id: string;
            phone_number: string;
            account_sid: string;
            app_id: string;
            region: "mumbai";
            enabled: boolean;
        } | {
            voice_provider: "sarvam" | "exotel_voicebot";
            enabled: boolean;
            exotel_credentials_configured: boolean;
            provider_credentials_configured: boolean;
            voice_tools_configured: boolean;
            credentials_configured: boolean;
            deployment_status: string;
            provider: "exotel";
            exotel_voicebot_id?: string;
            phone_number: string;
            account_sid: string;
            app_id: string;
            region: "mumbai" | "singapore";
            sarvam_org_id?: string;
            sarvam_workspace_id?: string;
            sarvam_agent_id?: string;
            sarvam_agent_version?: number;
            sarvam_connection_id?: string;
            sarvam_deployment_id?: string;
        };
        error?: undefined;
    }>;
    verifyExotelConnection(tenantId: string): Promise<{
        connected: boolean;
        provider: string;
        region: "mumbai" | "singapore";
        message: string;
        error?: undefined;
    }>;
    voiceTool(tenantId: string, suppliedSecret: string, body: any): Promise<{
        error: string;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        matched?: undefined;
        handoff?: undefined;
        message?: undefined;
        question?: undefined;
        answer?: undefined;
        source?: undefined;
        available?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        clinic_name: string;
        phone_number: string;
        booking_hours: string;
        appointment_duration_minutes: number;
        address: any;
        services: any;
        fees: any;
        doctors: any;
        languages: any;
        receptionist_instructions: any;
        faqs: any;
        response_policy: string;
        error?: undefined;
        matched?: undefined;
        handoff?: undefined;
        message?: undefined;
        question?: undefined;
        answer?: undefined;
        source?: undefined;
        available?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        matched: boolean;
        handoff: boolean;
        message: string;
        error?: undefined;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        question?: undefined;
        answer?: undefined;
        source?: undefined;
        available?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        matched: boolean;
        question: any;
        answer: any;
        source: string;
        error?: undefined;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        handoff?: undefined;
        message?: undefined;
        available?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        available: boolean;
        message: string;
        error?: undefined;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        matched?: undefined;
        handoff?: undefined;
        question?: undefined;
        answer?: undefined;
        source?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        available: boolean;
        date: string;
        time: string;
        duration_minutes: number;
        doctor_name: string;
        source: string;
        message: string;
        error?: undefined;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        matched?: undefined;
        handoff?: undefined;
        question?: undefined;
        answer?: undefined;
        appointment?: undefined;
        idempotent_replay?: undefined;
    } | {
        appointment: {
            id: string;
            patient_name: string;
            phone_number: string;
            doctor_name: string;
            appointment_date: string;
            appointment_time: string;
            duration_minutes?: number;
            reason?: string;
            status: string;
            created_at?: string;
        };
        idempotent_replay: boolean;
        error?: undefined;
        clinic_name?: undefined;
        phone_number?: undefined;
        booking_hours?: undefined;
        appointment_duration_minutes?: undefined;
        address?: undefined;
        services?: undefined;
        fees?: undefined;
        doctors?: undefined;
        languages?: undefined;
        receptionist_instructions?: undefined;
        faqs?: undefined;
        response_policy?: undefined;
        matched?: undefined;
        handoff?: undefined;
        message?: undefined;
        question?: undefined;
        answer?: undefined;
        source?: undefined;
        available?: undefined;
        date?: undefined;
        time?: undefined;
        duration_minutes?: undefined;
        doctor_name?: undefined;
    }>;
    updateSubscription(tenantId: string, body: SubscriptionUpdateDto): {
        tenant: {
            id: string;
            name: string;
            domain: string;
            admin_name: string;
            admin_email: string;
            admin_phone: string;
            plan: string;
            subscription_status: "active" | "paused";
            billing_cycle: "monthly" | "annual";
            monthly_price: number;
            region: string;
            patient_count: number;
            booking_count: number;
            telephony: {
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                voice_provider: "sarvam";
                exotel_voicebot_id: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai";
                enabled: boolean;
            } | {
                voice_provider: "sarvam" | "exotel_voicebot";
                enabled: boolean;
                exotel_credentials_configured: boolean;
                provider_credentials_configured: boolean;
                voice_tools_configured: boolean;
                credentials_configured: boolean;
                deployment_status: string;
                provider: "exotel";
                exotel_voicebot_id?: string;
                phone_number: string;
                account_sid: string;
                app_id: string;
                region: "mumbai" | "singapore";
                sarvam_org_id?: string;
                sarvam_workspace_id?: string;
                sarvam_agent_id?: string;
                sarvam_agent_version?: number;
                sarvam_connection_id?: string;
                sarvam_deployment_id?: string;
            };
        };
        message: string;
    };
    deleteTenant(tenantId: string): {
        deleted: boolean;
        tenant_id: string;
    };
    getDashboard(tenantId: string): {
        statusCode: number;
        message: string;
        tenant_id?: undefined;
        tenant_name?: undefined;
        admin_name?: undefined;
        plan?: undefined;
        region?: undefined;
        voice_agent?: undefined;
        telephony?: undefined;
        summary?: undefined;
        analytics?: undefined;
        patients?: undefined;
        bookings?: undefined;
    } | {
        tenant_id: string;
        tenant_name: string;
        admin_name: string;
        plan: string;
        region: string;
        voice_agent: {
            clinic_context: any;
            enabled: boolean;
            availability: "all_day" | "business_hours";
            open_time: string;
            close_time: string;
            timezone: string;
            appointment_duration_minutes: number;
        };
        telephony: {
            phone_number: string;
            enabled: boolean;
            voice_provider: "sarvam" | "exotel_voicebot";
        };
        summary: {
            patients: number;
            appointments: number;
            active_patients: number;
            upcoming_appointments: number;
            completed_appointments: number;
            cancellation_rate: number;
        };
        analytics: {
            summary: {
                active_patients: number;
                upcoming_appointments: number;
                completed_appointments: number;
                cancellation_rate: number;
                patient_activity: {
                    current: number;
                    previous: number;
                };
                booking_activity: {
                    current: number;
                    previous: number;
                };
            };
            activity: {
                date: string;
                label: string;
                patients: number;
                bookings: number;
            }[];
            schedule: {
                date: string;
                label: string;
                count: number;
            }[];
            status_breakdown: {
                status: string;
                count: number;
            }[];
            doctor_workload: {
                doctor: string;
                count: number;
            }[];
        };
        patients: {
            id: string;
            tenant_id: string;
            name: string;
            phone: string;
            email?: string;
            age?: number;
            status: string;
            notes?: string;
            created_at?: string;
        }[];
        bookings: {
            id: string;
            patient_name: string;
            phone_number: string;
            doctor_name: string;
            appointment_date: string;
            appointment_time: string;
            duration_minutes?: number;
            reason?: string;
            status: string;
            created_at?: string;
        }[];
        statusCode?: undefined;
        message?: undefined;
    };
    updateVoiceAgent(tenantId: string, body: any): {
        voice_agent: {
            enabled: boolean;
            availability: "all_day" | "business_hours";
            open_time: string;
            close_time: string;
            timezone: string;
            appointment_duration_minutes?: number;
            clinic_context?: any;
        };
        message: string;
    };
    previewVoiceAgent(tenantId: string, body: any): {
        reply: any;
        status: string;
    };
    getPatients(tenantId: string): {
        patients: {
            id: string;
            tenant_id: string;
            name: string;
            phone: string;
            email?: string;
            age?: number;
            status: string;
            notes?: string;
            created_at?: string;
        }[];
    };
    addPatient(tenantId: string, body: PatientDto): {
        patient: {
            id: string;
            tenant_id: string;
            name: any;
            phone: any;
            email: any;
            age: any;
            status: any;
            notes: any;
            created_at: string;
        } | {
            statusCode: number;
            message: string;
        };
        message: string;
    };
    updatePatient(tenantId: string, patientId: string, body: PatientDto): {
        patient: {
            id: string;
            tenant_id: string;
            name: string;
            phone: string;
            email?: string;
            age?: number;
            status: string;
            notes?: string;
            created_at?: string;
        } | {
            statusCode: number;
            message: string;
        };
        message: string;
    };
    deletePatient(tenantId: string, patientId: string): {
        statusCode: number;
        message: string;
        deleted?: undefined;
        patient_id?: undefined;
    } | {
        deleted: boolean;
        patient_id: string;
        statusCode?: undefined;
        message?: undefined;
    };
    updateAppointmentStatus(tenantId: string, appointmentId: string, body: AppointmentStatusDto): {
        appointment: {
            id: string;
            patient_name: string;
            phone_number: string;
            doctor_name: string;
            appointment_date: string;
            appointment_time: string;
            duration_minutes?: number;
            reason?: string;
            status: string;
            created_at?: string;
        };
        message: string;
    };
    triggerOrchestration(body: any): Promise<{
        source: string;
        data: any;
        appointment: {
            id: string;
            patient_name: string;
            phone_number: string;
            doctor_name: string;
            appointment_date: string;
            appointment_time: string;
            duration_minutes?: number;
            reason?: string;
            status: string;
            created_at?: string;
        };
    }>;
}
export {};
