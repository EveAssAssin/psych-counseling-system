"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsModule = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const config_1 = require("@nestjs/config");
const conversations_controller_1 = require("./conversations.controller");
const conversations_service_1 = require("./conversations.service");
const extraction_service_1 = require("./extraction.service");
const employee_context_service_1 = require("./employee-context.service");
const audio_transcription_service_1 = require("./audio-transcription.service");
const smart_fill_service_1 = require("./smart-fill.service");
const employees_module_1 = require("../employees/employees.module");
let ConversationsModule = class ConversationsModule {
};
exports.ConversationsModule = ConversationsModule;
exports.ConversationsModule = ConversationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            employees_module_1.EmployeesModule,
            platform_express_1.MulterModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    limits: {
                        fileSize: config.get('upload.maxFileSize'),
                    },
                }),
            }),
        ],
        controllers: [conversations_controller_1.ConversationsController],
        providers: [
            conversations_service_1.ConversationsService,
            extraction_service_1.ExtractionService,
            employee_context_service_1.EmployeeContextService,
            audio_transcription_service_1.AudioTranscriptionService,
            smart_fill_service_1.SmartFillService,
        ],
        exports: [
            conversations_service_1.ConversationsService,
            extraction_service_1.ExtractionService,
            employee_context_service_1.EmployeeContextService,
            audio_transcription_service_1.AudioTranscriptionService,
            smart_fill_service_1.SmartFillService,
        ],
    })
], ConversationsModule);
//# sourceMappingURL=conversations.module.js.map