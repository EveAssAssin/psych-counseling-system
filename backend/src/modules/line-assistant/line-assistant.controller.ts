import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LineAssistantService } from './line-assistant.service';
import {
  GenerateAiSuggestionDto,
  SendReplyDto,
  SaveDraftDto,
  CreateGuidelineDto,
  UpdateGuidelineDto,
  UpdateAutoReplySettingsDto,
} from './line-assistant.dto';

@ApiTags('line-assistant')
@Controller('line-assistant')
export class LineAssistantController {
  constructor(private readonly svc: LineAssistantService) {}

  // ── 會話列表 ──
  @Get('conversations')
  @ApiOperation({ summary: '取得 LINE 會話列表' })
  getConversations(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
  ) {
    return this.svc.getConversationList({
      limit: limit ? parseInt(String(limit), 10) : 30,
      offset: offset ? parseInt(String(offset), 10) : 0,
      search,
    });
  }

  @Get('conversations/:threadId/messages')
  @ApiOperation({ summary: '取得單一 thread 的所有訊息' })
  getThreadMessages(@Param('threadId') threadId: string) {
    return this.svc.getThreadMessages(threadId);
  }

  // ── AI 建議 ──
  @Post('suggest')
  @ApiOperation({ summary: '生成 AI 回覆建議' })
  generateSuggestion(@Body() dto: GenerateAiSuggestionDto) {
    return this.svc.generateAiSuggestion(dto);
  }

  // ── 送出回覆 ──
  @Post('send')
  @ApiOperation({ summary: '送出回覆' })
  sendReply(@Body() dto: SendReplyDto) {
    return this.svc.sendReply(dto);
  }

  // ── 儲存草稿 ──
  @Post('draft')
  @ApiOperation({ summary: '儲存草稿' })
  saveDraft(@Body() dto: SaveDraftDto) {
    return this.svc.saveDraft(dto);
  }

  // ── 公司規範 ──
  @Get('guidelines')
  @ApiOperation({ summary: '取得所有公司規範' })
  getGuidelines() { return this.svc.getGuidelines(); }

  @Post('guidelines')
  @ApiOperation({ summary: '新增公司規範' })
  createGuideline(@Body() dto: CreateGuidelineDto) { return this.svc.createGuideline(dto); }

  @Patch('guidelines/:id')
  @ApiOperation({ summary: '更新公司規範' })
  updateGuideline(@Param('id') id: string, @Body() dto: UpdateGuidelineDto) {
    return this.svc.updateGuideline(id, dto);
  }

  @Delete('guidelines/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除公司規範' })
  deleteGuideline(@Param('id') id: string) { return this.svc.deleteGuideline(id); }

  // ── 自動回覆設定 ──
  @Get('auto-reply/settings')
  @ApiOperation({ summary: '取得自動回覆設定' })
  getAutoReplySettings() { return this.svc.getAutoReplySettings(); }

  @Patch('auto-reply/settings')
  @ApiOperation({ summary: '更新自動回覆設定' })
  updateAutoReplySettings(@Body() dto: UpdateAutoReplySettingsDto) {
    return this.svc.updateAutoReplySettings(dto);
  }

  @Get('auto-reply/off-hours')
  @ApiOperation({ summary: '檢查目前是否為非辦公時間' })
  isOffHours() { return this.svc.isOffHours().then(v => ({ is_off_hours: v })); }

  // ── 回覆記錄 ──
  @Get('logs')
  @ApiOperation({ summary: '查詢回覆記錄' })
  getReplyLogs(
    @Query('thread_id') threadId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.svc.getReplyLogs({
      thread_id: threadId,
      status,
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
  }
}
