import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CounselingCasesService } from './counseling-cases.service';
import { CaseAiService } from './case-ai.service';
import {
  CreateCaseDraftDto, ConfirmCaseDto, UpdateCaseDto,
  UpdatePlanItemDto, CreateExecutionDto,
  UpsertStateTagDto, UpsertHolidayDto,
  TodayTasksQueryDto, ListCasesQueryDto,
} from './counseling-cases.dto';

@ApiTags('counseling-cases')
@Controller('counseling-cases')
export class CounselingCasesController {
  constructor(
    private readonly svc: CounselingCasesService,
    private readonly aiSvc: CaseAiService,
  ) {}

  // ── 狀態標籤字典 ──
  @Get('state-tags')
  @ApiOperation({ summary: '取得狀態標籤列表' })
  listStateTags(@Query('include_inactive') includeInactive?: string) {
    return this.svc.listStateTags(includeInactive === 'true');
  }

  @Post('state-tags')
  @ApiOperation({ summary: '新增 / 更新狀態標籤（後台）' })
  upsertStateTag(@Body() dto: UpsertStateTagDto) {
    return this.svc.upsertStateTag(dto);
  }

  @Delete('state-tags/:id')
  @ApiOperation({ summary: '停用狀態標籤' })
  deactivateStateTag(@Param('id') id: string) {
    return this.svc.deactivateStateTag(id);
  }

  // ── 假日表 ──
  @Get('holidays')
  @ApiOperation({ summary: '取得假日列表（可帶 year）' })
  listHolidays(@Query('year') year?: string) {
    return this.svc.listHolidays(year ? parseInt(year, 10) : undefined);
  }

  @Post('holidays')
  @ApiOperation({ summary: '新增 / 更新假日' })
  upsertHoliday(@Body() dto: UpsertHolidayDto) {
    return this.svc.upsertHoliday(dto);
  }

  @Delete('holidays/:date')
  @ApiOperation({ summary: '刪除假日' })
  deleteHoliday(@Param('date') date: string) {
    return this.svc.deleteHoliday(date);
  }

  // ── 今日任務（dashboard 用，先放上面方便前端常呼叫）──
  @Get('today')
  @ApiOperation({ summary: '今日輔導任務（可帶 date / supervisor_id）' })
  getToday(@Query() query: TodayTasksQueryDto) {
    return this.svc.getTodayTasks(query);
  }

  @Get('overdue')
  @ApiOperation({ summary: '過期未完成任務' })
  getOverdue(@Query('supervisor_id') supervisorId?: string) {
    return this.svc.getOverdueTasks(supervisorId);
  }

  // ── 建案：草稿 / 確認 ──
  @Post('draft')
  @ApiOperation({ summary: 'AI 排程草稿（不寫 DB，回 draft_token + 預覽）' })
  createDraft(@Body() dto: CreateCaseDraftDto) {
    return this.svc.createDraft(dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: '確認草稿並寫入正式案（含工作日自動對齊）' })
  confirm(@Body() dto: ConfirmCaseDto) {
    return this.svc.confirmCase(dto);
  }

  // ── 輔導案列表 / 詳情 ──
  @Get()
  @ApiOperation({ summary: '輔導案列表（含篩選）' })
  list(@Query() query: ListCasesQueryDto) {
    return this.svc.listCases(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '輔導案詳情（含排程與執行紀錄）' })
  get(@Param('id') id: string) {
    return this.svc.getCase(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新輔導案' })
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.svc.updateCase(id, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '結案' })
  close(@Param('id') id: string, @Body() body: { closing_summary: string }) {
    return this.svc.closeCase(id, body.closing_summary);
  }

  // ── 排程節點 ──
  @Patch('plan-items/:itemId')
  @ApiOperation({ summary: '更新排程節點（改期 / 跳過 / 標記完成；自動對齊工作日）' })
  updatePlanItem(@Param('itemId') itemId: string, @Body() dto: UpdatePlanItemDto) {
    return this.svc.updatePlanItem(itemId, dto);
  }

  // ── 執行紀錄 ──
  @Post(':id/executions')
  @ApiOperation({ summary: '新增執行紀錄（自動標記對應 plan_item 為 done）' })
  createExecution(@Param('id') id: string, @Body() dto: CreateExecutionDto) {
    return this.svc.createExecution(id, dto);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: '取得執行紀錄列表' })
  listExecutions(@Param('id') id: string) {
    return this.svc.listExecutions(id);
  }

  // ── 案件 AI 討論（Phase 4） ──
  @Get(':id/ai/sessions')
  @ApiOperation({ summary: '列出案件下所有 AI 討論 session' })
  listAiSessions(@Param('id') id: string) {
    return this.aiSvc.listSessions(id);
  }

  @Post(':id/ai/session')
  @ApiOperation({ summary: '取得或建立此輔導員在此案的 session（同人同案共用一個 session）' })
  openAiSession(
    @Param('id') id: string,
    @Body() body: { supervisor_identifier: string },
  ) {
    return this.aiSvc.getOrCreateSession(id, body.supervisor_identifier);
  }

  @Get('ai/sessions/:sessionId/messages')
  @ApiOperation({ summary: '取得 session 訊息列表' })
  listAiMessages(
    @Param('sessionId') sessionId: string,
    @Query('supervisor_identifier') supervisorIdentifier: string,
  ) {
    return this.aiSvc.getMessages(sessionId, supervisorIdentifier);
  }

  @Post('ai/sessions/:sessionId/messages')
  @ApiOperation({ summary: '在 session 發送訊息，AI 自動回覆（含案件上下文）' })
  sendAiMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { supervisor_identifier: string; content: string },
  ) {
    return this.aiSvc.sendMessage(sessionId, body.supervisor_identifier, body.content);
  }
}
