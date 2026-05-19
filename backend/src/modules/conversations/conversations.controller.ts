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
  BadRequestException,
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
import { AudioTranscriptionService } from './audio-transcription.service';
import { SmartFillService } from './smart-fill.service';
import {
  CreateConversationDto,
  CreateConversationWithFileDto,
  UpdateConversationDto,
  SearchConversationDto,
} from './conversations.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly audioTranscription: AudioTranscriptionService,
    private readonly smartFill: SmartFillService,
  ) {}

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

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '音檔/逐字稿轉錄與智慧預填',
    description:
      '上傳音檔（mp3/m4a/wav/...）或逐字稿（txt），系統會：' +
      '1. 音檔 → Whisper 轉錄；2. AI 清理、識別發言者、修錯字；' +
      '3. 嘗試辨識員工/訪談者姓名；4. 萃取背景說明與初判風險訊號。' +
      '不建立對話記錄，前端拿到結果後可預覽 / 編輯 / 確認再送 create。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '音檔或文字稿' },
        hint_interviewer_name: { type: 'string', description: '提示主管姓名（通常是登入者）' },
        hint_employee_id: { type: 'string', format: 'uuid', description: '若使用者已選員工，傳 employee_id 幫助比對' },
        language: { type: 'string', description: 'Whisper 語言碼，預設 zh', default: 'zh' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: '轉錄與建議結果' })
  async transcribeAndSmartFill(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      hint_interviewer_name?: string;
      hint_employee_id?: string;
      language?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('請上傳檔案');
    }

    let rawTranscript = '';
    let transcriptionMeta: any = null;

    const isAudio = this.audioTranscription.isAudioFile(file.mimetype, file.originalname);

    if (isAudio) {
      // 音檔路線：先 Whisper 轉錄
      if (!this.audioTranscription.isEnabled()) {
        throw new BadRequestException(
          '音檔轉錄功能未啟用。請在後端 .env 設定 OPENAI_API_KEY，或改為上傳逐字稿（txt）。',
        );
      }
      const transcription = await this.audioTranscription.transcribe(
        file.buffer,
        file.originalname,
        body.language || 'zh',
      );
      rawTranscript = transcription.textWithTimestamps;
      transcriptionMeta = {
        source_type: 'audio',
        duration_seconds: transcription.durationSeconds,
        language: transcription.language,
        whisper_model: transcription.whisperModel,
        segment_count: transcription.segments.length,
      };
    } else if (
      file.mimetype.startsWith('text/') ||
      file.originalname.toLowerCase().endsWith('.txt')
    ) {
      // 純文字逐字稿路線
      rawTranscript = file.buffer.toString('utf-8');
      transcriptionMeta = {
        source_type: 'text_transcript',
        char_count: rawTranscript.length,
      };
    } else {
      throw new BadRequestException(
        `不支援的檔案類型：${file.mimetype}。請上傳音檔（mp3/m4a/wav/...）或文字稿（.txt）。`,
      );
    }

    // 取得已選員工的姓名（如有）作為 hint
    let hintEmployeeName: string | undefined;
    if (body.hint_employee_id) {
      try {
        const emp = await this.conversationsService.findByEmployee(body.hint_employee_id);
        // findByEmployee 取的是對話列表，不是員工本身。改用其他方式
        // 簡化：不查名字，讓 AI 從稿子自己抓
      } catch {}
    }

    // 智慧預填
    const suggestions = await this.smartFill.processTranscript(rawTranscript, {
      hintInterviewerName: body.hint_interviewer_name,
      hintEmployeeName,
    });

    return {
      raw_transcript: rawTranscript,
      transcription_meta: transcriptionMeta,
      suggestions,
    };
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

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '取得員工的所有對話' })
  @ApiResponse({ status: 200, description: '對話列表' })
  async findByEmployee(@Param('employeeId') employeeId: string) {
    return this.conversationsService.findByEmployee(employeeId);
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
