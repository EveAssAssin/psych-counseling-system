import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * 草稿暫存：建案兩步式流程的中間態。
 *
 * 為什麼用 in-memory Map？
 *   - 草稿生命週期短（輔導員看完 AI 草稿就會調整、確認或丟棄）
 *   - 24h TTL 足夠覆蓋「中斷一陣子再回來確認」的情境
 *   - 不需要跨實例共享（單一 backend 部署）
 *   - 若日後上多實例可改成 Redis，介面不變
 */
export interface CaseDraftPayload {
  // 輸入表單原樣
  form: {
    employee_app_number: string;
    supervisor_id: string;
    state_tag_codes: string[];
    state_description?: string;
    goal: string;
    start_date: string;
    target_end_date: string;
    allowed_methods: string[];
  };

  // 查到的員工與輔導員資料（避免 confirm 再查）
  resolved: {
    employee_id: string;
    employee_name: string;
    supervisor_name: string;
  };

  // 建案當下的 insight 快照
  insight_snapshot: any;

  // AI 生成的整體計畫摘要
  ai_summary: string;

  // AI 生成的排程節點（已對齊到實際 workday 日期）
  draft_items: Array<{
    sequence: number;
    scheduled_date: string;
    method: string;
    objective: string;
    recommended_actions: Record<string, any>;
    estimated_minutes: number;
  }>;

  // AI meta：model, token usage 等
  ai_meta: Record<string, any>;

  created_at: number;
}

interface StoredDraft {
  payload: CaseDraftPayload;
  expires_at: number;
}

@Injectable()
export class CaseDraftStoreService {
  private readonly logger = new Logger(CaseDraftStoreService.name);
  private readonly store = new Map<string, StoredDraft>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000;
  private readonly PRUNE_INTERVAL_MS = 30 * 60 * 1000;

  constructor() {
    setInterval(() => this.prune(), this.PRUNE_INTERVAL_MS).unref();
  }

  put(payload: CaseDraftPayload): string {
    const token = randomUUID();
    this.store.set(token, {
      payload,
      expires_at: Date.now() + this.TTL_MS,
    });
    this.logger.log(`Draft stored: ${token.slice(0, 8)}… (total ${this.store.size})`);
    return token;
  }

  get(token: string): CaseDraftPayload | null {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expires_at) {
      this.store.delete(token);
      return null;
    }
    return entry.payload;
  }

  delete(token: string): boolean {
    return this.store.delete(token);
  }

  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.store) {
      if (now > v.expires_at) {
        this.store.delete(k);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.log(`Pruned ${removed} expired drafts (${this.store.size} remain)`);
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }
}
