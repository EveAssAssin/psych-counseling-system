"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CounselingCasesModule = void 0;
const common_1 = require("@nestjs/common");
const counseling_cases_controller_1 = require("./counseling-cases.controller");
const counseling_cases_service_1 = require("./counseling-cases.service");
const holidays_service_1 = require("./holidays.service");
const case_draft_store_service_1 = require("./case-draft-store.service");
const ai_planner_service_1 = require("./ai-planner.service");
const case_ai_service_1 = require("./case-ai.service");
const case_notifier_service_1 = require("./case-notifier.service");
const supabase_module_1 = require("../supabase/supabase.module");
const employee_insight_module_1 = require("../insight/employee-insight.module");
const sync_module_1 = require("../sync/sync.module");
let CounselingCasesModule = class CounselingCasesModule {
};
exports.CounselingCasesModule = CounselingCasesModule;
exports.CounselingCasesModule = CounselingCasesModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule, employee_insight_module_1.EmployeeInsightModule, sync_module_1.SyncModule],
        controllers: [counseling_cases_controller_1.CounselingCasesController],
        providers: [
            counseling_cases_service_1.CounselingCasesService,
            holidays_service_1.HolidaysService,
            case_draft_store_service_1.CaseDraftStoreService,
            ai_planner_service_1.AiPlannerService,
            case_ai_service_1.CaseAiService,
            case_notifier_service_1.CaseNotifierService,
        ],
        exports: [counseling_cases_service_1.CounselingCasesService, holidays_service_1.HolidaysService, case_ai_service_1.CaseAiService, case_notifier_service_1.CaseNotifierService],
    })
], CounselingCasesModule);
//# sourceMappingURL=counseling-cases.module.js.map