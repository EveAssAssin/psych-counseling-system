import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 教育訓練學習進度服務
 * 代理呼叫 LMS（lohas-lms-backend）的對外 API，依 app_number 取得該員工
 * 目前的學習層級（current_tier）與進度。LMS 金鑰只留在後端，不外露給前端。
 *
 * 環境變數：
 *   LMS_API_BASE_URL  LMS 後端 base url（預設正式站）
 *   LMS_API_KEY       LMS learning-progress 端點的 x-api-key
 */
@Injectable()
export class LearningProgressService {
  private readonly logger = new Logger(LearningProgressService.name);

  private readonly lmsBaseUrl =
    process.env.LMS_API_BASE_URL ?? 'https://lohas-lms-backend.onrender.com';
  private readonly lmsApiKey = process.env.LMS_API_KEY ?? '';

  async getByAppNumber(appNumber: string) {
    if (!appNumber) {
      return { available: false, reason: 'no_app_number' };
    }
    if (!this.lmsApiKey) {
      this.logger.warn('LMS_API_KEY 未設定，略過學習進度查詢');
      return { available: false, reason: 'not_configured' };
    }

    try {
      const res = await axios.get(`${this.lmsBaseUrl}/external/learning-progress`, {
        params: { app_number: appNumber },
        headers: { 'x-api-key': this.lmsApiKey },
        timeout: 10000,
      });
      return { available: true, ...res.data };
    } catch (err: any) {
      const status = err?.response?.status;
      this.logger.error(
        `LMS 學習進度查詢失敗 (app_number=${appNumber}, status=${status ?? 'n/a'}): ${err?.message}`,
      );
      return { available: false, reason: 'error' };
    }
  }
}
