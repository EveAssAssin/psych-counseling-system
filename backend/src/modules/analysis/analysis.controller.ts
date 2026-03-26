import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { RunAnalysisDto, SearchAnalysisDto } from './analysis.dto';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('run')
  @ApiOperation({ summary: '執行 AI 分析' })
  @ApiResponse({ status: 201, description: '分析完成' })
  async runAnalysis(@Body() dto: RunAnalysisDto) {
    return this.analysisService.analyze(dto.conversation_intake_id, dto.force);
  }

  @Post('run/:conversationId')
  @ApiOperation({ summary: '對特定對話執行 AI 分析' })
  @ApiResponse({ status: 201, description: '分析完成' })
  async runAnalysisForConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('force') force?: boolean,
  ) {
    return this.analysisService.analyze(conversationId, force);
  }

  @Get()
  @ApiOperation({ summary: '搜尋分析結果' })
  @ApiResponse({ status: 200, description: '搜尋結果' })
  async search(@Query() dto: SearchAnalysisDto) {
    return this.analysisService.search(dto);
  }

  @Get('high-risk')
  @ApiOperation({ summary: '取得高風險分析列表' })
  @ApiResponse({ status: 200, description: '高風險列表' })
  async getHighRisk(@Query('limit') limit?: number) {
    return this.analysisService.getHighRiskAnalyses(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一分析結果' })
  @ApiResponse({ status: 200, description: '分析結果' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.analysisService.findById(id);
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: '取得對話的分析結果' })
  @ApiResponse({ status: 200, description: '分析結果' })
  async findByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    const result = await this.analysisService.findByConversationId(conversationId);
    if (!result) {
      return { found: false, message: 'Analysis not found for this conversation' };
    }
    return result;
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '取得員工的所有分析結果' })
  @ApiResponse({ status: 200, description: '分析列表' })
  async findByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.analysisService.findByEmployee(employeeId);
  }

  @Get('employee/:employeeId/latest')
  @ApiOperation({ summary: '取得員工最新分析結果' })
  @ApiResponse({ status: 200, description: '最新分析結果' })
  async getLatestByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const result = await this.analysisService.getLatestByEmployee(employeeId);
    if (!result) {
      return { found: false, message: 'No analysis found for this employee' };
    }
    return result;
  }
}
