import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TicketHistoryService } from './ticket-history.service';

@ApiTags('ticket-history')
@Controller('ticket-history')
export class TicketHistoryController {
  constructor(private readonly ticketHistoryService: TicketHistoryService) {}

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '依員工 ID 取得工單歷史' })
  @ApiResponse({ status: 200, description: '工單歷史列表' })
  async getByEmployeeId(
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: number,
  ) {
    return this.ticketHistoryService.getByEmployeeId(employeeId, limit);
  }

  @Get('by-app-number/:appNumber')
  @ApiOperation({ summary: '依 APP Number 取得工單歷史' })
  @ApiResponse({ status: 200, description: '工單歷史列表' })
  async getByAppNumber(
    @Param('appNumber') appNumber: string,
    @Query('limit') limit?: number,
  ) {
    return this.ticketHistoryService.getByEmployeeAppNumber(appNumber, limit);
  }

  @Get('stats/:appNumber')
  @ApiOperation({ summary: '取得員工工單統計' })
  @ApiResponse({ status: 200, description: '工單統計摘要' })
  async getStats(@Param('appNumber') appNumber: string) {
    return this.ticketHistoryService.getStatsByEmployeeAppNumber(appNumber);
  }

  @Get('ticket/:ticketId/conversations')
  @ApiOperation({ summary: '取得工單對話時間軸' })
  @ApiResponse({ status: 200, description: '對話事件列表' })
  async getConversations(@Param('ticketId') ticketId: number) {
    return this.ticketHistoryService.getConversationsByTicketId(ticketId);
  }

  @Get(':ticketId')
  @ApiOperation({ summary: '依工單 ID 取得單張工單' })
  @ApiResponse({ status: 200, description: '工單詳情' })
  async getByTicketId(@Param('ticketId') ticketId: number) {
    return this.ticketHistoryService.getByTicketId(ticketId);
  }
}
