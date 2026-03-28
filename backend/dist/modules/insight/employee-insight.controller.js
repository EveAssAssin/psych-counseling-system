"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeInsightController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const employee_insight_service_1 = require("./employee-insight.service");
const employees_service_1 = require("../employees/employees.service");
let EmployeeInsightController = class EmployeeInsightController {
    constructor(insightService, employeesService) {
        this.insightService = insightService;
        this.employeesService = employeesService;
    }
    async getInsightByName(name, refresh) {
        try {
            const { data: employees } = await this.employeesService.search({ q: name, limit: 10 });
            if (employees.length === 0) {
                throw new common_1.HttpException({ success: false, error: `找不到名字包含「${name}」的員工` }, common_1.HttpStatus.NOT_FOUND);
            }
            if (employees.length > 1) {
                return {
                    success: true,
                    multiple: true,
                    message: `找到 ${employees.length} 位員工，請選擇：`,
                    employees: employees.map(e => ({
                        name: e.name,
                        app_number: e.employeeappnumber,
                        department: e.department,
                        store_name: e.store_name,
                        title: e.title,
                    })),
                };
            }
            const employee = employees[0];
            const insight = await this.insightService.getInsight(employee.employeeappnumber, {
                days: 30,
                forceRefresh: refresh === true,
            });
            return {
                success: true,
                data: insight,
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getInsight(appNumber, days, refresh) {
        try {
            const insight = await this.insightService.getInsight(appNumber, {
                days: days ? Number(days) : 30,
                forceRefresh: refresh === true,
            });
            return {
                success: true,
                data: insight,
            };
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException({ success: false, error: 'Employee not found', app_number: appNumber }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getSummary(appNumber) {
        try {
            const insight = await this.insightService.getInsight(appNumber, { days: 30 });
            return {
                success: true,
                data: {
                    employee: {
                        name: insight.employee.name,
                        department: insight.employee.department,
                        store_name: insight.employee.store_name,
                    },
                    summary: insight.summary,
                    data_sources: insight.data_sources,
                    quick_tips: {
                        should_talk_soon: insight.summary.risk_level === 'high' || insight.summary.risk_level === 'critical',
                        trend_warning: insight.summary.trend === 'worsening',
                        suggested_timing: insight.communication.suggested_timing,
                    },
                },
            };
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException({ success: false, error: 'Employee not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCommunicationTips(appNumber) {
        try {
            const insight = await this.insightService.getInsight(appNumber, { days: 30 });
            return {
                success: true,
                data: {
                    employee_name: insight.employee.name,
                    risk_level: insight.summary.risk_level,
                    communication: insight.communication,
                    key_concerns: insight.summary.key_concerns,
                },
            };
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException({ success: false, error: 'Employee not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getTimeline(appNumber, days) {
        try {
            const insight = await this.insightService.getInsight(appNumber, {
                days: days ? Number(days) : 30,
            });
            return {
                success: true,
                data: {
                    employee_name: insight.employee.name,
                    date_range: insight.data_sources.date_range,
                    event_count: insight.timeline.length,
                    timeline: insight.timeline,
                },
            };
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException({ success: false, error: 'Employee not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getTransferAssessment(appNumber) {
        try {
            const insight = await this.insightService.getInsight(appNumber, { days: 30 });
            return {
                success: true,
                data: {
                    employee_name: insight.employee.name,
                    current_status: {
                        risk_level: insight.summary.risk_level,
                        stress_level: insight.summary.stress_level,
                        trend: insight.summary.trend,
                    },
                    transfer_assessment: insight.transfer_assessment,
                    team_dynamics: insight.team_dynamics,
                },
            };
        }
        catch (error) {
            if (error.message?.includes('not found')) {
                throw new common_1.HttpException({ success: false, error: 'Employee not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.EmployeeInsightController = EmployeeInsightController;
__decorate([
    (0, common_1.Get)('by-name/:name'),
    (0, swagger_1.ApiOperation)({
        summary: '用名字查詢員工綜合洞察',
        description: '用員工名字搜尋並取得 AI 分析結果'
    }),
    (0, swagger_1.ApiParam)({ name: 'name', description: '員工姓名' }),
    (0, swagger_1.ApiQuery)({ name: 'refresh', required: false, description: '是否強制重新分析' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工綜合洞察結果' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '員工不存在' }),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)('refresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getInsightByName", null);
__decorate([
    (0, common_1.Get)(':appNumber'),
    (0, swagger_1.ApiOperation)({
        summary: '取得員工綜合洞察',
        description: '整合所有可用資料（對話、LINE 訊息、工單留言、出勤、加扣分、評價）進行 AI 綜合分析，提供溝通建議與調動評估。'
    }),
    (0, swagger_1.ApiParam)({ name: 'appNumber', description: '員工會員編號 (employeeappnumber)' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, description: '分析天數範圍（預設 30 天）' }),
    (0, swagger_1.ApiQuery)({ name: 'refresh', required: false, description: '是否強制重新分析' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工綜合洞察結果' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '員工不存在' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('days')),
    __param(2, (0, common_1.Query)('refresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Boolean]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getInsight", null);
__decorate([
    (0, common_1.Get)(':appNumber/summary'),
    (0, swagger_1.ApiOperation)({
        summary: '取得員工快速摘要',
        description: '只回傳狀態摘要，不含完整分析（速度較快）'
    }),
    (0, swagger_1.ApiParam)({ name: 'appNumber', description: '員工會員編號' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工狀態摘要' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)(':appNumber/communication'),
    (0, swagger_1.ApiOperation)({
        summary: '取得溝通建議',
        description: '只回傳溝通相關建議（話術、時機、避雷區）'
    }),
    (0, swagger_1.ApiParam)({ name: 'appNumber', description: '員工會員編號' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '溝通建議' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getCommunicationTips", null);
__decorate([
    (0, common_1.Get)(':appNumber/timeline'),
    (0, swagger_1.ApiOperation)({
        summary: '取得員工時間軸',
        description: '回傳員工近期所有事件的時間軸'
    }),
    (0, swagger_1.ApiParam)({ name: 'appNumber', description: '員工會員編號' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, description: '天數範圍（預設 30 天）' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '時間軸資料' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getTimeline", null);
__decorate([
    (0, common_1.Get)(':appNumber/transfer-assessment'),
    (0, swagger_1.ApiOperation)({
        summary: '取得調動評估',
        description: '回傳員工調動相關的評估資訊'
    }),
    (0, swagger_1.ApiParam)({ name: 'appNumber', description: '員工會員編號' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '調動評估' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeInsightController.prototype, "getTransferAssessment", null);
exports.EmployeeInsightController = EmployeeInsightController = __decorate([
    (0, swagger_1.ApiTags)('employee-insight'),
    (0, common_1.Controller)('v1/employee-insight'),
    __metadata("design:paramtypes", [employee_insight_service_1.EmployeeInsightService,
        employees_service_1.EmployeesService])
], EmployeeInsightController);
//# sourceMappingURL=employee-insight.controller.js.map