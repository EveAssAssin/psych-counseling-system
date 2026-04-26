import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupervisorAiService, AiType } from './supervisor-ai.service';

@ApiTags('supervisor-ai')
@Controller('supervisor-hub/ai')
export class SupervisorAiController {
  constructor(private readonly svc: SupervisorAiService) {}

  // ── AI 人格設定 ──
  @Get('personas')
  @ApiOperation({ summary: '取得所有 AI 人格設定' })
  getPersonas() { return this.svc.getPersonas(); }

  @Patch('personas/:id')
  @ApiOperation({ summary: '更新 AI 人格設定' })
  updatePersona(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updatePersona(id, dto);
  }

  // ── 對話 Session ──
  @Get('sessions')
  @ApiOperation({ summary: '取得主管的 AI 對話列表' })
  getSessions(@Query('supervisor_id') supervisorId: string) {
    return this.svc.getSessions(supervisorId);
  }

  @Post('sessions')
  @ApiOperation({ summary: '建立新 AI 對話 session' })
  createSession(@Body() dto: {
    supervisor_id: string;
    supervisor_name: string;
    employee_app_number?: string;
    employee_name?: string;
    ai_type: AiType;
  }) { return this.svc.createSession(dto); }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: '取得 session 的訊息歷史' })
  getMessages(@Param('id') id: string) {
    return this.svc.getSessionMessages(id);
  }

  // ── 傳送訊息 ──
  @Post('chat')
  @ApiOperation({ summary: '傳送訊息並取得 AI 回應' })
  sendMessage(@Body() dto: {
    session_id: string;
    supervisor_id: string;
    content: string;
  }) { return this.svc.sendMessage(dto); }

  // ── 人員資料彙整（供前端顯示 + 驗證 AI 覆蓋範圍）──
  @Get('employee-summary/:appNumber')
  @ApiOperation({ summary: '取得人員完整資料彙整（隨手記＋對話＋評價＋風險）' })
  getEmployeeSummary(@Param('appNumber') appNumber: string) {
    return this.svc.getEmployeeSummary(appNumber);
  }
}
