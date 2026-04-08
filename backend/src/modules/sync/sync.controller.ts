import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('employees')
  @ApiOperation({ summary: '執行員工主檔同步' })
  @ApiResponse({ status: 201, description: '同步結果' })
  async syncEmployees(@Query('triggered_by') triggeredBy?: string) {
    return this.syncService.syncEmployees(triggeredBy);
  }

  @Post('daily')
  @ApiOperation({ summary: '執行每日多來源資料同步' })
  @ApiResponse({ status: 201, description: '同步結果' })
  async syncDailyData(@Query('triggered_by') triggeredBy?: string) {
    return this.syncService.syncDailyData(triggeredBy);
  }

  @Post('official-channel')
  @ApiOperation({ summary: '同步官方頻道訊息（LINE + 工單留言）' })
  @ApiResponse({ status: 201, description: '同步結果' })
  async syncOfficialChannel(@Query('triggered_by') triggeredBy?: string) {
    return this.syncService.syncOfficialChannelMessages(triggeredBy);
  }

  @Post('ticket-history')
  @ApiOperation({ summary: '同步員工工單歷史' })
  @ApiResponse({ status: 201, description: '同步結果' })
  async syncTicketHistory(@Query('triggered_by') triggeredBy?: string) {
    return this.syncService.syncTicketHistory(triggeredBy);
  }

  @Post('review-data')
  @ApiOperation({ summary: '同步評價資料（reviews + 回覆對話）' })
  @ApiResponse({ status: 201, description: '同步結果' })
  async syncReviewData(@Query('triggered_by') triggeredBy?: string) {
    return this.syncService.syncReviewData(triggeredBy);
  }

  @Get('status')
  @ApiOperation({ summary: '取得所有同步狀態（含最後同步時間）' })
  @ApiResponse({ status: 200, description: '同步狀態' })
  async getSyncStatus() {
    return this.syncService.getSyncStatus();
  }

  @Get('logs')
  @ApiOperation({ summary: '取得同步日誌' })
  @ApiResponse({ status: 200, description: '同步日誌列表' })
  async getSyncLogs(@Query('limit') limit?: number) {
    return this.syncService.getRecentSyncLogs(limit);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: '取得單一同步日誌' })
  @ApiResponse({ status: 200, description: '同步日誌' })
  async getSyncLog(@Param('id') id: string) {
    return this.syncService.getSyncLog(id);
  }
}
