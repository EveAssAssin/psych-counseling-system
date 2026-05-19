export declare const configuration: () => {
    port: number;
    nodeEnv: string;
    app: {
        frontendUrl: string;
    };
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
    openai: {
        apiKey: string | undefined;
        whisperModel: string;
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
        reviewSystem: {
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
    line: {
        channelAccessToken: string;
    };
    logging: {
        level: string;
    };
};
export type AppConfig = ReturnType<typeof configuration>;
