import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncService } from '../sync/sync.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AnalysisService } from '../analysis/analysis.service';
import { EmployeeSyncService } from '../employee-sync/employee-sync.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private isEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly syncService: SyncService,
    private readonly conversationsService: ConversationsService,
    private readonly analysisService: AnalysisService,
    private readonly employeeSyncService: EmployeeSyncService,
  ) {
    this.isEnabled = this.configService.get<boolean>('scheduler.enabled') ?? true;
  }

  onModuleInit() {
    if (this.isEnabled) {
      this.logger.log('Scheduler is enabled');
    } else {
      this.logger.warn('Scheduler is disabled');
    }
  }

  /**
   * 每月 5 日 04:00 執行員工主檔同步
   */
  @Cron('0 4 5 * *')
  async monthlyEmployeeSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting monthly employee sync');

    try {
      const result = await this.syncService.syncEmployees();
      this.logger.log(`Monthly employee sync completed: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Monthly employee sync failed:', error);
    }
  }

  /**
   * 每日 05:00 執行員工資料同步（從左手系統 API）
   */
  @Cron('0 5 * * *')
  async dailyEmployeeSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily employee sync from Lefthand API');

    try {
      const result = await this.syncService.syncEmployees();
      this.logger.log(`Daily employee sync completed: ${result.total_created} created, ${result.total_updated} updated`);
    } catch (error) {
      this.logger.error('Daily employee sync failed:', error);
    }
  }

  /**
   * 每日 05:30 執行官方頻道訊息同步（LINE + 工單留言）
   */
  @Cron('30 5 * * *')
  async dailyOfficialChannelSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily official channel sync');

    try {
      const result = await this.syncService.syncOfficialChannelMessages();
      this.logger.log(`Daily official channel sync completed: ${result.total_created} created, ${result.total_updated} updated`);
    } catch (error) {
      this.logger.error('Daily official channel sync failed:', error);
    }
  }

  /**
   * 每日 06:00 執行員工工單歷史同步
   */
  @Cron('0 6 * * *')
  async dailyTicketHistorySync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily ticket history sync');

    try {
      const result = await this.syncService.syncTicketHistory();
      this.logger.log(`Daily ticket history sync completed: ${result.total_created} created, ${result.total_updated} updated`);
    } catch (error) {
      this.logger.error('Daily ticket history sync failed:', error);
    }
  }

  /**
   * 每日 06:30 執行評價資料同步
   */
  @Cron('30 6 * * *')
  async dailyReviewSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily review data sync');

    try {
      const result = await this.syncService.syncReviewData();
      this.logger.log(`Daily review sync completed: ${result.total_updated} reviews processed`);
    } catch (error) {
      this.logger.error('Daily review sync failed:', error);
    }
  }

  /**
   * 每日 07:00 執行多來源資料同步
   */
  @Cron('0 7 * * *')
  async dailyDataSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting daily data sync');

    try {
      const result = await this.syncService.syncDailyData();
      this.logger.log(`Daily data sync completed: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Daily data sync failed:', error);
    }
  }

  /**
   * 每小時檢查待抽取的對話
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processExtractionQueue() {
    if (!this.isEnabled) return;

    this.logger.debug('Checking extraction queue');

    try {
      const pendingIntakes = await this.conversationsService.getPendingForExtraction(10);

      if (pendingIntakes.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingIntakes.length} intakes pending extraction`);

      // 處理每個待抽取的對話
      // 這裡需要注入 ExtractionService 來處理
      // 暫時跳過，由 API 觸發
    } catch (error) {
      this.logger.error('Extraction queue processing failed:', error);
    }
  }

  /**
   * 每 30 分鐘檢查待分析的對話
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async processAnalysisQueue() {
    if (!this.isEnabled) return;

    this.logger.debug('Checking analysis queue');

    try {
      const pendingIntakes = await this.conversationsService.getPendingForAnalysis(5);

      if (pendingIntakes.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingIntakes.length} intakes pending analysis`);

      for (const intake of pendingIntakes) {
        try {
          await this.analysisService.analyze(intake.id);
          this.logger.log(`Analysis completed for intake: ${intake.id}`);
        } catch (error) {
          this.logger.error(`Analysis failed for intake ${intake.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Analysis queue processing failed:', error);
    }
  }

  /**
   * 每日 06:00 更新員工狀態快照
   */
  @Cron('0 6 * * *')
  async updateStatusSnapshots() {
    if (!this.isEnabled) return;

    this.logger.log('Starting status snapshot update');

    // 這裡可以加入批量更新所有員工狀態快照的邏輯
    // 目前由 AnalysisService 在每次分析後更新
  }

  
  /**
   * 每月 5 日 05:00 同步 employees_cache（從左手 API）
   */
  @Cron('0 5 5 * *')
  async monthlyEmployeeCacheSync() {
    if (!this.isEnabled) return;

    this.logger.log('Starting monthly employees_cache sync');

    try {
      const result = await this.employeeSyncService.syncAll();
      this.logger.log(`Monthly employees_cache sync completed: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Monthly employees_cache sync failed:', error);
    }
  }


  /**
   * 每日 07:00 發送高風險提醒
   */
  @Cron('0 7 * * *')
  async sendHighRiskAlerts() {
    if (!this.isEnabled) return;

    this.logger.log('Checking for high risk alerts');

    // 這裡可以加入發送提醒的邏輯
    // 例如發送 Email、LINE 訊息等
  }

  /**
   * 手動觸發同步
   */
  async triggerEmployeeSync(): Promise<any> {
    this.logger.log('Manual employee sync triggered');
    return this.syncService.syncEmployees('manual');
  }

  /**
   * 手動觸發每日同步
   */
  async triggerDailySync(): Promise<any> {
    this.logger.log('Manual daily sync triggered');
    return this.syncService.syncDailyData('manual');
  }

  /**
   * 手動觸發官方頻道同步
   */
  async triggerOfficialChannelSync(): Promise<any> {
    this.logger.log('Manual official channel sync triggered');
    return this.syncService.syncOfficialChannelMessages('manual');
  }

  /**
   * 手動觸發工單歷史同步
   */
  async triggerTicketHistorySync(): Promise<any> {
    this.logger.log('Manual ticket history sync triggered');
    return this.syncService.syncTicketHistory('manual');
  }

  /**
   * 手動觸發評價資料同步
   */
  async triggerReviewSync(): Promise<any> {
    this.logger.log('Manual review sync triggered');
    return this.syncService.syncReviewData('manual');
  }
}
