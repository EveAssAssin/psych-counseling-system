import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { QueryService, QueryRequest } from './query.service';

@ApiTags('query')
@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  @ApiOperation({ summary: '問答查詢（心橋/OpenClaw 整合用）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '問題' },
        employee_identifier: {
          type: 'object',
          properties: {
            employeeappnumber: { type: 'string' },
            employeeerpid: { type: 'string' },
            name: { type: 'string' },
          },
        },
        context: { type: 'string', description: '額外背景資訊' },
        requester_id: { type: 'string', description: '查詢者 ID' },
      },
      required: ['question'],
    },
  })
  @ApiResponse({ status: 200, description: '查詢結果' })
  async query(@Body() request: QueryRequest) {
    return this.queryService.query(request);
  }

  @Get('employee-status')
  @ApiOperation({ summary: '取得員工狀態摘要' })
  @ApiResponse({ status: 200, description: '員工狀態' })
  async getEmployeeStatus(
    @Query('employeeappnumber') employeeappnumber?: string,
    @Query('employeeerpid') employeeerpid?: string,
    @Query('name') name?: string,
  ) {
    return this.queryService.getEmployeeStatusSummary({
      employeeappnumber,
      employeeerpid,
      name,
    });
  }

  @Post('chat')
  @ApiOperation({ summary: '對話式查詢' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '使用者訊息' },
        session_id: { type: 'string', description: '對話 Session ID' },
        user_id: { type: 'string', description: '使用者 ID' },
      },
      required: ['message'],
    },
  })
  @ApiResponse({ status: 200, description: '回覆' })
  async chat(
    @Body() body: { message: string; session_id?: string; user_id?: string },
  ) {
    // 簡單封裝為 query 格式
    return this.queryService.query({
      question: body.message,
      requester_id: body.user_id,
    });
  }
}
