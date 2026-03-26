import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  CreateConversationWithFileDto,
  UpdateConversationDto,
  SearchConversationDto,
} from './conversations.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: '建立對話（文字輸入）' })
  @ApiResponse({ status: 201, description: '建立成功' })
  async create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '建立對話（檔案上傳）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        employee_id: { type: 'string', format: 'uuid' },
        conversation_date: { type: 'string', format: 'date-time' },
        conversation_type: { type: 'string' },
        interviewer_name: { type: 'string' },
        background_note: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        need_followup: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['file', 'employee_id'],
    },
  })
  @ApiResponse({ status: 201, description: '建立成功' })
  async createWithFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateConversationWithFileDto,
  ) {
    return this.conversationsService.createWithFile(dto, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Get()
  @ApiOperation({ summary: '搜尋對話' })
  @ApiResponse({ status: 200, description: '搜尋結果' })
  async search(@Query() dto: SearchConversationDto) {
    return this.conversationsService.search(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: '取得對話統計' })
  @ApiResponse({ status: 200, description: '統計資料' })
  async getStats() {
    return this.conversationsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一對話' })
  @ApiResponse({ status: 200, description: '對話資料' })
  @ApiResponse({ status: 404, description: '對話不存在' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.findById(id);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: '取得對話附件' })
  @ApiResponse({ status: 200, description: '附件列表' })
  async getAttachments(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.getAttachments(id);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '取得員工的所有對話' })
  @ApiResponse({ status: 200, description: '對話列表' })
  async findByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.conversationsService.findByEmployee(employeeId);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新對話' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '刪除對話' })
  @ApiResponse({ status: 204, description: '刪除成功' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.conversationsService.delete(id);
  }
}
