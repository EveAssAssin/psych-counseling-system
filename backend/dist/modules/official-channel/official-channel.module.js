"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficialChannelModule = void 0;
const common_1 = require("@nestjs/common");
const official_channel_controller_1 = require("./official-channel.controller");
const official_channel_service_1 = require("./official-channel.service");
const supabase_module_1 = require("../supabase/supabase.module");
let OfficialChannelModule = class OfficialChannelModule {
};
exports.OfficialChannelModule = OfficialChannelModule;
exports.OfficialChannelModule = OfficialChannelModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule],
        controllers: [official_channel_controller_1.OfficialChannelController],
        providers: [official_channel_service_1.OfficialChannelService],
        exports: [official_channel_service_1.OfficialChannelService],
    })
], OfficialChannelModule);
//# sourceMappingURL=official-channel.module.js.map