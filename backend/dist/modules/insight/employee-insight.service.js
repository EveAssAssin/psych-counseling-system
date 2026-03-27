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
var EmployeeInsightService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeInsightService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const supabase_service_1 = require("../supabase/supabase.service");
const employees_service_1 = require("../employees/employees.service");
const official_channel_service_1 = require("../official-channel/official-channel.service");
const INSIGHT_SYSTEM_PROMPT = `你是一位專業的職場心理分析師與人力資源顧問，協助主管理解員工狀況並提供溝通策略。

你會收到一位員工的多種資料（可能包含部分或全部）：
- 基本資料（姓名、部門、職稱）
- 官方頻道訊息（LINE 對話、工單留言）
- 對話記錄（主管面談）
- 出勤紀錄
- 加扣分紀錄
- 客戶評價

請根據**實際提供的資料**進行分析，沒有的資料請標註「資料不足」。

分析時請注意：
1. **時間軸分析**：觀察資料的時間序列，找出趨勢變化和關鍵轉折點
2. **交叉驗證**：不同資料來源是否呈現一致的訊號
3. **脈絡理解**：結合工作環境和時間點理解行為背後原因
4. **實用建議**：給主管具體可行的溝通策略和話術

重要原則：
- 以「風險判讀」表述，不是「醫療診斷」
- 結論必須基於提供的資料，不可無依據臆測
- 高風險判定標準：自傷暗示、明顯崩潰、強烈離職意向、嚴重職場衝突
- 所有回答使用正體中文
- 話術建議要具體、自然、可直接使用

請以 JSON 格式輸出，嚴格遵循指定的 schema。`;
let EmployeeInsightService = EmployeeInsightService_1 = class EmployeeInsightService {
    constructor(configService, supabase, employeesService, officialChannelService) {
        this.configService = configService;
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.officialChannelService = officialChannelService;
        this.logger = new common_1.Logger(EmployeeInsightService_1.name);
        const apiKey = this.configService.get('anthropic.apiKey');
        if (apiKey) {
            this.anthropic = new sdk_1.default({ apiKey });
            this.logger.log('EmployeeInsightService initialized');
        }
    }
    async getInsight(employeeAppNumber, options) {
        const days = options?.days || 30;
        this.logger.log(`Generating insight for employee: ${employeeAppNumber}, days: ${days}`);
        const employee = await this.employeesService.findByAppNumber(employeeAppNumber);
        if (!employee) {
            throw new Error(`Employee not found: ${employeeAppNumber}`);
        }
        const collectedData = await this.collectEmployeeData(employee.id, employeeAppNumber, days);
        const timeline = this.buildTimeline(collectedData);
        const aiAnalysis = await this.callAIAnalysis(employee, collectedData, timeline);
        const insight = {
            employee: {
                id: employee.id,
                name: employee.name,
                app_number: employee.employeeappnumber,
                erp_id: employee.employeeerpid || '',
                department: employee.department || '',
                store_name: employee.store_name || '',
                title: employee.title || '',
                is_active: employee.is_active,
            },
            data_sources: {
                has_conversations: collectedData.conversations.length > 0,
                has_official_messages: collectedData.officialMessages.length > 0,
                has_attendance: collectedData.attendance.length > 0,
                has_scores: collectedData.scores.length > 0,
                has_reviews: collectedData.reviews.length > 0,
                conversation_count: collectedData.conversations.length,
                official_message_count: collectedData.officialMessages.length,
                date_range: this.getDateRange(timeline),
            },
            timeline,
            ...aiAnalysis,
            analysis_metadata: {
                analyzed_at: new Date().toISOString(),
                model: this.configService.get('anthropic.model') || 'claude-sonnet-4-20250514',
                confidence_score: aiAnalysis.confidence_score || 0.7,
                data_completeness: this.calculateDataCompleteness(collectedData),
            },
        };
        return insight;
    }
    async collectEmployeeData(employeeId, appNumber, days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString();
        const officialMessages = await this.officialChannelService.getByEmployeeId(employeeId, 200);
        const filteredMessages = officialMessages.filter(m => m.message_time >= sinceStr);
        const conversations = await this.supabase.findMany('conversation_intakes', {
            filters: { employee_id: employeeId },
            orderBy: { column: 'conversation_date', ascending: false },
            useAdmin: true,
        });
        const filteredConversations = conversations.filter((c) => c.conversation_date && c.conversation_date >= sinceStr);
        const analyses = await this.supabase.findMany('analysis_results', {
            filters: { employee_id: employeeId },
            orderBy: { column: 'created_at', ascending: false },
            limit: 10,
            useAdmin: true,
        });
        const attendance = [];
        const scores = [];
        const reviews = [];
        return {
            officialMessages: filteredMessages,
            conversations: filteredConversations,
            analyses,
            attendance,
            scores,
            reviews,
        };
    }
    buildTimeline(data) {
        const events = [];
        for (const msg of data.officialMessages) {
            events.push({
                date: msg.message_time,
                type: msg.channel === 'official-line' ? 'line_message' : 'ticket_comment',
                category: msg.channel === 'official-line' ? 'LINE 訊息' : '工單留言',
                content: msg.message_text,
                sentiment: this.detectSentiment(msg.message_text),
                metadata: {
                    direction: msg.direction,
                    ticket_no: msg.ticket_no,
                    author_name: msg.author_name,
                },
            });
        }
        for (const conv of data.conversations) {
            events.push({
                date: conv.conversation_date,
                type: 'conversation',
                category: conv.conversation_type || '對話記錄',
                content: conv.raw_text?.substring(0, 200) || '（詳見對話內容）',
                metadata: {
                    interviewer: conv.interviewer_name,
                    priority: conv.priority,
                },
            });
        }
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return events;
    }
    detectSentiment(text) {
        const negativeKeywords = ['壓力', '累', '煩', '不想', '難', '問題', '錯', '抱怨', '生氣', '離職', '不開心'];
        const positiveKeywords = ['感謝', '謝謝', '好', '棒', '開心', '順利', '成功', '感恩'];
        const lowerText = text.toLowerCase();
        const negCount = negativeKeywords.filter(k => lowerText.includes(k)).length;
        const posCount = positiveKeywords.filter(k => lowerText.includes(k)).length;
        if (negCount > posCount)
            return 'negative';
        if (posCount > negCount)
            return 'positive';
        return 'neutral';
    }
    calculateDataCompleteness(data) {
        let score = 0;
        let total = 5;
        if (data.officialMessages.length > 0)
            score++;
        if (data.conversations.length > 0)
            score++;
        if (data.attendance.length > 0)
            score++;
        if (data.scores.length > 0)
            score++;
        if (data.reviews.length > 0)
            score++;
        return Math.round((score / total) * 100) / 100;
    }
    getDateRange(timeline) {
        if (timeline.length === 0) {
            const now = new Date().toISOString();
            return { from: now, to: now };
        }
        const dates = timeline.map(e => new Date(e.date).getTime());
        return {
            from: new Date(Math.min(...dates)).toISOString(),
            to: new Date(Math.max(...dates)).toISOString(),
        };
    }
    async callAIAnalysis(employee, data, timeline) {
        if (!this.anthropic) {
            return this.getDefaultAnalysis();
        }
        const analysisInput = this.prepareAnalysisInput(employee, data, timeline);
        const userPrompt = `請分析以下員工資料，並依照指定格式輸出 JSON：

${analysisInput}

請輸出以下格式的 JSON（所有欄位都要填寫，沒有資料的請合理推測或標註「資料不足」）：

{
  "summary": {
    "risk_level": "low|moderate|high|critical",
    "stress_level": "low|moderate|high|critical",
    "trend": "improving|stable|worsening",
    "overall_assessment": "整體評估描述（2-3句話）",
    "key_concerns": ["主要擔憂1", "主要擔憂2"],
    "positive_signals": ["正面訊號1", "正面訊號2"],
    "last_analyzed": "${new Date().toISOString()}"
  },
  "communication": {
    "suggested_timing": "建議溝通時機",
    "opening_approach": "開場方式建議",
    "talking_points": ["談話重點1", "談話重點2", "談話重點3"],
    "avoid_topics": ["避免話題1", "避免話題2"],
    "expected_reactions": ["可能反應1", "可能反應2"],
    "response_strategies": [
      {"if": "如果員工說...", "then": "建議回應..."},
      {"if": "如果員工表現...", "then": "建議做法..."}
    ],
    "sample_phrases": ["具體話術範例1", "具體話術範例2", "具體話術範例3"]
  },
  "transfer_assessment": {
    "current_fitness": "high|medium|low",
    "transfer_risk": "high|medium|low",
    "transfer_recommendation": "調動建議說明",
    "suitable_role_types": ["適合的工作類型1", "適合的工作類型2"],
    "mentoring_capacity": "ready|not_recommended|needs_support",
    "stress_tolerance": "high|medium|low",
    "turnover_risk": "high|medium|low",
    "turnover_signals": ["離職訊號1", "離職訊號2"]
  },
  "team_dynamics": {
    "collaboration_willingness": "high|medium|low",
    "team_influence": "positive|neutral|negative",
    "interpersonal_notes": ["人際關係觀察1", "人際關係觀察2"]
  },
  "historical_patterns": {
    "recurring_issues": ["重複出現的問題1"],
    "improvement_history": ["改善紀錄1"],
    "key_turning_points": [
      {"date": "日期", "event": "事件", "impact": "影響"}
    ]
  },
  "recommended_actions": {
    "immediate": ["立即行動1", "立即行動2"],
    "short_term": ["短期行動1", "短期行動2"],
    "long_term": ["長期行動1"]
  },
  "confidence_score": 0.0-1.0
}`;
        try {
            const response = await this.anthropic.messages.create({
                model: this.configService.get('anthropic.model') || 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: INSIGHT_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
            });
            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type');
            }
            let jsonText = content.text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }
            else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            return JSON.parse(jsonText);
        }
        catch (error) {
            this.logger.error('AI analysis failed:', error);
            return this.getDefaultAnalysis();
        }
    }
    prepareAnalysisInput(employee, data, timeline) {
        let input = `【員工基本資料】
姓名：${employee.name}
部門：${employee.department || '未知'}
門市：${employee.store_name || '未知'}
職稱：${employee.title || '未知'}
狀態：${employee.is_active ? '在職' : '離職'}

`;
        if (timeline.length > 0) {
            input += `【時間軸資料】（共 ${timeline.length} 筆，近 30 天）\n`;
            const recentEvents = timeline.slice(0, 50);
            for (const event of recentEvents) {
                const date = new Date(event.date).toLocaleDateString('zh-TW');
                const sentiment = event.sentiment === 'negative' ? '⚠️' : event.sentiment === 'positive' ? '✓' : '';
                input += `${date} [${event.category}] ${sentiment} ${event.content.substring(0, 100)}\n`;
            }
            input += '\n';
        }
        else {
            input += `【時間軸資料】\n無資料\n\n`;
        }
        if (data.analyses && data.analyses.length > 0) {
            const latest = data.analyses[0];
            input += `【最近分析結果】
分析日期：${new Date(latest.created_at).toLocaleDateString('zh-TW')}
風險等級：${latest.risk_level || '未知'}
壓力等級：${latest.stress_level || '未知'}
心理狀態：${latest.current_psychological_state || '未知'}
摘要：${latest.summary || '無'}

`;
        }
        input += `【資料統計】
官方頻道訊息：${data.officialMessages.length} 筆
對話記錄：${data.conversations.length} 筆
出勤紀錄：${data.attendance.length} 筆（待同步）
加扣分紀錄：${data.scores.length} 筆（待同步）
客戶評價：${data.reviews.length} 筆（待同步）
`;
        return input;
    }
    getDefaultAnalysis() {
        return {
            summary: {
                risk_level: 'low',
                stress_level: 'low',
                trend: 'stable',
                overall_assessment: '資料不足，無法進行完整分析',
                key_concerns: [],
                positive_signals: [],
                last_analyzed: new Date().toISOString(),
            },
            communication: {
                suggested_timing: '建議先收集更多資料',
                opening_approach: '以一般關心方式開場',
                talking_points: ['了解近期工作狀況', '詢問是否需要協助'],
                avoid_topics: [],
                expected_reactions: ['資料不足，無法預測'],
                response_strategies: [],
                sample_phrases: ['最近工作還順利嗎？', '有什麼需要我協助的嗎？'],
            },
            transfer_assessment: {
                current_fitness: 'medium',
                transfer_risk: 'medium',
                transfer_recommendation: '資料不足，建議先收集更多資訊再評估',
                suitable_role_types: [],
                mentoring_capacity: 'needs_support',
                stress_tolerance: 'medium',
                turnover_risk: 'medium',
                turnover_signals: [],
            },
            team_dynamics: {
                collaboration_willingness: 'medium',
                team_influence: 'neutral',
                interpersonal_notes: ['資料不足'],
            },
            historical_patterns: {
                recurring_issues: [],
                improvement_history: [],
                key_turning_points: [],
            },
            recommended_actions: {
                immediate: ['收集更多員工資料'],
                short_term: ['安排一次面談了解狀況'],
                long_term: ['建立定期關心機制'],
            },
            confidence_score: 0.3,
        };
    }
};
exports.EmployeeInsightService = EmployeeInsightService;
exports.EmployeeInsightService = EmployeeInsightService = EmployeeInsightService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService,
        official_channel_service_1.OfficialChannelService])
], EmployeeInsightService);
//# sourceMappingURL=employee-insight.service.js.map