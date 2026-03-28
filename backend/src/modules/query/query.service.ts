import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { Employee } from '../employees/employees.dto';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisResult } from '../analysis/analysis.dto';
import { EmployeeInsightService } from '../insight/employee-insight.service';

export interface QueryRequest {
  question: string;
  employee_identifier?: {
    employeeappnumber?: string;
    employeeerpid?: string;
    name?: string;
  };
  context?: string;
  requester_id?: string;
}

export interface QueryResponse {
  answer: string;
  employee?: {
    id: string;
    name: string;
    employeeappnumber: string;
  };
  latest_analysis?: {
    id: string;
    risk_level: string;
    stress_level: string;
    summary: string;
    created_at: string;
  };
  confidence: number;
  sources: string[];
}

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

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly employeesService: EmployeesService,
    private readonly analysisService: AnalysisService,
    private readonly insightService: EmployeeInsightService,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * 處理問答查詢
   */
  async query(request: QueryRequest): Promise<QueryResponse> {
    this.logger.log(`Processing query: ${request.question.substring(0, 50)}...`);

    // 1. 識別員工（如果有提供識別資訊）
    let employee: Employee | null = null;

    if (request.employee_identifier) {
      employee = await this.employeesService.identify(request.employee_identifier);
    }

    // 2. 如果沒有提供識別資訊，嘗試從問題中提取員工名字
    if (!employee) {
      employee = await this.extractEmployeeFromQuestion(request.question);
    }

    // 3. 如果找到員工，使用 EmployeeInsightService 取得完整洞察
    let insight: any = null;
    if (employee) {
      try {
        insight = await this.insightService.getInsight(employee.employeeappnumber, { days: 30 });
        this.logger.log(`Got insight for ${employee.name}: ${insight.data_sources.official_message_count} messages`);
      } catch (error) {
        this.logger.warn(`Failed to get insight for ${employee.name}: ${error.message}`);
      }
    }

    // 4. 準備上下文
    const contextParts: string[] = [];

    if (employee) {
      contextParts.push(`【員工資訊】
- 姓名：${employee.name}
- 編號：${employee.employeeappnumber}
- 部門：${employee.department || '未知'}
- 門市：${employee.store_name || '未知'}
- 狀態：${employee.is_active ? '在職' : '離職'}${employee.is_leave ? '（留停中）' : ''}`);
    }

    if (insight) {
      // 加入資料來源統計
      contextParts.push(`【資料來源】
- 對話記錄：${insight.data_sources.conversation_count} 筆
- 官方頻道訊息：${insight.data_sources.official_message_count} 筆
- 資料時間範圍：${new Date(insight.data_sources.date_range.from).toLocaleDateString('zh-TW')} ~ ${new Date(insight.data_sources.date_range.to).toLocaleDateString('zh-TW')}`);

      // 加入 AI 分析摘要
      contextParts.push(`【AI 分析摘要】
- 風險等級：${this.translateRiskLevel(insight.summary.risk_level)}
- 壓力等級：${this.translateStressLevel(insight.summary.stress_level)}
- 趨勢：${insight.summary.trend === 'improving' ? '改善中' : insight.summary.trend === 'worsening' ? '惡化中' : '穩定'}
- 整體評估：${insight.summary.overall_assessment}
- 主要擔憂：${insight.summary.key_concerns?.join('、') || '無'}
- 正面訊號：${insight.summary.positive_signals?.join('、') || '無'}`);

      // 加入溝通建議
      contextParts.push(`【溝通建議】
- 建議時機：${insight.communication.suggested_timing}
- 開場方式：${insight.communication.opening_approach}
- 談話重點：${insight.communication.talking_points?.join('、') || '無'}
- 避免話題：${insight.communication.avoid_topics?.join('、') || '無'}
- 話術範例：${insight.communication.sample_phrases?.join('；') || '無'}`);

      // 加入時間軸摘要（最近 5 筆）
      if (insight.timeline && insight.timeline.length > 0) {
        const recentEvents = insight.timeline.slice(0, 5);
        const timelineText = recentEvents.map((e: any) => 
          `  - ${new Date(e.date).toLocaleDateString('zh-TW')} [${e.category}] ${e.content.substring(0, 50)}`
        ).join('\n');
        contextParts.push(`【近期事件】\n${timelineText}`);
      }

      // 加入調動評估
      contextParts.push(`【調動評估】
- 現職適任度：${insight.transfer_assessment.current_fitness === 'high' ? '高' : insight.transfer_assessment.current_fitness === 'low' ? '低' : '中等'}
- 調動風險：${insight.transfer_assessment.transfer_risk === 'high' ? '高' : insight.transfer_assessment.transfer_risk === 'low' ? '低' : '中等'}
- 離職風險：${insight.transfer_assessment.turnover_risk === 'high' ? '高' : insight.transfer_assessment.turnover_risk === 'low' ? '低' : '中等'}
- 建議：${insight.transfer_assessment.transfer_recommendation}`);
    }

    if (request.context) {
      contextParts.push(`【額外背景】\n${request.context}`);
    }

    // 5. 如果沒有 AI 或沒有員工，返回基本資訊
    if (!this.anthropic || !employee) {
      return this.buildBasicResponseWithInsight(employee, insight);
    }

    // 6. 呼叫 AI 生成回答
    const answer = await this.generateAIAnswer(
      request.question,
      contextParts.join('\n\n'),
    );

    // 7. 記錄查詢日誌
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
      latest_analysis: insight
        ? {
            id: 'insight',
            risk_level: insight.summary.risk_level || 'unknown',
            stress_level: insight.summary.stress_level || 'unknown',
            summary: insight.summary.overall_assessment || '',
            created_at: insight.analysis_metadata.analyzed_at,
          }
        : undefined,
      confidence: insight ? 0.85 : 0.5,
      sources: insight ? ['employee_insight', 'official_channel_messages'] : [],
    };
  }

  /**
   * 建立基本回應（含 Insight）
   */
  private buildBasicResponseWithInsight(
    employee: Employee | null,
    insight: any,
  ): QueryResponse {
    let answer = '';

    if (!employee) {
      answer = '找不到符合條件的員工資訊。';
    } else if (!insight || insight.data_sources.official_message_count === 0) {
      answer = `員工 ${employee.name} 目前沒有相關資料記錄。`;
    } else {
      answer = `員工 ${employee.name} 的狀態：
風險等級：${this.translateRiskLevel(insight.summary.risk_level)}
壓力等級：${this.translateStressLevel(insight.summary.stress_level)}
整體評估：${insight.summary.overall_assessment}
資料來源：${insight.data_sources.official_message_count} 筆官方頻道訊息`;
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
      latest_analysis: insight
        ? {
            id: 'insight',
            risk_level: insight.summary.risk_level || 'unknown',
            stress_level: insight.summary.stress_level || 'unknown',
            summary: insight.summary.overall_assessment || '',
            created_at: insight.analysis_metadata.analyzed_at,
          }
        : undefined,
      confidence: 0.5,
      sources: [],
    };
  }

  /**
   * 從問題中提取員工名字並搜尋
   */
  private async extractEmployeeFromQuestion(question: string): Promise<Employee | null> {
    // 搜尋所有員工，用問題內容比對
    const { data: employees } = await this.employeesService.search({ limit: 500 });
    
    for (const emp of employees) {
      if (question.includes(emp.name)) {
        this.logger.log(`Found employee from question: ${emp.name}`);
        return emp;
      }
    }

    return null;
  }

  /**
   * 取得員工狀態摘要
   */
  async getEmployeeStatusSummary(employeeIdentifier: {
    employeeappnumber?: string;
    employeeerpid?: string;
    name?: string;
  }): Promise<{
    found: boolean;
    employee?: Employee;
    current_status?: any;
    latest_analysis?: AnalysisResult;
    open_risk_flags?: number;
  }> {
    const employee = await this.employeesService.identify(employeeIdentifier);

    if (!employee) {
      return { found: false };
    }

    // 取得目前狀態快照
    const currentStatus = await this.supabase.findOne(
      'employee_current_status',
      { employee_id: employee.id },
      { useAdmin: true },
    );

    // 取得最新分析
    const latestAnalysis = await this.analysisService.getLatestByEmployee(employee.id);

    // 取得開放的風險標記數
    const openRiskFlags = await this.supabase.count(
      'risk_flags',
      { employee_id: employee.id, status: 'open' },
      { useAdmin: true },
    );

    return {
      found: true,
      employee,
      current_status: currentStatus,
      latest_analysis: latestAnalysis || undefined,
      open_risk_flags: openRiskFlags,
    };
  }

  /**
   * 生成 AI 回答
   */
  private async generateAIAnswer(question: string, context: string): Promise<string> {
    const userPrompt = `${context ? `${context}\n\n` : ''}問題：${question}`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
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
    } catch (error) {
      this.logger.error('AI answer generation failed:', error);
      return '系統暫時無法處理您的問題，請稍後再試。';
    }
  }

  /**
   * 建立基本回應（無 AI 時）
   */
  private buildBasicResponse(
    employee: Employee | null,
    latestAnalysis: AnalysisResult | null,
  ): QueryResponse {
    let answer = '';

    if (!employee) {
      answer = '找不到符合條件的員工資訊。';
    } else if (!latestAnalysis) {
      answer = `員工 ${employee.name} 目前沒有分析記錄。`;
    } else {
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

  /**
   * 記錄查詢日誌
   */
  private async logQuery(request: QueryRequest, employeeId?: string): Promise<void> {
    try {
      await this.supabase.create(
        'audit_logs',
        {
          user_id: request.requester_id,
          action: 'query',
          resource_type: 'employee_status',
          employee_id: employeeId,
          request_payload: {
            question: request.question.substring(0, 500),
            has_identifier: !!request.employee_identifier,
          },
        },
        { useAdmin: true },
      );
    } catch (error) {
      this.logger.error('Failed to log query:', error);
    }
  }

  /**
   * 翻譯風險等級
   */
  private translateRiskLevel(level?: string): string {
    const map: Record<string, string> = {
      low: '低風險',
      moderate: '中等風險',
      high: '高風險',
      critical: '極高風險',
    };
    return map[level || ''] || '未知';
  }

  /**
   * 翻譯壓力等級
   */
  private translateStressLevel(level?: string): string {
    const map: Record<string, string> = {
      low: '低壓力',
      moderate: '中等壓力',
      high: '高壓力',
      critical: '極高壓力',
    };
    return map[level || ''] || '未知';
  }
}
