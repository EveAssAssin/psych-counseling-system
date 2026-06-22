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

    // 串連附件：前端已先呼叫 /api/upload 把檔案存到 Storage，
    // 這裡只把回傳的檔案資訊寫進 conversation_attachments 建立關聯。
    if (Array.isArray(dto.attachments) && dto.attachments.length > 0) {
      for (const att of dto.attachments) {
        if (!att || !att.path) continue;
        await this.supabase.create<ConversationAttachment>(
          this.ATTACHMENTS_TABLE,
          {
            conversation_intake_id: intake.id,
            storage_path: att.path,
            file_name: att.fileName || String(att.path).split('/').pop(),
            mime_type: att.mimeType,
            size_bytes: att.fileSize,
            extraction_status: 'pending',
            uploaded_at: new Date().toISOString(),
          },
          { useAdmin: true },
        );
      }
      this.logger.log(
        `Linked ${dto.attachments.length} attachment(s) to intake ${intake.id}`,
      );
    }

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
    const client = this.supabase.getAdminClient();
    const { data: intake, error } = await client
      .from(this.TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !intake) {
      throw new NotFoundException(`Conversation not found: ${id}`);
    }

    // 額外查員工資料 attach 上去（兩段式查詢避免 PostgREST embed 漏 row）
    const anyIntake = intake as any;
    if (anyIntake.employee_id) {
      const { data: emp } = await client
        .from('employees')
        .select('id, name, employeeappnumber, department, store_name, title')
        .eq('id', anyIntake.employee_id)
        .maybeSingle();
      anyIntake.employee = emp || null;
    } else {
      anyIntake.employee = null;
    }

    return anyIntake as ConversationIntake;
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
    let query = client
      .from(this.TABLE)
      .select('*', { count: 'exact' });

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

    // 批次查員工資料：把所有 unique employee_id 抓出來查一次，attach 回每筆 row。
    // 改成兩段式查詢，避免 PostgREST embed (`*, employee:employees(...)`)
    // 在某些 FK / null 情境下把整列 row 漏掉（5/26 之前的資料消失的根因）。
    const rows = (data || []) as any[];
    const empIds = Array.from(new Set(rows.map((r) => r.employee_id).filter(Boolean)));
    const empMap = new Map<string, any>();
    if (empIds.length > 0) {
      const { data: emps } = await client
        .from('employees')
        .select('id, name, employeeappnumber, department, store_name')
        .in('id', empIds);
      for (const e of emps || []) empMap.set(e.id, e);
    }
    const enriched = rows.map((r) => ({
      ...r,
      employee: r.employee_id ? empMap.get(r.employee_id) || null : null,
    }));

    return {
      data: enriched as any,
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

    // 編輯對話內容(raw_text)時一併同步 extracted_text，
    // 否則分析讀的是 extracted_text || raw_text，會看到舊內容。
    const patch: Record<string, any> = { ...dto };
    if (dto.raw_text !== undefined) {
      patch.extracted_text = dto.raw_text;
    }

    const intake = await this.supabase.update<ConversationIntake>(
      this.TABLE,
      { id },
      patch,
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
