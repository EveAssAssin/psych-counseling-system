import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OfficialChannelService } from './official-channel.service';

@ApiTags('official-channel')
@Controller('official-channel')
export class OfficialChannelController {
  constructor(private readonly officialChannelService: OfficialChannelService) {}

  @Get()
  @ApiOperation({ summary: '搜尋官方頻道訊息' })
  @ApiQuery({ name: 'employee_id', required: false })
  @ApiQuery({ name: 'employee_app_number', required: false })
  @ApiQuery({ name: 'channel', required: false, description: 'official-line 或 ticket-comment' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: '訊息列表' })
  async search(
    @Query('employee_id') employeeId?: string,
    @Query('employee_app_number') employeeAppNumber?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.officialChannelService.search({
      employee_id: employeeId,
      employee_app_number: employeeAppNumber,
      channel,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: '取得統計資料' })
  @ApiResponse({ status: 200, description: '統計資料' })
  async getStats() {
    return this.officialChannelService.getStats();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '依員工 ID 取得訊息' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: '訊息列表' })
  async getByEmployeeId(
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: number,
  ) {
    return this.officialChannelService.getByEmployeeId(employeeId, limit ? Number(limit) : undefined);
  }

  @Get('by-app-number/:appNumber')
  @ApiOperation({ summary: '依員工 APP Number 取得訊息' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: '訊息列表' })
  async getByAppNumber(
    @Param('appNumber') appNumber: string,
    @Query('limit') limit?: number,
  ) {
    return this.officialChannelService.getByEmployeeAppNumber(appNumber, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一訊息' })
  @ApiResponse({ status: 200, description: '訊息詳情' })
  async getById(@Param('id') id: string) {
    return this.officialChannelService.getById(id);
  }
}
