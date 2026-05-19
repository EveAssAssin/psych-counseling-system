"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisorAiModule = void 0;
const common_1 = require("@nestjs/common");
const supervisor_ai_controller_1 = require("./supervisor-ai.controller");
const supervisor_ai_service_1 = require("./supervisor-ai.service");
const supabase_module_1 = require("../supabase/supabase.module");
const supervisor_notes_module_1 = require("../supervisor-notes/supervisor-notes.module");
const sync_module_1 = require("../sync/sync.module");
const conversations_module_1 = require("../conversations/conversations.module");
let SupervisorAiModule = class SupervisorAiModule {
};
exports.SupervisorAiModule = SupervisorAiModule;
exports.SupervisorAiModule = SupervisorAiModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule, supervisor_notes_module_1.SupervisorNotesModule, sync_module_1.SyncModule, conversations_module_1.ConversationsModule],
        controllers: [supervisor_ai_controller_1.SupervisorAiController],
        providers: [supervisor_ai_service_1.SupervisorAiService],
    })
], SupervisorAiModule);
//# sourceMappingURL=supervisor-ai.module.js.map