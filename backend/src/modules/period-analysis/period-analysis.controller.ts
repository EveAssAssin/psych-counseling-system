import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PeriodAnalysisService, PeriodAnalysisRequest } from './period-analysis.service';

@ApiTags('period-analysis')
@Controller('period-analysis')
export class PeriodAnalysisController {
  constructor(private readonly service: PeriodAnalysisService) {}

  @Post()
  @ApiOperation({ summary: '執行時段 AI 分析（熱門議題、高風險名單、時間軸摘要）' })
  async analyze(@Body() body: PeriodAnalysisRequest) {
    return this.service.analyze(body);
  }
}
