"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskFlagsModule = void 0;
const common_1 = require("@nestjs/common");
const risk_flags_controller_1 = require("./risk-flags.controller");
const risk_flags_service_1 = require("./risk-flags.service");
let RiskFlagsModule = class RiskFlagsModule {
};
exports.RiskFlagsModule = RiskFlagsModule;
exports.RiskFlagsModule = RiskFlagsModule = __decorate([
    (0, common_1.Module)({
        controllers: [risk_flags_controller_1.RiskFlagsController],
        providers: [risk_flags_service_1.RiskFlagsService],
        exports: [risk_flags_service_1.RiskFlagsService],
    })
], RiskFlagsModule);
//# sourceMappingURL=risk-flags.module.js.map