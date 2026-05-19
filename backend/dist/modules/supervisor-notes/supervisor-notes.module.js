"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisorNotesModule = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const supervisor_notes_controller_1 = require("./supervisor-notes.controller");
const supervisor_notes_service_1 = require("./supervisor-notes.service");
const supabase_module_1 = require("../supabase/supabase.module");
const upload_module_1 = require("../upload/upload.module");
let SupervisorNotesModule = class SupervisorNotesModule {
};
exports.SupervisorNotesModule = SupervisorNotesModule;
exports.SupervisorNotesModule = SupervisorNotesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            supabase_module_1.SupabaseModule,
            upload_module_1.UploadModule,
            platform_express_1.MulterModule.register({
                storage: (0, multer_1.memoryStorage)(),
                limits: { fileSize: 100 * 1024 * 1024 },
            }),
        ],
        controllers: [supervisor_notes_controller_1.SupervisorNotesController],
        providers: [supervisor_notes_service_1.SupervisorNotesService],
        exports: [supervisor_notes_service_1.SupervisorNotesService],
    })
], SupervisorNotesModule);
//# sourceMappingURL=supervisor-notes.module.js.map