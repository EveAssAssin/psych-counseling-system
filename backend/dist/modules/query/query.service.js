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
var QueryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const supabase_service_1 = require("../supabase/supabase.service");
const employees_service_1 = require("../employees/employees.service");
const analysis_service_1 = require("../analysis/analysis.service");
const QUERY_SYSTEM_PROMPT = `你是一個企業心理輔導系統的查詢助手。你的任務是根據提供的員工資訊和分析結果，回答主管或 HR 的問題。

回答原則：
1. 僅基於提供的資料回答，不要編造資訊
2. 如果沒有足夠資訊，明確說明
3. 保護員工隱私，不透露不必要的細節
4. 使用專業但易懂的語言
5. 如果涉及高風險情況，提醒查詢者注意
6. 回答要簡潔有重點

回答格式：
- 直接回答問題
- 如有需要，提供建議行動
- 如有風險提示，用【注意】標示`;
let QueryService = QueryService_1 = class QueryService {
    constructor(configService, supabase, employeesService, analysisService) {
        this.configService = configService;
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.analysisService = analysisService;
        this.logger = new common_1.Logger(QueryService_1.name);
        const apiKey = this.configService.get('anthropic.apiKey');
        if (apiKey) {
            this.anthropic = new sdk_1.default({ apiKey });
        }
    }
    async query(request) {
        this.logger.log(`Processing query: ${request.question.substring(0, 50)}...`);
        let employee = null;
        let latestAnalysis = null;
        if (request.employee_identifier) {
            employee = await this.employeesService.identify(request.employee_identifier);
            if (employee) {
                latestAnalysis = await this.analysisService.getLatestByEmployee(employee.id);
            }
        }
        const contextParts = [];
        if (employee) {
            contextParts.push(`【員工資訊】
- 姓名：${employee.name}
- 編號：${employee.employeeappnumber}
- 部門：${employee.department || '未知'}
- 門市：${employee.store_name || '未知'}
- 狀態：${employee.is_active ? '在職' : '離職'}${employee.is_leave ? '（留停中）' : ''}`);
        }
        if (latestAnalysis) {
            contextParts.push(`【最新分析結果】（${latestAnalysis.created_at}）
- 風險等級：${this.translateRiskLevel(latestAnalysis.risk_level)}
- 壓力等級：${this.translateStressLevel(latestAnalysis.stress_level)}
- 心理狀態：${latestAnalysis.current_psychological_state}
- 摘要：${latestAnalysis.summary}
- 建議行動：${latestAnalysis.suggested_actions?.join('、') || '無'}
- 是否需追蹤：${latestAnalysis.followup_needed ? '是' : '否'}`);
        }
        if (request.context) {
            contextParts.push(`【額外背景】\n${request.context}`);
        }
        if (!this.anthropic) {
            return this.buildBasicResponse(employee, latestAnalysis);
        }
        const answer = await this.generateAIAnswer(request.question, contextParts.join('\n\n'));
        await this.logQuery(request, employee?.id);
        return {
            answer,
            employee: employee
                ? {
                    id: employee.id,
                    name: employee.name,
                    employeeappnumber: employee.employeeappnumber,
                }
                : undefined,
            latest_analysis: latestAnalysis
                ? {
                    id: latestAnalysis.id,
                    risk_level: latestAnalysis.risk_level || 'unknown',
                    stress_level: latestAnalysis.stress_level || 'unknown',
                    summary: latestAnalysis.summary || '',
                    created_at: latestAnalysis.created_at,
                }
                : undefined,
            confidence: latestAnalysis ? 0.85 : 0.6,
            sources: latestAnalysis ? ['analysis_results'] : [],
        };
    }
    async getEmployeeStatusSummary(employeeIdentifier) {
        const employee = await this.employeesService.identify(employeeIdentifier);
        if (!employee) {
            return { found: false };
        }
        const currentStatus = await this.supabase.findOne('employee_current_status', { employee_id: employee.id }, { useAdmin: true });
        const latestAnalysis = await this.analysisService.getLatestByEmployee(employee.id);
        const openRiskFlags = await this.supabase.count('risk_flags', { employee_id: employee.id, status: 'open' }, { useAdmin: true });
        return {
            found: true,
            employee,
            current_status: currentStatus,
            latest_analysis: latestAnalysis || undefined,
            open_risk_flags: openRiskFlags,
        };
    }
    async generateAIAnswer(question, context) {
        const userPrompt = `${context ? `${context}\n\n` : ''}問題：${question}`;
        try {
            const response = await this.anthropic.messages.create({
                model: this.configService.get('anthropic.model') || 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: QUERY_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            });
            const content = response.content[0];
            if (content.type === 'text') {
                return content.text;
            }
            return '抱歉，無法生成回答。';
        }
        catch (error) {
            this.logger.error('AI answer generation failed:', error);
            return '系統暫時無法處理您的問題，請稍後再試。';
        }
    }
    buildBasicResponse(employee, latestAnalysis) {
        let answer = '';
        if (!employee) {
            answer = '找不到符合條件的員工資訊。';
        }
        else if (!latestAnalysis) {
            answer = `員工 ${employee.name} 目前沒有分析記錄。`;
        }
        else {
            answer = `員工 ${employee.name} 的最新狀態：
風險等級：${this.translateRiskLevel(latestAnalysis.risk_level)}
壓力等級：${this.translateStressLevel(latestAnalysis.stress_level)}
摘要：${latestAnalysis.summary || '無'}`;
        }
        return {
            answer,
            employee: employee
                ? {
                    id: employee.id,
                    name: employee.name,
                    employeeappnumber: employee.employeeappnumber,
                }
                : undefined,
            latest_analysis: latestAnalysis
                ? {
                    id: latestAnalysis.id,
                    risk_level: latestAnalysis.risk_level || 'unknown',
                    stress_level: latestAnalysis.stress_level || 'unknown',
                    summary: latestAnalysis.summary || '',
                    created_at: latestAnalysis.created_at,
                }
                : undefined,
            confidence: 0.5,
            sources: [],
        };
    }
    async logQuery(request, employeeId) {
        try {
            await this.supabase.create('audit_logs', {
                user_id: request.requester_id,
                action: 'query',
                resource_type: 'employee_status',
                employee_id: employeeId,
                request_payload: {
                    question: request.question.substring(0, 500),
                    has_identifier: !!request.employee_identifier,
                },
            }, { useAdmin: true });
        }
        catch (error) {
            this.logger.error('Failed to log query:', error);
        }
    }
    translateRiskLevel(level) {
        const map = {
            low: '低風險',
            moderate: '中等風險',
            high: '高風險',
            critical: '極高風險',
        };
        return map[level || ''] || '未知';
    }
    translateStressLevel(level) {
        const map = {
            low: '低壓力',
            moderate: '中等壓力',
            high: '高壓力',
            critical: '極高壓力',
        };
        return map[level || ''] || '未知';
    }
};
exports.QueryService = QueryService;
exports.QueryService = QueryService = QueryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService,
        analysis_service_1.AnalysisService])
], QueryService);
//# sourceMappingURL=query.service.js.map