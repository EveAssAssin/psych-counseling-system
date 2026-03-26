import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { Employee } from '../employees/employees.dto';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisResult } from '../analysis/analysis.dto';

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
    let latestAnalysis: AnalysisResult | null = null;

    if (request.employee_identifier) {
      employee = await this.employeesService.identify(request.employee_identifier);

      if (employee) {
        latestAnalysis = await this.analysisService.getLatestByEmployee(employee.id);
      }
    }

    // 2. 準備上下文
    const contextParts: string[] = [];

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

    // 3. 如果沒有 AI，返回基本資訊
    if (!this.anthropic) {
      return this.buildBasicResponse(employee, latestAnalysis);
    }

    // 4. 呼叫 AI 生成回答
    const answer = await this.generateAIAnswer(
      request.question,
      contextParts.join('\n\n'),
    );

    // 5. 記錄查詢日誌
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
