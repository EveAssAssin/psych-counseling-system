"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeInsightModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const employee_insight_controller_1 = require("./employee-insight.controller");
const employee_insight_service_1 = require("./employee-insight.service");
const supabase_module_1 = require("../supabase/supabase.module");
const employees_module_1 = require("../employees/employees.module");
const official_channel_module_1 = require("../official-channel/official-channel.module");
let EmployeeInsightModule = class EmployeeInsightModule {
};
exports.EmployeeInsightModule = EmployeeInsightModule;
exports.EmployeeInsightModule = EmployeeInsightModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            supabase_module_1.SupabaseModule,
            employees_module_1.EmployeesModule,
            official_channel_module_1.OfficialChannelModule,
        ],
        controllers: [employee_insight_controller_1.EmployeeInsightController],
        providers: [employee_insight_service_1.EmployeeInsightService],
        exports: [employee_insight_service_1.EmployeeInsightService],
    })
], EmployeeInsightModule);
//# sourceMappingURL=employee-insight.module.js.map