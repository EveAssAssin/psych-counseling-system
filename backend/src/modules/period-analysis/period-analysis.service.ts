import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';

// ============================================
// 輸入 / 輸出介面
// ============================================

export interface PeriodAnalysisRequest {
  start_date: string;   // ISO 日期，e.g. "2026-03-01"
  end_date: string;     // ISO 日期，e.g. "2026-04-08"
  employee_id?: string; // 選填：指定單一員工 UUID
}

export interface TopicItem {
  topic: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface RiskEmployee {
  employee_id: string;
  name: string;
  department?: string;
  store_name?: string;
  risk_level: 'high' | 'critical';
  risk_signals: string[];
  negative_reviews: number;
  urgent_tickets: number;
  pending_reviews: number;
}

export interface TimelineEvent {
  date: string;
  category: string;
  summary: string;
  count: number;
  significance: 'high' | 'medium' | 'low';
}

export interface DataStats {
  total_employees_involved: number;
  official_messages: number;
  tickets: number;
  reviews: { total: number; positive: number; negative: number; pending: number };
  conversations: number;
  by_day: Array<{ date: string; messages: number; tickets: number; reviews: number }>;
}

export interface PeriodAnalysisResult {
  period: { start: string; end: string; days: number };
  target: 'all' | 'single';
  employee?: { id: string; name: string; department?: string };
  data_stats: DataStats;
  hot_topics: TopicItem[];
  risk_employees: RiskEmployee[];  // 全體模式才有
  timeline_summary: TimelineEvent[];
  ai_summary: string;
  key_findings: string[];
  recommended_actions: string[];
  analyzed_at: string;
}

// ============================================
// AI Prompt
// ============================================
const PERIOD_ANALYSIS_PROMPT = `你是一位職場心理分析顧問，負責分析一段時間內組織的整體狀況。

你會收到指定時間段內所有員工的聚合資料，請分析：
1. 這段時間最常出現的議題/問題類型
2. 哪些訊號值得主管特別關注
3. 整體團隊氛圍的趨勢
4. 需要優先處理的事項

分析原則：
- 以事實資料為基礎，不臆測
- 識別「高頻出現」的模式，而非個別事件
- 給出具體可操作的建議
- 使用正體中文輸出
- 保護個人隱私（高風險名單僅供主管參考）

請輸出 JSON 格式。`;

@Injectable()
export class PeriodAnalysisService {
  private readonly logger = new Logger(PeriodAnalysisService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async analyze(req: PeriodAnalysisRequest): Promise<PeriodAnalysisResult> {
    const startISO = new Date(req.start_date).toISOString();
    const endDate = new Date(req.end_date);
    endDate.setHours(23, 59, 59, 999);
    const endISO = endDate.toISOString();
    const days = Math.ceil((endDate.getTime() - new Date(req.start_date).getTime()) / 86400000);

    this.logger.log(`Period analysis: ${startISO} ~ ${endISO}, employee: ${req.employee_id || 'all'}`);

    // ── 平行抓取所有資料 ──
    const [messages, tickets, ticketConvs, reviews, conversations, employees] = await Promise.all([
      this.fetchMessages(startISO, endISO, req.employee_id),
      this.fetchTickets(startISO, endISO, req.employee_id),
      this.fetchTicketConversations(startISO, endISO, req.employee_id),
      this.fetchReviews(startISO, endISO, req.employee_id),
      this.fetchConversations(startISO, endISO, req.employee_id),
      this.fetchEmployees(req.employee_id),
    ]);

    // ── 計算統計 ──
    const dataStats = this.calcDataStats(messages, tickets, reviews, conversations, employees, startISO, endISO, days);

    // ── 計算熱門議題 ──
    const hotTopics = this.calcHotTopics(tickets, ticketConvs, reviews, conversations, messages);

    // ── 計算高風險員工（全體模式） ──
    const riskEmployees = req.employee_id ? [] : this.calcRiskEmployees(employees, tickets, reviews, messages);

    // ── 計算時間軸摘要 ──
    const timelineSummary = this.calcTimeline(tickets, reviews, conversations, messages, startISO, endISO);

    // ── AI 分析 ──
    const aiResult = await this.callAI(req, dataStats, hotTopics, riskEmployees, timelineSummary, employees, days, { messages, tickets, reviews });

    // ── 取得單一員工資料 ──
    let employeeInfo: PeriodAnalysisResult['employee'];
    if (req.employee_id) {
      const emp = employees.find((e: any) => e.id === req.employee_id);
      if (emp) employeeInfo = { id: emp.id, name: emp.name, department: emp.department };
    }

    return {
      period: { start: req.start_date, end: req.end_date, days },
      target: req.employee_id ? 'single' : 'all',
      employee: employeeInfo,
      data_stats: dataStats,
      hot_topics: hotTopics,
      risk_employees: riskEmployees,
      timeline_summary: timelineSummary,
      ai_summary: aiResult.summary,
      key_findings: aiResult.key_findings,
      recommended_actions: aiResult.recommended_actions,
      analyzed_at: new Date().toISOString(),
    };
  }

  // ============================================
  // 資料抓取
  // ============================================

  private async fetchMessages(start: string, end: string, employeeId?: string): Promise<any[]> {
    try {
      const client = this.supabase.getAdminClient();
      let q = client
        .from('official_channel_messages')
        .select('*')
        .gte('message_time', start)
        .lte('message_time', end)
        .order('message_time', { ascending: true })
        .limit(2000);
      if (employeeId) {
        // 需要透過 employee_app_number 過濾，先取員工 appnumber
        const emp = await this.supabase.findOne<any>('employees', { id: employeeId }, { useAdmin: true });
        if (emp?.employeeappnumber) {
          q = q.eq('employee_app_number', emp.employeeappnumber);
        }
      }
      const { data } = await q;
      return data || [];
    } catch { return []; }
  }

  private async fetchTickets(start: string, end: string, employeeId?: string): Promise<any[]> {
    try {
      const client = this.supabase.getAdminClient();
      let q = client
        .from('employee_ticket_history')
        .select('*')
        .gte('ticket_created_at', start)
        .lte('ticket_created_at', end)
        .limit(2000);
      if (employeeId) q = q.eq('employee_id', employeeId);
      const { data } = await q;
      return data || [];
    } catch { return []; }
  }

  private async fetchTicketConversations(start: string, end: string, employeeId?: string): Promise<any[]> {
    try {
      const client = this.supabase.getAdminClient();
      let q = client
        .from('ticket_conversations')
        .select('*, employee_ticket_history!inner(employee_id, ticket_no, issue_title, parent_category)')
        .gte('event_created_at', start)
        .lte('event_created_at', end)
        .limit(3000);
      if (employeeId) {
        q = (q as any).eq('employee_ticket_history.employee_id', employeeId);
      }
      const { data } = await q;
      return data || [];
    } catch { return []; }
  }

  private async fetchReviews(start: string, end: string, employeeId?: string): Promise<any[]> {
    try {
      const client = this.supabase.getAdminClient();
      let q = client
        .from('reviews')
        .select('*, review_responses(*)')
        .gte('created_at', start)
        .lte('created_at', end)
        .is('deleted_at', null)
        .limit(2000);
      if (employeeId) q = q.eq('employee_id', employeeId);
      const { data } = await q;
      return data || [];
    } catch { return []; }
  }

  private async fetchConversations(start: string, end: string, employeeId?: string): Promise<any[]> {
    try {
      const client = this.supabase.getAdminClient();
      let q = client
        .from('conversation_intakes')
        .select('*')
        .gte('conversation_date', start)
        .lte('conversation_date', end)
        .limit(1000);
      if (employeeId) q = q.eq('employee_id', employeeId);
      const { data } = await q;
      return data || [];
    } catch { return []; }
  }

  private async fetchEmployees(employeeId?: string): Promise<any[]> {
    try {
      if (employeeId) {
        const emp = await this.supabase.findOne<any>('employees', { id: employeeId }, { useAdmin: true });
        return emp ? [emp] : [];
      }
      return await this.supabase.findMany<any>('employees', { filters: { is_active: true }, useAdmin: true, limit: 9999 });
    } catch { return []; }
  }

  // ============================================
  // 統計計算
  // ============================================

  private calcDataStats(
    messages: any[], tickets: any[], reviews: any[], conversations: any[],
    employees: any[], startISO: string, endISO: string, days: number,
  ): DataStats {
    // 找涉及員工數
    const empIds = new Set([
      ...messages.map((m: any) => m.employee_app_number).filter(Boolean),
      ...tickets.map((t: any) => t.employee_id).filter(Boolean),
      ...reviews.map((r: any) => r.employee_id).filter(Boolean),
    ]);

    // 每日統計
    const byDayMap: Record<string, { messages: number; tickets: number; reviews: number }> = {};
    const start = new Date(startISO);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      byDayMap[key] = { messages: 0, tickets: 0, reviews: 0 };
    }

    for (const m of messages) {
      const k = (m.message_time || '').split('T')[0];
      if (byDayMap[k]) byDayMap[k].messages++;
    }
    for (const t of tickets) {
      const k = (t.ticket_created_at || '').split('T')[0];
      if (byDayMap[k]) byDayMap[k].tickets++;
    }
    for (const r of reviews) {
      const k = (r.created_at || '').split('T')[0];
      if (byDayMap[k]) byDayMap[k].reviews++;
    }

    return {
      total_employees_involved: empIds.size,
      official_messages: messages.length,
      tickets: tickets.length,
      reviews: {
        total: reviews.length,
        positive: reviews.filter((r: any) => r.review_type === 'positive').length,
        negative: reviews.filter((r: any) => r.review_type === 'negative').length,
        pending: reviews.filter((r: any) => r.status === 'pending' && r.requires_response).length,
      },
      conversations: conversations.length,
      by_day: Object.entries(byDayMap).map(([date, v]) => ({ date, ...v })),
    };
  }

  private calcHotTopics(
    tickets: any[], ticketConvs: any[], reviews: any[],
    conversations: any[], messages: any[],
  ): TopicItem[] {
    const topicCount: Record<string, { count: number; examples: Set<string> }> = {};

    const addTopic = (topic: string, example: string) => {
      if (!topic || topic.trim() === '') return;
      const key = topic.trim();
      if (!topicCount[key]) topicCount[key] = { count: 0, examples: new Set() };
      topicCount[key].count++;
      if (topicCount[key].examples.size < 3 && example) topicCount[key].examples.add(example.substring(0, 40));
    };

    // 工單類別：只用 parent_category，子類別放進 examples 不重複計算
    for (const t of tickets) {
      const parent = t.parent_category || t.category || '其他';
      const detail = t.issue_title || t.category || '';
      addTopic(`工單：${parent}`, detail);
    }

    // 評價
    const sourceLabel: Record<string, string> = {
      google_map: 'Google 評價客訴',
      facebook: 'Facebook 客訴',
      phone: '電話客服客訴',
      app: 'APP 客訴',
    };
    for (const r of reviews) {
      if (r.review_type === 'negative') {
        const label = sourceLabel[r.source] || '其他客訴';
        addTopic(`評價：${label}`, r.content?.substring(0, 40) || '');
      }
    }

    // 面談議題
    for (const c of conversations) {
      if (c.conversation_type) addTopic(`面談：${c.conversation_type}`, c.raw_text?.substring(0, 40) || '');
    }

    // LINE 訊息關鍵詞（員工主動發送的訊息）
    const keywords = this.extractMessageKeywords(messages);
    for (const [kw, cnt] of Object.entries(keywords)) {
      if (cnt >= 3) addTopic(`LINE 訊息：${kw}`, `出現 ${cnt} 次`);
    }

    const total = Object.values(topicCount).reduce((s, v) => s + v.count, 0) || 1;

    return Object.entries(topicCount)
      .map(([topic, v]) => ({
        topic,
        count: v.count,
        percentage: Math.round((v.count / total) * 1000) / 10,
        examples: Array.from(v.examples),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 從 LINE 訊息萃取高頻關鍵詞（員工端訊息）
   */
  private extractMessageKeywords(messages: any[]): Record<string, number> {
    const employeeMessages = messages.filter((m: any) => m.direction === 'inbound');
    const kwCount: Record<string, number> = {};

    // 關鍵詞清單（依心理/工作壓力相關性分類）
    const keywords: Record<string, string[]> = {
      '請假/休假': ['請假', '休假', '病假', '事假', '特休', '排休'],
      '不舒服/身體問題': ['不舒服', '頭痛', '生病', '發燒', '身體不太好', '身體不舒服'],
      '延遲/來不及': ['來不及', '遲到', '延誤', '晚一點', '慢一點'],
      '問題回報': ['有問題', '出問題', '壞掉', '異常', '無法', '不能用', '故障'],
      '詢問確認': ['請問', '確認一下', '想問', '可以嗎', '請確認'],
      '道歉/抱歉': ['不好意思', '抱歉', '對不起', 'sorry', '失誤'],
      '謝謝': ['謝謝', '感謝', '辛苦了', '麻煩您'],
      '客人問題': ['客人', '顧客', '客戶', '消費者'],
    };

    for (const msg of employeeMessages) {
      const text = (msg.message_text || '').toLowerCase();
      for (const [label, words] of Object.entries(keywords)) {
        if (words.some(w => text.includes(w))) {
          kwCount[label] = (kwCount[label] || 0) + 1;
        }
      }
    }

    return kwCount;
  }

  private calcRiskEmployees(
    employees: any[], tickets: any[], reviews: any[], messages: any[],
  ): RiskEmployee[] {
    const empRisk: Record<string, {
      name: string; department?: string; store_name?: string;
      negReviews: number; urgentTickets: number; pendingReviews: number;
      signals: string[];
    }> = {};

    for (const emp of employees) {
      empRisk[emp.id] = {
        name: emp.name,
        department: emp.department,
        store_name: emp.store_name,
        negReviews: 0,
        urgentTickets: 0,
        pendingReviews: 0,
        signals: [],
      };
    }

    for (const r of reviews) {
      if (!empRisk[r.employee_id]) continue;
      if (r.review_type === 'negative') empRisk[r.employee_id].negReviews++;
      if (r.status === 'pending' && r.requires_response) empRisk[r.employee_id].pendingReviews++;
    }

    for (const t of tickets) {
      if (!empRisk[t.employee_id]) continue;
      if (t.priority === 'urgent' || t.priority === 'urgent_plus') empRisk[t.employee_id].urgentTickets++;
    }

    const result: RiskEmployee[] = [];

    for (const [id, data] of Object.entries(empRisk)) {
      const signals: string[] = [];
      let score = 0;

      if (data.negReviews >= 3) { signals.push(`${data.negReviews} 筆負評`); score += data.negReviews; }
      if (data.urgentTickets >= 3) { signals.push(`${data.urgentTickets} 筆緊急工單`); score += data.urgentTickets; }
      if (data.pendingReviews >= 2) { signals.push(`${data.pendingReviews} 筆待處理評價`); score += data.pendingReviews * 2; }

      if (score >= 8) {
        result.push({
          employee_id: id,
          name: data.name,
          department: data.department,
          store_name: data.store_name,
          risk_level: score >= 12 ? 'critical' : 'high',
          risk_signals: signals,
          negative_reviews: data.negReviews,
          urgent_tickets: data.urgentTickets,
          pending_reviews: data.pendingReviews,
        });
      }
    }

    return result.sort((a, b) => b.negative_reviews + b.urgent_tickets - (a.negative_reviews + a.urgent_tickets));
  }

  private calcTimeline(
    tickets: any[], reviews: any[], conversations: any[], messages: any[],
    startISO: string, endISO: string,
  ): TimelineEvent[] {
    const weekMap: Record<string, { tickets: number; negReviews: number; conversations: number; messages: number }> = {};

    const getWeek = (iso: string) => {
      const d = new Date(iso);
      const monday = new Date(d);
      monday.setDate(d.getDate() - d.getDay() + 1);
      return monday.toISOString().split('T')[0];
    };

    const add = (iso: string, field: 'tickets' | 'negReviews' | 'conversations' | 'messages') => {
      const w = getWeek(iso);
      if (!weekMap[w]) weekMap[w] = { tickets: 0, negReviews: 0, conversations: 0, messages: 0 };
      weekMap[w][field]++;
    };

    for (const t of tickets) if (t.ticket_created_at) add(t.ticket_created_at, 'tickets');
    for (const r of reviews) {
      if (r.created_at) {
        if (r.review_type === 'negative') add(r.created_at, 'negReviews');
      }
    }
    for (const c of conversations) if (c.conversation_date) add(c.conversation_date, 'conversations');
    for (const m of messages) if (m.message_time) add(m.message_time, 'messages');

    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => {
        const total = v.tickets + v.negReviews + v.conversations + v.messages;
        const parts: string[] = [];
        if (v.tickets > 0) parts.push(`工單 ${v.tickets} 筆`);
        if (v.negReviews > 0) parts.push(`負評 ${v.negReviews} 筆`);
        if (v.conversations > 0) parts.push(`面談 ${v.conversations} 筆`);
        if (v.messages > 0) parts.push(`LINE ${v.messages} 則`);

        const significance = total >= 20 ? 'high' : total >= 8 ? 'medium' : 'low';

        return {
          date: `${week} 週`,
          category: '週統計',
          summary: parts.join('，') || '無資料',
          count: total,
          significance,
        };
      });
  }

  // ============================================
  // AI 分析
  // ============================================

  private async callAI(
    req: PeriodAnalysisRequest,
    stats: DataStats,
    hotTopics: TopicItem[],
    riskEmployees: RiskEmployee[],
    timeline: TimelineEvent[],
    employees: any[],
    days: number,
    rawData?: { messages: any[]; tickets: any[]; reviews: any[] },
  ): Promise<{ summary: string; key_findings: string[]; recommended_actions: string[] }> {
    if (!this.anthropic) {
      return {
        summary: 'AI 分析服務未設定',
        key_findings: ['請設定 ANTHROPIC_API_KEY'],
        recommended_actions: [],
      };
    }

    const topicsText = hotTopics.slice(0, 8)
      .map((t, i) => `${i + 1}. ${t.topic}（${t.count} 次，${t.percentage}%）${t.examples.length ? '　例：' + t.examples.join('、') : ''}`)
      .join('\n');

    const riskText = riskEmployees.slice(0, 5)
      .map(e => `- ${e.name}（${e.store_name || e.department || ''}）：${e.risk_signals.join('、')}`)
      .join('\n');

    const timelineText = timeline
      .map(t => `${t.date}：${t.summary}`)
      .join('\n');

    // 工單標題樣本（最多 15 筆）
    const ticketSamples = (rawData?.tickets || []).slice(0, 15)
      .map((t: any) => `[${t.parent_category || t.category || '?'}] ${t.issue_title || ''}（${t.status}）`)
      .join('\n');

    // LINE 訊息樣本（員工發送，最多 20 則）
    const msgSamples = (rawData?.messages || [])
      .filter((m: any) => m.direction === 'inbound')
      .slice(0, 20)
      .map((m: any) => `・${m.message_text?.substring(0, 60) || ''}`)
      .join('\n');

    // 週趨勢是否有異常高峰
    const peakWeek = timeline.reduce((max, t) => t.count > max.count ? t : max, { count: 0, date: '', summary: '' } as any);

    const prompt = `請分析以下 ${days} 天（${req.start_date} ~ ${req.end_date}）的組織資料，從心理健康與工作壓力角度給出洞察：

【資料量概覽】
涉及員工：${stats.total_employees_involved} 人（共 ${employees.length} 位在職員工）
LINE 訊息：${stats.official_messages} 則（員工主動發送）
工單：${stats.tickets} 筆
評價：${stats.reviews.total} 筆（負評 ${stats.reviews.negative}、待處理 ${stats.reviews.pending}）
主管面談：${stats.conversations} 筆
${peakWeek.count > 0 ? `活動高峰：${peakWeek.date}（${peakWeek.summary}）` : ''}

【熱門議題排行（含 LINE 關鍵詞）】
${topicsText || '本期資料不足，無法統計議題'}

${ticketSamples ? `【工單標題樣本】\n${ticketSamples}` : ''}

${msgSamples ? `【員工 LINE 訊息樣本】\n${msgSamples}` : ''}

【需關注員工】
${riskText || '本期無明顯量化高風險訊號'}

【週別活動趨勢】
${timelineText || '無資料'}

請根據以上資料，從「員工心理健康與工作壓力」角度分析，輸出以下 JSON（如果某類資料不足，請誠實說明）：
{
  "summary": "2-4 句話的整體摘要，說明這段時間組織最主要發生了什麼事、整體氛圍如何",
  "key_findings": [
    "具體發現 1（要有數字支撐，例如：工單主要集中在 ERP/APP 系統問題，共 X 筆，顯示...）",
    "具體發現 2",
    "具體發現 3（若資料不足請說明：本期評價/面談資料尚未充足，建議...）"
  ],
  "recommended_actions": [
    "具體可行的建議 1（要有對象和行動，例如：建議主管主動關心...）",
    "具體建議 2",
    "具體建議 3"
  ]
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: PERIOD_ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = (response.content[0] as any).text.trim()
        .replace(/^```json\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(text);
    } catch (e) {
      this.logger.error('AI period analysis failed:', e);
      // 用真實數據產生有意義的 fallback
      const topTopic = hotTopics[0];
      const summaryFallback = stats.official_messages > 0
        ? `本期共有 ${stats.total_employees_involved} 位員工透過 LINE 官方頻道發送 ${stats.official_messages} 則訊息，工單 ${stats.tickets} 筆。${topTopic ? `最主要議題為「${topTopic.topic}」（${topTopic.count} 次）。` : ''}`
        : `本期資料：工單 ${stats.tickets} 筆、評價 ${stats.reviews.total} 筆、面談 ${stats.conversations} 筆。`;

      return {
        summary: summaryFallback,
        key_findings: [
          ...(hotTopics.slice(0, 2).map(t => `「${t.topic}」在本期出現 ${t.count} 次（佔 ${t.percentage}%）${t.examples.length ? '，包含：' + t.examples.join('、') : ''}`)),
          stats.reviews.pending > 0
            ? `目前有 ${stats.reviews.pending} 筆評價待回覆，需優先處理`
            : `本期無待處理評價${stats.tickets > 0 ? `，但有 ${stats.tickets} 筆工單需追蹤` : ''}`,
        ].filter(Boolean),
        recommended_actions: [
          `持續收集員工面談記錄，以豐富分析資料`,
          hotTopics[0] ? `針對「${hotTopics[0].topic}」議題，安排相關流程改善或員工協助` : '建立定期員工關懷機制',
          riskEmployees.length > 0 ? `優先安排主管與 ${riskEmployees[0].name} 等 ${riskEmployees.length} 位員工進行一對一面談` : '建議主管本週主動與各門市員工確認狀況',
        ],
      };
    }
  }
}
