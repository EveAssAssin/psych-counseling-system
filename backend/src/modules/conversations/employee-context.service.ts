import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversationsService } from './conversations.service';

/**
 * 共用的「員工對話記錄上下文組裝器」
 *
 * 用途：給系統內各 AI 服務（employee-insight / supervisor-ai / query / line-assistant 等）
 * 在組 prompt 時，把該員工的主管面談對話記錄與 AI 分析結果，
 * 統一格式化成一段 prompt 片段插入。
 *
 * 取資料策略：
 *   - 近 N 筆對話：完整 raw_text / extracted_text + 對應 analysis_result（用於心理狀態判讀）
 *   - 更早的 M 筆對話：只放 analysis_result 摘要（節省 token，保留趨勢資訊）
 *
 * 預設值針對「Sonnet 4 + 4096 max_tokens」場景設計，
 * 呼叫端可依不同 AI 服務（query 較短、insight 較長）覆寫。
 */
@Injectable()
export class EmployeeContextService {
  private readonly logger = new Logger(EmployeeContextService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * 組成對話記錄上下文字串
   * @param employeeId 員工 UUID（conversation_intakes.employee_id 對應的欄位）
   * @returns 已格式化的字串片段；若該員工沒有任何對話記錄，回傳空字串
   */
  async buildConversationContext(
    employeeId: string,
    options?: {
      /** 近 N 筆放完整對話 + analysis（預設 5） */
      recentFullCount?: number;
      /** 更早 M 筆只放 analysis 摘要（預設 5） */
      olderSummaryCount?: number;
      /** 是否包含 AI 分析結果（預設 true） */
      includeAnalysis?: boolean;
      /** 單筆對話原文最大字數（預設 1500，超過會被截斷） */
      maxRawTextLength?: number;
      /** 是否包含背景說明（預設 true） */
      includeBackgroundNote?: boolean;
    },
  ): Promise<string> {
    const recentFullCount = options?.recentFullCount ?? 5;
    const olderSummaryCount = options?.olderSummaryCount ?? 5;
    const includeAnalysis = options?.includeAnalysis ?? true;
    const maxRawTextLength = options?.maxRawTextLength ?? 1500;
    const includeBackgroundNote = options?.includeBackgroundNote ?? true;

    try {
      // 1. 取得該員工的所有對話（依時間倒序）
      const allConversations = await this.conversations.findByEmployee(employeeId);

      if (!allConversations || allConversations.length === 0) {
        return '';
      }

      // 2. 切分：近 N 筆 vs 更早 M 筆
      const recentConvs = allConversations.slice(0, recentFullCount);
      const olderConvs = allConversations.slice(
        recentFullCount,
        recentFullCount + olderSummaryCount,
      );

      // 3. 批次抓 analysis_results（一次查所有相關對話，節省查詢次數）
      const allIds = [...recentConvs, ...olderConvs].map((c: any) => c.id);
      const analysesByConvId = includeAnalysis
        ? await this.fetchAnalysesByConversationIds(allIds)
        : new Map<string, any>();

      // 4. 組裝字串
      const lines: string[] = [];

      // ── 近 N 筆完整 ──
      if (recentConvs.length > 0) {
        lines.push(
          `【主管面談記錄（近 ${recentConvs.length} 筆，含完整對話與 AI 心理分析）】`,
        );
        recentConvs.forEach((conv: any, idx: number) => {
          const date = conv.conversation_date
            ? new Date(conv.conversation_date).toLocaleDateString('zh-TW')
            : '日期不明';
          const type = conv.conversation_type || '一般面談';
          const interviewer = conv.interviewer_name || '未知';
          lines.push(
            `\n▶ 第 ${idx + 1} 筆 ｜ ${date} ｜ 類型：${type} ｜ 訪談者：${interviewer}`,
          );

          if (includeBackgroundNote && conv.background_note) {
            lines.push(`  背景：${conv.background_note}`);
          }

          // 對話原文
          const text = conv.extracted_text || conv.raw_text || '';
          if (text) {
            const truncated =
              text.length > maxRawTextLength
                ? `${text.substring(0, maxRawTextLength)}…（已截斷，原文共 ${text.length} 字）`
                : text;
            lines.push(`  對話內容：\n${this.indentLines(truncated, '    ')}`);
          } else {
            lines.push(`  對話內容：（未抽取或為空）`);
          }

          // AI 分析結果
          if (includeAnalysis) {
            const analysis = analysesByConvId.get(conv.id);
            if (analysis) {
              lines.push(this.formatAnalysisSection(analysis, '  '));
            } else {
              lines.push(`  AI 分析：尚未產生`);
            }
          }
        });
      }

      // ── 更早 M 筆摘要 ──
      if (olderConvs.length > 0) {
        lines.push(
          `\n【更早面談摘要（第 ${recentFullCount + 1} ~ ${recentFullCount + olderConvs.length} 筆）】`,
        );
        olderConvs.forEach((conv: any, idx: number) => {
          const date = conv.conversation_date
            ? new Date(conv.conversation_date).toLocaleDateString('zh-TW')
            : '日期不明';
          const interviewer = conv.interviewer_name || '未知';
          const analysis = includeAnalysis ? analysesByConvId.get(conv.id) : null;

          if (analysis) {
            const riskTag = this.riskTag(analysis.risk_level, analysis.stress_level);
            lines.push(
              `・[${recentFullCount + idx + 1}] ${date} ｜ ${interviewer} ${riskTag}` +
                ` ｜ ${analysis.summary || analysis.current_psychological_state || '（無摘要）'}`,
            );
          } else {
            // 無分析，只放對話前 100 字
            const text = conv.extracted_text || conv.raw_text || '';
            const preview = text.substring(0, 100);
            lines.push(
              `・[${recentFullCount + idx + 1}] ${date} ｜ ${interviewer} ｜ ${preview}${text.length > 100 ? '…' : ''}`,
            );
          }
        });
      }

      // ── 統計尾巴 ──
      const totalCount = allConversations.length;
      const shownCount = recentConvs.length + olderConvs.length;
      if (totalCount > shownCount) {
        lines.push(
          `\n（員工另有 ${totalCount - shownCount} 筆更早的面談記錄未列入本次上下文）`,
        );
      }

      return lines.join('\n');
    } catch (error) {
      this.logger.error(
        `Failed to build conversation context for employee ${employeeId}: ${error.message}`,
      );
      return '';
    }
  }

  /**
   * 批次取得對話對應的 AI 分析結果
   */
  private async fetchAnalysesByConversationIds(
    conversationIds: string[],
  ): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    if (conversationIds.length === 0) return map;

    try {
      const client = this.supabase.getAdminClient();
      const { data, error } = await client
        .from('analysis_results')
        .select('*')
        .in('conversation_intake_id', conversationIds)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.warn(`Failed to fetch analyses: ${error.message}`);
        return map;
      }

      // 每筆對話只取最新一次分析（依 created_at desc，後遇到的不覆蓋）
      for (const a of data || []) {
        if (!map.has(a.conversation_intake_id)) {
          map.set(a.conversation_intake_id, a);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch analyses: ${error.message}`);
    }
    return map;
  }

  /**
   * 格式化單筆 analysis_result 的段落
   */
  private formatAnalysisSection(analysis: any, indent: string): string {
    const lines: string[] = [`${indent}AI 心理分析：`];
    const riskTag = this.riskTag(analysis.risk_level, analysis.stress_level);
    lines.push(`${indent}  狀態：${analysis.current_psychological_state || '（未填）'} ${riskTag}`);
    if (analysis.summary) {
      lines.push(`${indent}  摘要：${analysis.summary}`);
    }
    if (Array.isArray(analysis.key_topics) && analysis.key_topics.length > 0) {
      lines.push(`${indent}  關鍵議題：${analysis.key_topics.join('、')}`);
    }
    if (Array.isArray(analysis.observations) && analysis.observations.length > 0) {
      lines.push(`${indent}  觀察：${analysis.observations.slice(0, 3).join('；')}`);
    }
    if (Array.isArray(analysis.suggested_actions) && analysis.suggested_actions.length > 0) {
      lines.push(`${indent}  建議行動：${analysis.suggested_actions.slice(0, 3).join('；')}`);
    }
    if (Array.isArray(analysis.taboo_topics) && analysis.taboo_topics.length > 0) {
      lines.push(`${indent}  避雷話題：${analysis.taboo_topics.join('、')}`);
    }
    if (analysis.next_talk_focus) {
      lines.push(`${indent}  下次重點：${analysis.next_talk_focus}`);
    }
    return lines.join('\n');
  }

  /**
   * 風險/壓力等級的視覺化標記
   */
  private riskTag(risk?: string, stress?: string): string {
    const tags: string[] = [];
    const riskMap: Record<string, string> = {
      critical: '🔴極高風險',
      high: '🟠高風險',
      moderate: '🟡中等風險',
      low: '🟢低風險',
    };
    const stressMap: Record<string, string> = {
      critical: '🔴極高壓力',
      high: '🟠高壓力',
      moderate: '🟡中等壓力',
      low: '🟢低壓力',
    };
    if (risk && riskMap[risk]) tags.push(riskMap[risk]);
    if (stress && stressMap[stress]) tags.push(stressMap[stress]);
    return tags.length > 0 ? `[${tags.join(' / ')}]` : '';
  }

  /**
   * 字串多行縮排
   */
  private indentLines(text: string, indent: string): string {
    return text
      .split('\n')
      .map((line) => indent + line)
      .join('\n');
  }
}
