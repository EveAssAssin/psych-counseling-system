"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sync_controller_1 = require("./sync.controller");
const sync_service_1 = require("./sync.service");
const lefthand_api_service_1 = require("./lefthand-api.service");
const employees_module_1 = require("../employees/employees.module");
const stores_module_1 = require("../stores/stores.module");
const supabase_module_1 = require("../supabase/supabase.module");
let SyncModule = class SyncModule {
};
exports.SyncModule = SyncModule;
exports.SyncModule = SyncModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            supabase_module_1.SupabaseModule,
            employees_module_1.EmployeesModule,
            stores_module_1.StoresModule,
        ],
        controllers: [sync_controller_1.SyncController],
        providers: [sync_service_1.SyncService, lefthand_api_service_1.LefthandApiService],
        exports: [sync_service_1.SyncService, lefthand_api_service_1.LefthandApiService],
    })
], SyncModule);
//# sourceMappingURL=sync.module.js.map