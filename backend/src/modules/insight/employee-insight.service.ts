import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { OfficialChannelService } from '../official-channel/official-channel.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TicketHistoryService } from '../ticket-history/ticket-history.service';

// ============================================
// 時間軸事件
// ============================================
export interface TimelineEvent {
  date: string;
  type: 'line_message' | 'ticket_comment' | 'conversation' | 'attendance' | 'score' | 'review' | 'ticket_created' | 'ticket_event';
  category: string;
  content: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  metadata?: Record<string, any>;
}

// ============================================
// 綜合分析輸出
// ============================================
export interface EmployeeInsight {
  employee: {
    id: string;
    name: string;
    app_number: string;
    erp_id: string;
    department: string;
    store_name: string;
    title: string;
    is_active: boolean;
  };

  data_sources: {
    has_conversations: boolean;
    has_official_messages: boolean;
    has_attendance: boolean;
    has_scores: boolean;
    has_reviews: boolean;
    has_ticket_history: boolean;
    conversation_count: number;
    official_message_count: number;
    ticket_count: number;
    date_range: { from: string; to: string };
  };

  summary: {
    risk_level: 'low' | 'moderate' | 'high' | 'critical';
    stress_level: 'low' | 'moderate' | 'high' | 'critical';
    trend: 'improving' | 'stable' | 'worsening';
    overall_assessment: string;
    key_concerns: string[];
    positive_signals: string[];
    last_analyzed: string;
  };

  timeline: TimelineEvent[];

  communication: {
    suggested_timing: string;
    opening_approach: string;
    talking_points: string[];
    avoid_topics: string[];
    expected_reactions: string[];
    response_strategies: { if: string; then: string }[];
    sample_phrases: string[];
  };

  transfer_assessment: {
    current_fitness: 'high' | 'medium' | 'low';
    transfer_risk: 'high' | 'medium' | 'low';
    transfer_recommendation: string;
    suitable_role_types: string[];
    mentoring_capacity: 'ready' | 'not_recommended' | 'needs_support';
    stress_tolerance: 'high' | 'medium' | 'low';
    turnover_risk: 'high' | 'medium' | 'low';
    turnover_signals: string[];
  };

  team_dynamics: {
    collaboration_willingness: 'high' | 'medium' | 'low';
    team_influence: 'positive' | 'neutral' | 'negative';
    interpersonal_notes: string[];
  };

  historical_patterns: {
    recurring_issues: string[];
    improvement_history: string[];
    key_turning_points: { date: string; event: string; impact: string }[];
  };

  recommended_actions: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };

  analysis_metadata: {
    analyzed_at: string;
    model: string;
    confidence_score: number;
    data_completeness: number;
  };
}

// ============================================
// AI 分析 Prompt
// ============================================
const INSIGHT_SYSTEM_PROMPT = `你是一位專業的職場心理分析師與人力資源顧問，協助主管理解員工狀況並提供溝通策略。

你會收到一位員工的多種資料（可能包含部分或全部）：
- 基本資料（姓名、部門、職稱）
- 官方頻道訊息（LINE 對話）
- 工單回報歷史（員工提報的問題工單、類別、處理狀態、對話內容）
- 對話記錄（主管面談）
- 出勤紀錄
- 加扣分紀錄
- 客戶評價/客訴（含評價回覆對話、處理速度、緊急程度）

請根據**實際提供的資料**進行分析，沒有的資料請標註「資料不足」。

【客戶評價分析重點】
評價資料是員工面對客戶壓力最直接的指標：
- **負評比例與頻率**：持續收到負評可能造成自我懷疑或防禦性心態
- **特急/緊急評價**：頻繁遇到高壓客訴，心理負擔加重
- **回覆處理速度**：平均回覆時間反映壓力應對能力（過快可能過度緊張，超時未回可能疲憊/逃避）
- **代理處理情況**：被他人代為處理的評價比例，可能反映協作狀況或問題迴避
- **待處理積壓**：未結案評價數量，積壓多表示壓力持續堆疊
- **評價對話內容**：員工回覆客訴的文字風格（是否顯現出道歉過度、情緒化、防禦性）
- **正評的激勵效果**：正面評價是否帶來明顯正向轉變

【工單分析重點】
工單回報行為能反映員工的工作壓力與心理狀態：
- **高頻率回報**：員工主動反映問題，可能是盡責表現，也可能是工作環境困難的訊號
- **重複性同類問題**：系統/流程未解決，持續造成挫折感
- **緊急工單比例高**：頻繁遇到突發狀況，壓力負荷可能偏高
- **工單長期未結案**：等待支援時間長，可能造成無力感
- **工單內容情緒**：描述用詞是否帶有挫折、抱怨、焦慮情緒
- **回報類別**：ERP 問題 vs APP 問題 vs 客戶問題，不同類別代表不同壓力來源

【官方頻道分析重點】
LINE 訊息是員工日常溝通的真實紀錄：
- **訊息頻率變化**：突然減少或增加都可能有意義
- **情緒用詞**：是否出現壓力、疲憊、不滿等關鍵詞
- **回應速度**：對工程師/主管訊息的回應時間

分析時請注意：
1. **時間軸分析**：觀察資料的時間序列，找出趨勢變化和關鍵轉折點
2. **交叉驗證**：客訴評價 + 工單問題 + LINE 訊息 + 面談內容是否呈現一致的訊號
3. **壓力源識別**：區分是來自「客戶壓力」、「系統/流程問題」還是「職場人際」
4. **脈絡理解**：結合工作環境和時間點理解行為背後原因
5. **實用建議**：給主管具體可行的溝通策略和話術

重要原則：
- 以「風險判讀」表述，不是「醫療診斷」
- 結論必須基於提供的資料，不可無依據臆測
- 高風險判定標準：自傷暗示、明顯崩潰、強烈離職意向、嚴重職場衝突
- 所有回答使用正體中文
- 話術建議要具體、自然、可直接使用

請以 JSON 格式輸出，嚴格遵循指定的 schema。`;

@Injectable()
export class EmployeeInsightService {
  private readonly logger = new Logger(EmployeeInsightService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly employeesService: EmployeesService,
    private readonly officialChannelService: OfficialChannelService,
    private readonly reviewsService: ReviewsService,
    private readonly ticketHistoryService: TicketHistoryService,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('EmployeeInsightService initialized');
    }
  }

  /**
   * 取得員工綜合洞察（主要 API）
   */
  async getInsight(employeeAppNumber: string, options?: {
    days?: number;
    forceRefresh?: boolean;
  }): Promise<EmployeeInsight> {
    const days = options?.days || 30;
    const forceRefresh = options?.forceRefresh || false;

    this.logger.log(`Getting insight for employee: ${employeeAppNumber}, days: ${days}, forceRefresh: ${forceRefresh}`);

    const employee = await this.employeesService.findByAppNumber(employeeAppNumber);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeAppNumber}`);
    }

    if (!forceRefresh) {
      const cached = await this.getCachedInsight(employee.id);
      if (cached) {
        this.logger.log(`Using cached insight for ${employeeAppNumber}`);
        return cached;
      }
    }

    const collectedData = await this.collectEmployeeData(employee.id, employeeAppNumber, days);
    const timeline = this.buildTimeline(collectedData);
    const aiAnalysis = await this.callAIAnalysis(employee, collectedData, timeline);

    const insight: EmployeeInsight = {
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
        has_ticket_history: collectedData.tickets.length > 0,
        conversation_count: collectedData.conversations.length,
        official_message_count: collectedData.officialMessages.length,
        ticket_count: collectedData.tickets.length,
        date_range: this.getDateRange(timeline),
      },
      timeline,
      ...aiAnalysis,
      analysis_metadata: {
        analyzed_at: new Date().toISOString(),
        model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
        confidence_score: aiAnalysis.confidence_score || 0.7,
        data_completeness: this.calculateDataCompleteness(collectedData),
      },
    };

    await this.saveInsight(employee.id, insight);

    return insight;
  }

  /**
   * 取得快取的洞察結果
   */
  private async getCachedInsight(employeeId: string): Promise<EmployeeInsight | null> {
    try {
      const cached: any = await this.supabase.findOne('employee_insights',
        { employee_id: employeeId },
        { useAdmin: true }
      );

      if (!cached) return null;

      const employee = await this.employeesService.findById(employeeId);

      return {
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
        data_sources: cached.data_sources || {},
        timeline: cached.timeline_snapshot || [],
        summary: {
          risk_level: cached.risk_level || 'low',
          stress_level: cached.stress_level || 'low',
          trend: cached.trend || 'stable',
          overall_assessment: cached.overall_assessment || '',
          key_concerns: cached.key_concerns || [],
          positive_signals: cached.positive_signals || [],
          last_analyzed: cached.analyzed_at,
        },
        communication: cached.communication || {},
        transfer_assessment: cached.transfer_assessment || {},
        team_dynamics: cached.team_dynamics || {},
        historical_patterns: cached.historical_patterns || {},
        recommended_actions: cached.recommended_actions || {},
        analysis_metadata: {
          analyzed_at: cached.analyzed_at,
          model: cached.model_name || 'claude-sonnet-4-20250514',
          confidence_score: cached.confidence_score || 0.7,
          data_completeness: cached.data_completeness || 0.2,
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to get cached insight: ${error.message}`);
      return null;
    }
  }

  /**
   * 儲存洞察結果到資料庫
   */
  private async saveInsight(employeeId: string, insight: EmployeeInsight): Promise<void> {
    try {
      const data = {
        employee_id: employeeId,
        data_sources: insight.data_sources,
        risk_level: insight.summary?.risk_level || 'low',
        stress_level: insight.summary?.stress_level || 'low',
        trend: insight.summary?.trend || 'stable',
        overall_assessment: insight.summary?.overall_assessment || '',
        key_concerns: insight.summary?.key_concerns || [],
        positive_signals: insight.summary?.positive_signals || [],
        communication: insight.communication || {},
        transfer_assessment: insight.transfer_assessment || {},
        team_dynamics: insight.team_dynamics || {},
        historical_patterns: insight.historical_patterns || {},
        recommended_actions: insight.recommended_actions || {},
        timeline_snapshot: (insight.timeline || []).slice(0, 30),
        model_name: insight.analysis_metadata?.model || 'claude-sonnet-4-20250514',
        confidence_score: insight.analysis_metadata?.confidence_score || 0.7,
        data_completeness: insight.analysis_metadata?.data_completeness || 0.2,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.supabase.upsert('employee_insights', data, {
        onConflict: 'employee_id',
        useAdmin: true,
      });

      this.logger.log(`Saved insight for employee: ${employeeId}`);
    } catch (error) {
      this.logger.error(`Failed to save insight: ${error.message}`);
    }
  }

  /**
   * 刪除員工的快取洞察
   */
  async clearInsightCache(employeeId: string): Promise<void> {
    try {
      await this.supabase.delete('employee_insights', { employee_id: employeeId }, { useAdmin: true });
      this.logger.log(`Cleared insight cache for employee: ${employeeId}`);
    } catch (error) {
      this.logger.warn(`Failed to clear insight cache: ${error.message}`);
    }
  }

  /**
   * 收集員工所有可用資料
   */
  private async collectEmployeeData(employeeId: string, appNumber: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    // 官方頻道訊息（LINE）
    const officialMessages = await this.officialChannelService.getByEmployeeId(employeeId, 200);
    const filteredMessages = officialMessages.filter(m => m.message_time >= sinceStr);

    // 對話記錄（主管面談）
    const conversations = await this.supabase.findMany('conversation_intakes', {
      filters: { employee_id: employeeId },
      orderBy: { column: 'conversation_date', ascending: false },
      useAdmin: true,
    });
    const filteredConversations = conversations.filter((c: any) =>
      c.conversation_date && c.conversation_date >= sinceStr
    );

    // 最近 AI 分析結果
    const analyses = await this.supabase.findMany('analysis_results', {
      filters: { employee_id: employeeId },
      orderBy: { column: 'created_at', ascending: false },
      limit: 10,
      useAdmin: true,
    });

    // 評價/客訴紀錄（所有時間，客訴是長期重要資料；略過軟刪除的評價）
    const allReviewsRaw = await this.reviewsService.findByEmployee(employeeId, 200);
    const allReviews = allReviewsRaw.filter((r: any) => !r.deleted_at);

    // 近期評價（限 days 內，同樣排除軟刪除）
    const reviews = allReviews.filter((r: any) =>
      r.created_at && r.created_at >= sinceStr
    );

    // 評價統計（含緊急程度分布）
    const urgentPlus = reviews.filter((r: any) => r.urgency === 'urgent_plus').length;
    const urgent = reviews.filter((r: any) => r.urgency === 'urgent').length;
    const respondedReviews = reviews.filter((r: any) => r.response_speed_hours != null);
    const fastResponses = respondedReviews.filter((r: any) => r.response_speed_hours <= 2).length;
    const slowResponses = respondedReviews.filter((r: any) => r.response_speed_hours > 24).length;

    const reviewStats = {
      total: reviews.length,
      all_time_total: allReviews.length,
      positive: reviews.filter((r: any) => r.review_type === 'positive').length,
      negative: reviews.filter((r: any) => r.review_type === 'negative').length,
      other: reviews.filter((r: any) => r.review_type === 'other').length,
      pending: reviews.filter((r: any) => r.status === 'pending' && r.requires_response).length,
      responded: reviews.filter((r: any) => r.status === 'responded').length,
      closed: reviews.filter((r: any) => r.status === 'closed').length,
      proxy_count: reviews.filter((r: any) => r.is_proxy).length,
      urgent_plus: urgentPlus,
      urgent: urgent,
      avg_response_hours: this.calculateAvgResponseHours(reviews),
      fast_responses: fastResponses,   // ≤2 小時
      slow_responses: slowResponses,   // >24 小時
    };

    // 取近期評價的回覆對話（最多 10 筆負評或特急/緊急評價）
    const priorityReviews = reviews
      .filter((r: any) => r.review_type === 'negative' || r.urgency !== 'normal')
      .slice(0, 10);

    const reviewConversations: Array<{ review: any; responses: any[] }> = [];
    for (const review of priorityReviews) {
      try {
        const responses = await this.reviewsService.getResponses(review.id);
        if (responses.length > 0) {
          reviewConversations.push({ review, responses });
        }
      } catch {
        // 忽略
      }
    }

    // 工單歷史（所有時間，不限 days，工單是長期累積的重要資料）
    const tickets = await this.ticketHistoryService.getByEmployeeAppNumber(appNumber, 100);

    // 近期工單（限 days 內）
    const recentTickets = tickets.filter(t =>
      t.ticket_created_at && t.ticket_created_at >= sinceStr
    );

    // 工單統計
    const ticketStats = this.calculateTicketStats(tickets, recentTickets);

    // 取近期工單的對話事件（最多 10 張工單）
    const ticketConversations: Array<{ ticket: any; events: any[] }> = [];
    for (const ticket of recentTickets.slice(0, 10)) {
      try {
        const events = await this.ticketHistoryService.getConversationsByTicketId(ticket.ticket_id);
        if (events.length > 0) {
          ticketConversations.push({ ticket, events });
        }
      } catch (e) {
        // 忽略查不到的
      }
    }

    return {
      officialMessages: filteredMessages,
      conversations: filteredConversations,
      analyses,
      attendance: [],   // 待實作
      scores: [],       // 待實作
      reviews,
      allReviews,
      reviewStats,
      reviewConversations,
      tickets,
      recentTickets,
      ticketStats,
      ticketConversations,
    };
  }

  /**
   * 計算工單統計
   */
  private calculateTicketStats(allTickets: any[], recentTickets: any[]) {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const t of allTickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.parent_category) {
        byCategory[t.parent_category] = (byCategory[t.parent_category] || 0) + 1;
      }
    }

    // 計算平均結案時間（天）
    const closedTickets = allTickets.filter(t => t.status === 'closed' && t.ticket_created_at && t.ticket_closed_at);
    const avgCloseDays = closedTickets.length > 0
      ? Math.round(
          closedTickets.reduce((sum, t) => {
            const diff = new Date(t.ticket_closed_at).getTime() - new Date(t.ticket_created_at).getTime();
            return sum + diff / (1000 * 60 * 60 * 24);
          }, 0) / closedTickets.length * 10
        ) / 10
      : 0;

    // 未結案工單
    const openTickets = allTickets.filter(t =>
      ['pending', 'in_progress', 'waiting_info'].includes(t.status)
    );

    return {
      total: allTickets.length,
      recent_count: recentTickets.length,
      by_status: byStatus,
      by_priority: byPriority,
      by_category: Object.entries(byCategory)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      avg_close_days: avgCloseDays,
      open_count: openTickets.length,
      high_priority_count: allTickets.filter(t => t.priority === 'high').length,
      open_tickets: openTickets.slice(0, 5),
    };
  }

  /**
   * 計算平均回覆時間
   */
  private calculateAvgResponseHours(reviews: any[]): number {
    const respondedReviews = reviews.filter(r => r.response_speed_hours != null);
    if (respondedReviews.length === 0) return 0;
    const total = respondedReviews.reduce((sum, r) => sum + (r.response_speed_hours || 0), 0);
    return Math.round((total / respondedReviews.length) * 10) / 10;
  }

  /**
   * 建立時間軸
   */
  private buildTimeline(data: any): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // 1. 官方頻道訊息（LINE）
    for (const msg of data.officialMessages) {
      if (msg.direction === 'inbound') {  // 只取員工發的訊息
        events.push({
          date: msg.message_time,
          type: 'line_message',
          category: 'LINE 訊息',
          content: msg.message_text || '（無文字）',
          sentiment: this.detectSentiment(msg.message_text || ''),
          metadata: {
            direction: msg.direction,
            ticket_no: msg.ticket_no,
          },
        });
      }
    }

    // 2. 工單建立事件
    for (const ticket of data.recentTickets) {
      events.push({
        date: ticket.ticket_created_at,
        type: 'ticket_created',
        category: `工單 [${ticket.parent_category || '未分類'}]`,
        content: `${ticket.issue_title}${ticket.issue_desc ? `：${ticket.issue_desc.substring(0, 80)}` : ''}`,
        sentiment: ticket.priority === 'high' ? 'negative' : 'neutral',
        metadata: {
          ticket_no: ticket.ticket_no,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          assigned_engineer: ticket.assigned_engineer,
        },
      });
    }

    // 3. 工單對話事件（員工留言）
    for (const { ticket, events: convEvents } of data.ticketConversations) {
      for (const event of convEvents) {
        // 只取員工（store role）的留言和建立事件，排除工程師/審核者
        if (event.actor_role === 'store' && event.event_type !== 'ticket_created') {
          events.push({
            date: event.event_created_at,
            type: 'ticket_event',
            category: `工單回覆 [${ticket.ticket_no}]`,
            content: event.content || `${event.event_type}`,
            sentiment: this.detectSentiment(event.content || ''),
            metadata: {
              ticket_no: ticket.ticket_no,
              event_type: event.event_type,
              actor_name: event.actor_name,
            },
          });
        }
      }
    }

    // 4. 主管面談對話記錄
    for (const conv of data.conversations) {
      events.push({
        date: conv.conversation_date,
        type: 'conversation',
        category: conv.conversation_type || '主管面談',
        content: conv.raw_text?.substring(0, 200) || '（詳見對話內容）',
        metadata: {
          interviewer: conv.interviewer_name,
          priority: conv.priority,
        },
      });
    }

    // 5. 評價/客訴記錄（含回覆對話）
    const urgencyLabel: Record<string, string> = {
      urgent_plus: '【特急】',
      urgent: '【緊急】',
      normal: '',
    };
    const typeLabels: Record<string, string> = {
      positive: '正面評價',
      negative: '負面評價/客訴',
      other: '其他評價',
    };
    for (const review of data.reviews) {
      // 主評價事件
      const urgencyTag = urgencyLabel[review.urgency] || '';
      events.push({
        date: review.created_at,
        type: 'review',
        category: `${urgencyTag}${typeLabels[review.review_type] || '評價'}`,
        content: review.content?.substring(0, 200) || '（無內容）',
        sentiment: review.review_type === 'positive' ? 'positive' :
          review.review_type === 'negative' ? 'negative' : 'neutral',
        metadata: {
          source: review.source,
          status: review.status,
          is_proxy: review.is_proxy,
          urgency: review.urgency,
          response_speed_hours: review.response_speed_hours,
          requires_response: review.requires_response,
        },
      });

      // 找此評價的回覆對話
      const convEntry = data.reviewConversations?.find(
        (rc: any) => rc.review.id === review.id,
      );
      if (convEntry) {
        for (const resp of convEntry.responses) {
          events.push({
            date: resp.created_at,
            type: 'review',
            category: `評價回覆 [${resp.responder_type === 'employee' ? '員工' : '客戶'}]`,
            content: resp.content?.substring(0, 150) || '（無回覆內容）',
            sentiment: this.detectSentiment(resp.content || ''),
            metadata: {
              responder_type: resp.responder_type,
              responder_name: resp.responder_name,
              review_id: review.id,
            },
          });
        }
      }
    }

    // 按時間排序（新到舊）
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return events;
  }

  /**
   * 簡單情感偵測
   */
  private detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    if (!text) return 'neutral';
    const negativeKeywords = ['壓力', '累', '煩', '不想', '難', '問題', '錯', '抱怨', '生氣', '離職', '不開心', '崩潰', '痛苦', '無奈', '異常', '無法', '失敗', '卡住'];
    const positiveKeywords = ['感謝', '謝謝', '好', '棒', '開心', '順利', '成功', '感恩', '完成', '解決', '恢復'];

    const lowerText = text.toLowerCase();
    const negCount = negativeKeywords.filter(k => lowerText.includes(k)).length;
    const posCount = positiveKeywords.filter(k => lowerText.includes(k)).length;

    if (negCount > posCount) return 'negative';
    if (posCount > negCount) return 'positive';
    return 'neutral';
  }

  /**
   * 計算資料完整度
   */
  private calculateDataCompleteness(data: any): number {
    let score = 0;
    const total = 6;

    if (data.officialMessages.length > 0) score++;
    if (data.conversations.length > 0) score++;
    if (data.attendance.length > 0) score++;
    if (data.scores.length > 0) score++;
    if (data.reviews.length > 0) score++;
    if (data.tickets.length > 0) score++;

    return Math.round((score / total) * 100) / 100;
  }

  /**
   * 取得日期範圍
   */
  private getDateRange(timeline: TimelineEvent[]): { from: string; to: string } {
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

  /**
   * 呼叫 AI 進行綜合分析
   */
  private async callAIAnalysis(employee: any, data: any, timeline: TimelineEvent[]): Promise<any> {
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
    "overall_assessment": "整體評估描述（2-3句話，需整合工單、LINE、面談等多方資料）",
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
      {"if": "如果員工提到工單問題一直沒解決...", "then": "建議回應..."},
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
    "recurring_issues": ["重複出現的問題1（可包含重複工單類別）"],
    "improvement_history": ["改善紀錄1"],
    "key_turning_points": [
      {"date": "日期", "event": "事件（可包含重要工單或面談）", "impact": "影響"}
    ]
  },
  "recommended_actions": {
    "immediate": ["立即行動1", "立即行動2"],
    "short_term": ["短期行動1（可包含協助解決未結案工單）"],
    "long_term": ["長期行動1"]
  },
  "confidence_score": 0.0-1.0
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: INSIGHT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type');

      let jsonText = content.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.error('AI analysis failed:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * 準備分析輸入素材
   */
  private prepareAnalysisInput(employee: any, data: any, timeline: TimelineEvent[]): string {
    let input = `【員工基本資料】
姓名：${employee.name}
部門：${employee.department || '未知'}
門市：${employee.store_name || '未知'}
職稱：${employee.title || '未知'}
狀態：${employee.is_active ? '在職' : '離職'}

`;

    // ── 工單統計 ──
    const ts = data.ticketStats;
    if (data.tickets.length > 0) {
      input += `【工單回報統計（全部歷史）】
工單總數：${ts.total} 筆（近期 ${ts.recent_count} 筆）
未結案：${ts.open_count} 筆${ts.open_count > 0 ? ' ⚠️' : ''}
高優先：${ts.high_priority_count} 筆${ts.high_priority_count > 2 ? ' ⚠️' : ''}
平均結案天數：${ts.avg_close_days > 0 ? ts.avg_close_days + ' 天' : '無資料'}

各狀態：${Object.entries(ts.by_status).map(([k, v]) => `${k}:${v}`).join('、')}
各優先級：${Object.entries(ts.by_priority).map(([k, v]) => `${k}:${v}`).join('、')}
常見類別：${ts.by_category.slice(0, 5).map((c: any) => `${c.category}(${c.count})`).join('、') || '無'}

`;

      // 未結案工單列表
      if (ts.open_tickets.length > 0) {
        input += `【未結案工單】\n`;
        for (const t of ts.open_tickets) {
          const days = t.ticket_created_at
            ? Math.floor((Date.now() - new Date(t.ticket_created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          input += `- [${t.priority}] ${t.ticket_no} ${t.issue_title}（已 ${days} 天，狀態：${t.status}）\n`;
        }
        input += '\n';
      }

      // 近期工單詳情（含對話）
      if (data.ticketConversations.length > 0) {
        input += `【近期工單對話內容】\n`;
        for (const { ticket, events } of data.ticketConversations.slice(0, 5)) {
          input += `\n▶ ${ticket.ticket_no} [${ticket.priority}] ${ticket.issue_title}\n`;
          input += `  類別：${ticket.category || '未分類'} | 狀態：${ticket.status}\n`;
          for (const ev of events) {
            const date = new Date(ev.event_created_at).toLocaleDateString('zh-TW');
            const roleLabel = ev.actor_role === 'store' ? '員工' : ev.actor_role === 'engineer' ? '工程師' : '審核';
            if (ev.content) {
              input += `  ${date} [${roleLabel}] ${ev.content.substring(0, 80)}\n`;
            }
          }
        }
        input += '\n';
      }
    } else {
      input += `【工單回報統計】\n無工單資料\n\n`;
    }

    // ── 時間軸 ──
    if (timeline.length > 0) {
      input += `【時間軸（近 30 天，共 ${timeline.length} 筆）】\n`;
      const recentEvents = timeline.slice(0, 60);
      for (const event of recentEvents) {
        const date = new Date(event.date).toLocaleDateString('zh-TW');
        const sentiment = event.sentiment === 'negative' ? ' ⚠️' : event.sentiment === 'positive' ? ' ✓' : '';
        input += `${date} [${event.category}]${sentiment} ${event.content.substring(0, 100)}\n`;
      }
      input += '\n';
    } else {
      input += `【時間軸】\n無近期資料\n\n`;
    }

    // ── 最近 AI 分析 ──
    if (data.analyses && data.analyses.length > 0) {
      const latest = data.analyses[0];
      input += `【最近面談分析結果】
分析日期：${new Date(latest.created_at).toLocaleDateString('zh-TW')}
風險等級：${latest.risk_level || '未知'}
壓力等級：${latest.stress_level || '未知'}
摘要：${latest.summary || '無'}

`;
    }

    // ── 評價統計（詳細版） ──
    if (data.allReviews.length > 0 || data.reviews.length > 0) {
      const rs = data.reviewStats;
      const sourceMap: Record<string, string> = {
        google_map: 'Google MAP',
        facebook: 'Facebook',
        phone: '電話客服',
        app: 'APP 客服',
        other: '其他',
      };

      input += `【評價/客訴統計（近${Math.round((Date.now() - new Date(data.reviews[0]?.created_at || Date.now()).getTime()) / 86400000) || 30}天）】
總計：${rs.total} 筆（歷史累計：${rs.all_time_total} 筆）
類型分布：正面 ${rs.positive} ｜ 負面 ${rs.negative}${rs.negative > 0 && rs.negative / rs.total > 0.5 ? ' ⚠️高負評比例' : ''} ｜ 其他 ${rs.other}
緊急程度：特急 ${rs.urgent_plus}${rs.urgent_plus > 0 ? ' 🔴' : ''} ｜ 緊急 ${rs.urgent}${rs.urgent > 0 ? ' 🟡' : ''} ｜ 一般 ${rs.total - rs.urgent_plus - rs.urgent}
處理狀態：待處理 ${rs.pending}${rs.pending > 0 ? ' ⚠️' : ''} ｜ 已回覆 ${rs.responded} ｜ 已結案 ${rs.closed}
代理處理：${rs.proxy_count} 筆
平均回覆速度：${rs.avg_response_hours > 0 ? rs.avg_response_hours + ' 小時' : '無資料'}${rs.slow_responses > 0 ? `（含 ${rs.slow_responses} 筆超過 24 小時未回）` : ''}${rs.fast_responses > 0 ? `（${rs.fast_responses} 筆在 2 小時內回覆）` : ''}

`;

      // 最近幾筆重要評價內容
      const importantReviews = data.reviews
        .filter((r: any) => r.review_type === 'negative' || r.urgency !== 'normal')
        .slice(0, 5);

      if (importantReviews.length > 0) {
        input += `【近期重要評價內容（負評/緊急）】\n`;
        for (const r of importantReviews) {
          const urgTag = r.urgency === 'urgent_plus' ? '[特急]' : r.urgency === 'urgent' ? '[緊急]' : '';
          const srcTag = sourceMap[r.source] || r.source;
          const spdTag = r.response_speed_hours != null
            ? `回覆速度：${r.response_speed_hours}小時`
            : r.status === 'pending' ? '⚠️ 尚未回覆'
            : '';
          input += `・${urgTag}[${srcTag}] ${new Date(r.created_at).toLocaleDateString('zh-TW')} ${r.content?.substring(0, 100) || '（無內容）'} ${spdTag}\n`;

          // 加入此評價的回覆對話
          const convEntry = data.reviewConversations?.find((rc: any) => rc.review.id === r.id);
          if (convEntry && convEntry.responses.length > 0) {
            for (const resp of convEntry.responses.slice(0, 3)) {
              const who = resp.responder_type === 'employee' ? '員工回覆' : '客戶';
              input += `  └ [${who}] ${resp.content?.substring(0, 80) || '（無內容）'}\n`;
            }
          }
        }
        input += `\n`;
      }
    }

    // ── 資料摘要 ──
    input += `【資料摘要】
LINE 訊息：${data.officialMessages.length} 筆 | 面談：${data.conversations.length} 筆 | 工單：${data.tickets.length} 筆 | 評價：${data.reviews.length} 筆（含 ${data.reviewConversations?.length || 0} 筆對話紀錄）
`;

    return input;
  }

  /**
   * 預設分析結果（AI 不可用時）
   */
  private getDefaultAnalysis(): any {
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
}
