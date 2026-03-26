import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RiskFlagsService } from './risk-flags.service';

@ApiTags('risk-flags')
@Controller('risk-flags')
export class RiskFlagsController {
  constructor(private readonly riskFlagsService: RiskFlagsService) {}

  @Get()
  @ApiOperation({ summary: '取得開放的風險標記' })
  @ApiResponse({ status: 200, description: '風險標記列表' })
  async getOpenFlags(
    @Query('severity') severity?: string,
    @Query('risk_type') riskType?: string,
    @Query('employee_id') employeeId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.riskFlagsService.getOpenFlags({
      severity,
      risk_type: riskType,
      employee_id: employeeId,
      limit,
      offset,
    });
  }

  @Get('high-risk')
  @ApiOperation({ summary: '取得高風險標記（critical + high）' })
  @ApiResponse({ status: 200, description: '高風險標記列表' })
  async getHighRiskFlags(@Query('limit') limit?: number) {
    return this.riskFlagsService.getHighRiskFlags(limit);
  }

  @Get('stats')
  @ApiOperation({ summary: '取得風險統計' })
  @ApiResponse({ status: 200, description: '統計資料' })
  async getStats() {
    return this.riskFlagsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一風險標記' })
  @ApiResponse({ status: 200, description: '風險標記' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.riskFlagsService.findById(id);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '取得員工的風險標記' })
  @ApiResponse({ status: 200, description: '風險標記列表' })
  async findByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.riskFlagsService.findByEmployee(employeeId);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: '確認風險標記' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('user_id') userId: string,
  ) {
    return this.riskFlagsService.acknowledge(id, userId);
  }

  @Patch(':id/start-progress')
  @ApiOperation({ summary: '開始處理風險標記' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async startProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assigned_to') assignedTo?: string,
  ) {
    return this.riskFlagsService.startProgress(id, assignedTo);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: '解決風險標記' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { user_id: string; resolution_note?: string },
  ) {
    return this.riskFlagsService.resolve(id, body.user_id, body.resolution_note);
  }

  @Patch(':id/false-positive')
  @ApiOperation({ summary: '標記為誤報' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async markAsFalsePositive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { user_id: string; note?: string },
  ) {
    return this.riskFlagsService.markAsFalsePositive(id, body.user_id, body.note);
  }
}
