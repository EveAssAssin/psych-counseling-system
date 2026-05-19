"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineAssistantModule = void 0;
const common_1 = require("@nestjs/common");
const line_assistant_controller_1 = require("./line-assistant.controller");
const line_assistant_service_1 = require("./line-assistant.service");
const supabase_module_1 = require("../supabase/supabase.module");
const conversations_module_1 = require("../conversations/conversations.module");
const employees_module_1 = require("../employees/employees.module");
let LineAssistantModule = class LineAssistantModule {
};
exports.LineAssistantModule = LineAssistantModule;
exports.LineAssistantModule = LineAssistantModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule, conversations_module_1.ConversationsModule, employees_module_1.EmployeesModule],
        controllers: [line_assistant_controller_1.LineAssistantController],
        providers: [line_assistant_service_1.LineAssistantService],
        exports: [line_assistant_service_1.LineAssistantService],
    })
], LineAssistantModule);
//# sourceMappingURL=line-assistant.module.js.map