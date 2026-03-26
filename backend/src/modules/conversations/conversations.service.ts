import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ConversationIntake,
  ConversationAttachment,
  CreateConversationDto,
  UpdateConversationDto,
  SearchConversationDto,
  IntakeSourceType,
  IntakeStatus,
  Priority,
} from './conversations.dto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  private readonly TABLE = 'conversation_intakes';
  private readonly ATTACHMENTS_TABLE = 'conversation_attachments';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 建立對話（文字輸入）
   */
  async create(dto: CreateConversationDto, uploadedBy?: string): Promise<ConversationIntake> {
    this.logger.log(`Creating conversation for employee: ${dto.employee_id}`);

    const intake = await this.supabase.create<ConversationIntake>(
      this.TABLE,
      {
        employee_id: dto.employee_id,
        source_type: IntakeSourceType.MANUAL_TEXT,
        conversation_date: dto.conversation_date || new Date().toISOString(),
        conversation_type: dto.conversation_type,
        interviewer_name: dto.interviewer_name,
        background_note: dto.background_note,
        raw_text: dto.raw_text,
        extracted_text: dto.raw_text, // 文字輸入不需要抽取
        priority: dto.priority || Priority.NORMAL,
        need_followup: dto.need_followup || false,
        tags: dto.tags || [],
        intake_status: IntakeStatus.EXTRACTED, // 直接進入已抽取狀態
        extraction_status: 'completed',
        uploaded_by: uploadedBy,
        imported_at: new Date().toISOString(),
      },
      { useAdmin: true },
    );

    this.logger.log(`Conversation created: ${intake.id}`);
    return intake;
  }

  /**
   * 建立對話（檔案上傳）
   */
  async createWithFile(
    dto: {
      employee_id: string;
      conversation_date?: string;
      conversation_type?: string;
      interviewer_name?: string;
      background_note?: string;
      priority?: Priority;
      need_followup?: boolean;
      tags?: string[];
    },
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    uploadedBy?: string,
  ): Promise<ConversationIntake> {
    this.logger.log(`Creating conversation with file for employee: ${dto.employee_id}`);

    // 判斷來源類型
    let sourceType = IntakeSourceType.MANUAL_TEXT;
    if (file.mimetype === 'application/pdf') {
      sourceType = IntakeSourceType.PDF;
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      sourceType = IntakeSourceType.DOCX;
    } else if (file.mimetype.startsWith('image/')) {
      sourceType = IntakeSourceType.IMAGE_OCR;
    }

    // 建立 intake 記錄
    const intake = await this.supabase.create<ConversationIntake>(
      this.TABLE,
      {
        employee_id: dto.employee_id,
        source_type: sourceType,
        conversation_date: dto.conversation_date || new Date().toISOString(),
        conversation_type: dto.conversation_type,
        interviewer_name: dto.interviewer_name,
        background_note: dto.background_note,
        priority: dto.priority || Priority.NORMAL,
        need_followup: dto.need_followup || false,
        tags: dto.tags || [],
        intake_status: IntakeStatus.PENDING,
        extraction_status: 'pending',
        uploaded_by: uploadedBy,
        imported_at: new Date().toISOString(),
      },
      { useAdmin: true },
    );

    // 上傳檔案到 Storage
    const storagePath = `conversations/${intake.id}/${file.originalname}`;
    await this.supabase.uploadFile('attachments', storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

    // 建立附件記錄
    await this.supabase.create<ConversationAttachment>(
      this.ATTACHMENTS_TABLE,
      {
        conversation_intake_id: intake.id,
        storage_path: storagePath,
        file_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        extraction_status: 'pending',
        uploaded_at: new Date().toISOString(),
      },
      { useAdmin: true },
    );

    this.logger.log(`Conversation with file created: ${intake.id}`);
    return intake;
  }

  /**
   * 取得單一對話
   */
  async findById(id: string): Promise<ConversationIntake> {
    const intake = await this.supabase.findOne<ConversationIntake>(
      this.TABLE,
      { id },
      { useAdmin: true },
    );

    if (!intake) {
      throw new NotFoundException(`Conversation not found: ${id}`);
    }

    return intake;
  }

  /**
   * 取得對話附件
   */
  async getAttachments(conversationId: string): Promise<ConversationAttachment[]> {
    return this.supabase.findMany<ConversationAttachment>(this.ATTACHMENTS_TABLE, {
      filters: { conversation_intake_id: conversationId },
      orderBy: { column: 'uploaded_at', ascending: false },
      useAdmin: true,
    });
  }

  /**
   * 搜尋對話
   */
  async search(dto: SearchConversationDto): Promise<{
    data: ConversationIntake[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = dto.limit || 20;
    const offset = dto.offset || 0;

    const client = this.supabase.getAdminClient();
    let query = client.from(this.TABLE).select('*', { count: 'exact' });

    // 篩選條件
    if (dto.employee_id) {
      query = query.eq('employee_id', dto.employee_id);
    }
    if (dto.status) {
      query = query.eq('intake_status', dto.status);
    }
    if (dto.priority) {
      query = query.eq('priority', dto.priority);
    }
    if (dto.need_followup !== undefined) {
      query = query.eq('need_followup', dto.need_followup);
    }
    if (dto.date_from) {
      query = query.gte('conversation_date', dto.date_from);
    }
    if (dto.date_to) {
      query = query.lte('conversation_date', dto.date_to);
    }

    // 排序與分頁
    query = query
      .order('conversation_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error('Error searching conversations:', error);
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
      limit,
      offset,
    };
  }

  /**
   * 取得員工的所有對話
   */
  async findByEmployee(employeeId: string): Promise<ConversationIntake[]> {
    return this.supabase.findMany<ConversationIntake>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'conversation_date', ascending: false },
      useAdmin: true,
    });
  }

  /**
   * 更新對話
   */
  async update(id: string, dto: UpdateConversationDto): Promise<ConversationIntake> {
    this.logger.log(`Updating conversation: ${id}`);

    const intake = await this.supabase.update<ConversationIntake>(
      this.TABLE,
      { id },
      dto,
      { useAdmin: true },
    );

    if (!intake) {
      throw new NotFoundException(`Conversation not found: ${id}`);
    }

    return intake;
  }

  /**
   * 更新狀態
   */
  async updateStatus(
    id: string,
    status: IntakeStatus,
    error?: string,
  ): Promise<ConversationIntake> {
    const updateData: Partial<ConversationIntake> = {
      intake_status: status,
    };

    if (status === IntakeStatus.FAILED && error) {
      // 根據之前的狀態判斷是哪個階段失敗
      updateData.extraction_error = error;
      updateData.extraction_status = 'failed';
    }

    return this.update(id, updateData as any);
  }

  /**
   * 更新抽取結果
   */
  async updateExtractedText(id: string, extractedText: string): Promise<ConversationIntake> {
    this.logger.log(`Updating extracted text for conversation: ${id}`);

    return this.supabase.update<ConversationIntake>(
      this.TABLE,
      { id },
      {
        extracted_text: extractedText,
        extraction_status: 'completed',
        intake_status: IntakeStatus.EXTRACTED,
      } as any,
      { useAdmin: true },
    ) as Promise<ConversationIntake>;
  }

  /**
   * 刪除對話
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting conversation: ${id}`);

    // 先刪除附件
    const attachments = await this.getAttachments(id);
    if (attachments.length > 0) {
      const paths = attachments.map((a) => a.storage_path);
      await this.supabase.deleteFile('attachments', paths);
      await this.supabase.delete(this.ATTACHMENTS_TABLE, {
        conversation_intake_id: id,
      });
    }

    // 刪除對話
    await this.supabase.delete(this.TABLE, { id }, { useAdmin: true });
  }

  /**
   * 取得待處理的對話（供排程使用）
   */
  async getPendingForExtraction(limit: number = 10): Promise<ConversationIntake[]> {
    return this.supabase.findMany<ConversationIntake>(this.TABLE, {
      filters: { intake_status: IntakeStatus.PENDING },
      orderBy: { column: 'created_at', ascending: true },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 取得待分析的對話（供排程使用）
   */
  async getPendingForAnalysis(limit: number = 10): Promise<ConversationIntake[]> {
    return this.supabase.findMany<ConversationIntake>(this.TABLE, {
      filters: { intake_status: IntakeStatus.EXTRACTED },
      orderBy: { column: 'created_at', ascending: true },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 取得統計
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    needFollowup: number;
  }> {
    const [total, pending, completed, failed, needFollowup] = await Promise.all([
      this.supabase.count(this.TABLE, {}, { useAdmin: true }),
      this.supabase.count(this.TABLE, { intake_status: IntakeStatus.PENDING }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { intake_status: IntakeStatus.COMPLETED }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { intake_status: IntakeStatus.FAILED }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { need_followup: true }, { useAdmin: true }),
    ]);

    return { total, pending, completed, failed, needFollowup };
  }
}
