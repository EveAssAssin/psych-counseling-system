import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 教育訓練學習進度服務
 * 代理呼叫 LMS（lohas-lms-backend）的對外 API。LMS 金鑰只留在後端。
 *
 * 環境變數：
 *   LMS_API_BASE_URL  LMS 後端 base url（預設正式站）
 *   LMS_API_KEY       LMS external 端點的 x-api-key
 *
 * 註：LMS 部署在 Render 免費方案，閒置會休眠，冷啟動可能需 30~60 秒，
 *     故逾時拉長並保留錯誤細節，方便前端/日誌判斷失敗原因。
 */
@Injectable()
export class LearningProgressService {
  private readonly logger = new Logger(LearningProgressService.name);

  private readonly lmsBaseUrl =
    process.env.LMS_API_BASE_URL ?? 'https://lohas-lms-backend.onrender.com';
  private readonly lmsApiKey = process.env.LMS_API_KEY ?? '';
  private readonly timeoutMs = Number(process.env.LMS_API_TIMEOUT_MS ?? '40000');

  private async call(path: string, params: Record<string, any>) {
    const url = `${this.lmsBaseUrl}${path}`;
    // 冷啟動保護：第一次失敗（逾時/5xx）再重試一次
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await axios.get(url, {
          params,
          headers: { 'x-api-key': this.lmsApiKey },
          timeout: this.timeoutMs,
          validateStatus: (s) => s >= 200 && s < 500, // 4xx 也拿回來看內容
        });
        if (res.status >= 400) {
          this.logger.warn(`LMS ${path} 回應 ${res.status}`);
          return { available: false, reason: 'error', status: res.status, detail: `HTTP ${res.status}` };
        }
        return { available: true, ...res.data };
      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.code === 'ECONNABORTED' ? 'timeout' : (err?.message || 'network');
        this.logger.error(`LMS ${path} 失敗 (attempt ${attempt}, status=${status ?? 'n/a'}): ${detail}`);
        if (attempt === 2) {
          return { available: false, reason: 'error', status: status ?? null, detail };
        }
      }
    }
    return { available: false, reason: 'error', detail: 'unknown' };
  }

  async getByAppNumber(appNumber: string) {
    if (!appNumber) return { available: false, reason: 'no_app_number' };
    if (!this.lmsApiKey) {
      this.logger.warn('LMS_API_KEY 未設定，略過學習進度查詢');
      return { available: false, reason: 'not_configured' };
    }
    return this.call('/external/learning-progress', { app_number: appNumber });
  }

  async getEmployeeTraining(erpid: string) {
    if (!erpid) return { available: false, reason: 'no_erpid' };
    if (!this.lmsApiKey) {
      this.logger.warn('LMS_API_KEY 未設定，略過教育訓練明細查詢');
      return { available: false, reason: 'not_configured' };
    }
    return this.call('/external/employee-training', { erpid });
  }
}
