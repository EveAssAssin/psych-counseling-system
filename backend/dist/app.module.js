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
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const configuration_1 = require("./config/configuration");
const supabase_module_1 = require("./modules/supabase/supabase.module");
const auth_module_1 = require("./modules/auth/auth.module");
const employees_module_1 = require("./modules/employees/employees.module");
const stores_module_1 = require("./modules/stores/stores.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const analysis_module_1 = require("./modules/analysis/analysis.module");
const risk_flags_module_1 = require("./modules/risk-flags/risk-flags.module");
const sync_module_1 = require("./modules/sync/sync.module");
const query_module_1 = require("./modules/query/query.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const official_channel_module_1 = require("./modules/official-channel/official-channel.module");
const employee_insight_module_1 = require("./modules/insight/employee-insight.module");
const health_controller_1 = require("./health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.configuration],
            }),
            schedule_1.ScheduleModule.forRoot(),
            supabase_module_1.SupabaseModule,
            auth_module_1.AuthModule,
            employees_module_1.EmployeesModule,
            stores_module_1.StoresModule,
            conversations_module_1.ConversationsModule,
            analysis_module_1.AnalysisModule,
            risk_flags_module_1.RiskFlagsModule,
            sync_module_1.SyncModule,
            query_module_1.QueryModule,
            scheduler_module_1.SchedulerModule,
            official_channel_module_1.OfficialChannelModule,
            employee_insight_module_1.EmployeeInsightModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map