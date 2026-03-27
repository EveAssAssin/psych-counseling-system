import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EmployeeInsightService } from './employee-insight.service';

@ApiTags('employee-insight')
@Controller('api/v1/employee-insight')
export class EmployeeInsightController {
  constructor(private readonly insightService: EmployeeInsightService) {}

  @Get(':appNumber')
  @ApiOperation({ 
    summary: '取得員工綜合洞察',
    description: '整合所有可用資料（對話、LINE 訊息、工單留言、出勤、加扣分、評價）進行 AI 綜合分析，提供溝通建議與調動評估。'
  })
  @ApiParam({ name: 'appNumber', description: '員工會員編號 (employeeappnumber)' })
  @ApiQuery({ name: 'days', required: false, description: '分析天數範圍（預設 30 天）' })
  @ApiQuery({ name: 'refresh', required: false, description: '是否強制重新分析' })
  @ApiResponse({ status: 200, description: '員工綜合洞察結果' })
  @ApiResponse({ status: 404, description: '員工不存在' })
  async getInsight(
    @Param('appNumber') appNumber: string,
    @Query('days') days?: number,
    @Query('refresh') refresh?: boolean,
  ) {
    try {
      const insight = await this.insightService.getInsight(appNumber, {
        days: days ? Number(days) : 30,
        forceRefresh: refresh === true,
      });

      return {
        success: true,
        data: insight,
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException(
          { success: false, error: 'Employee not found', app_number: appNumber },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':appNumber/summary')
  @ApiOperation({ 
    summary: '取得員工快速摘要',
    description: '只回傳狀態摘要，不含完整分析（速度較快）'
  })
  @ApiParam({ name: 'appNumber', description: '員工會員編號' })
  @ApiResponse({ status: 200, description: '員工狀態摘要' })
  async getSummary(@Param('appNumber') appNumber: string) {
    try {
      const insight = await this.insightService.getInsight(appNumber, { days: 30 });

      return {
        success: true,
        data: {
          employee: {
            name: insight.employee.name,
            department: insight.employee.department,
            store_name: insight.employee.store_name,
          },
          summary: insight.summary,
          data_sources: insight.data_sources,
          quick_tips: {
            should_talk_soon: insight.summary.risk_level === 'high' || insight.summary.risk_level === 'critical',
            trend_warning: insight.summary.trend === 'worsening',
            suggested_timing: insight.communication.suggested_timing,
          },
        },
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException(
          { success: false, error: 'Employee not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':appNumber/communication')
  @ApiOperation({ 
    summary: '取得溝通建議',
    description: '只回傳溝通相關建議（話術、時機、避雷區）'
  })
  @ApiParam({ name: 'appNumber', description: '員工會員編號' })
  @ApiResponse({ status: 200, description: '溝通建議' })
  async getCommunicationTips(@Param('appNumber') appNumber: string) {
    try {
      const insight = await this.insightService.getInsight(appNumber, { days: 30 });

      return {
        success: true,
        data: {
          employee_name: insight.employee.name,
          risk_level: insight.summary.risk_level,
          communication: insight.communication,
          key_concerns: insight.summary.key_concerns,
        },
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException(
          { success: false, error: 'Employee not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':appNumber/timeline')
  @ApiOperation({ 
    summary: '取得員工時間軸',
    description: '回傳員工近期所有事件的時間軸'
  })
  @ApiParam({ name: 'appNumber', description: '員工會員編號' })
  @ApiQuery({ name: 'days', required: false, description: '天數範圍（預設 30 天）' })
  @ApiResponse({ status: 200, description: '時間軸資料' })
  async getTimeline(
    @Param('appNumber') appNumber: string,
    @Query('days') days?: number,
  ) {
    try {
      const insight = await this.insightService.getInsight(appNumber, {
        days: days ? Number(days) : 30,
      });

      return {
        success: true,
        data: {
          employee_name: insight.employee.name,
          date_range: insight.data_sources.date_range,
          event_count: insight.timeline.length,
          timeline: insight.timeline,
        },
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException(
          { success: false, error: 'Employee not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':appNumber/transfer-assessment')
  @ApiOperation({ 
    summary: '取得調動評估',
    description: '回傳員工調動相關的評估資訊'
  })
  @ApiParam({ name: 'appNumber', description: '員工會員編號' })
  @ApiResponse({ status: 200, description: '調動評估' })
  async getTransferAssessment(@Param('appNumber') appNumber: string) {
    try {
      const insight = await this.insightService.getInsight(appNumber, { days: 30 });

      return {
        success: true,
        data: {
          employee_name: insight.employee.name,
          current_status: {
            risk_level: insight.summary.risk_level,
            stress_level: insight.summary.stress_level,
            trend: insight.summary.trend,
          },
          transfer_assessment: insight.transfer_assessment,
          team_dynamics: insight.team_dynamics,
        },
      };
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new HttpException(
          { success: false, error: 'Employee not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
