export declare const configuration: () => {
    port: number;
    nodeEnv: string;
    supabase: {
        url: string | undefined;
        anonKey: string | undefined;
        serviceRoleKey: string | undefined;
    };
    anthropic: {
        apiKey: string | undefined;
        model: string;
        maxTokens: number;
    };
    google: {
        clientId: string | undefined;
        clientSecret: string | undefined;
        callbackUrl: string | undefined;
    };
    jwt: {
        secret: string | undefined;
        expiresIn: string;
    };
    externalApis: {
        employeeSync: {
            url: string | undefined;
            apiKey: string | undefined;
        };
        ticketSystem: {
            url: string | undefined;
            apiKey: string | undefined;
        };
    };
    upload: {
        maxFileSize: number;
        path: string;
    };
    scheduler: {
        enabled: boolean;
        monthlySyncCron: string;
        dailySyncCron: string;
    };
    logging: {
        level: string;
    };
};
export type AppConfig = ReturnType<typeof configuration>;
