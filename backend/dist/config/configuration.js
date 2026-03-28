"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = void 0;
const configuration = () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    app: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    },
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    externalApis: {
        employeeSync: {
            url: process.env.EMPLOYEE_SYNC_API_URL,
            apiKey: process.env.EMPLOYEE_SYNC_API_KEY,
        },
        ticketSystem: {
            url: process.env.TICKET_SYSTEM_API_URL,
            apiKey: process.env.TICKET_SYSTEM_API_KEY,
        },
    },
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
        path: process.env.UPLOAD_PATH || './uploads',
    },
    scheduler: {
        enabled: process.env.ENABLE_SCHEDULER === 'true',
        monthlySyncCron: process.env.MONTHLY_SYNC_CRON || '0 4 5 * *',
        dailySyncCron: process.env.DAILY_SYNC_CRON || '0 5 * * *',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'debug',
    },
});
exports.configuration = configuration;
//# sourceMappingURL=configuration.js.map