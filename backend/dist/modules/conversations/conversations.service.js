"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ConversationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const conversations_dto_1 = require("./conversations.dto");
let ConversationsService = ConversationsService_1 = class ConversationsService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(ConversationsService_1.name);
        this.TABLE = 'conversation_intakes';
        this.ATTACHMENTS_TABLE = 'conversation_attachments';
    }
    async create(dto, uploadedBy) {
        this.logger.log(`Creating conversation for employee: ${dto.employee_id}`);
        const intake = await this.supabase.create(this.TABLE, {
            employee_id: dto.employee_id,
            source_type: conversations_dto_1.IntakeSourceType.MANUAL_TEXT,
            conversation_date: dto.conversation_date || new Date().toISOString(),
            conversation_type: dto.conversation_type,
            interviewer_name: dto.interviewer_name,
            background_note: dto.background_note,
            raw_text: dto.raw_text,
            extracted_text: dto.raw_text,
            priority: dto.priority || conversations_dto_1.Priority.NORMAL,
            need_followup: dto.need_followup || false,
            tags: dto.tags || [],
            intake_status: conversations_dto_1.IntakeStatus.EXTRACTED,
            extraction_status: 'completed',
            uploaded_by: uploadedBy,
            imported_at: new Date().toISOString(),
        }, { useAdmin: true });
        this.logger.log(`Conversation created: ${intake.id}`);
        return intake;
    }
    async createWithFile(dto, file, uploadedBy) {
        this.logger.log(`Creating conversation with file for employee: ${dto.employee_id}`);
        let sourceType = conversations_dto_1.IntakeSourceType.MANUAL_TEXT;
        if (file.mimetype === 'application/pdf') {
            sourceType = conversations_dto_1.IntakeSourceType.PDF;
        }
        else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/msword') {
            sourceType = conversations_dto_1.IntakeSourceType.DOCX;
        }
        else if (file.mimetype.startsWith('image/')) {
            sourceType = conversations_dto_1.IntakeSourceType.IMAGE_OCR;
        }
        const intake = await this.supabase.create(this.TABLE, {
            employee_id: dto.employee_id,
            source_type: sourceType,
            conversation_date: dto.conversation_date || new Date().toISOString(),
            conversation_type: dto.conversation_type,
            interviewer_name: dto.interviewer_name,
            background_note: dto.background_note,
            priority: dto.priority || conversations_dto_1.Priority.NORMAL,
            need_followup: dto.need_followup || false,
            tags: dto.tags || [],
            intake_status: conversations_dto_1.IntakeStatus.PENDING,
            extraction_status: 'pending',
            uploaded_by: uploadedBy,
            imported_at: new Date().toISOString(),
        }, { useAdmin: true });
        const storagePath = `conversations/${intake.id}/${file.originalname}`;
        await this.supabase.uploadFile('attachments', storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });
        await this.supabase.create(this.ATTACHMENTS_TABLE, {
            conversation_intake_id: intake.id,
            storage_path: storagePath,
            file_name: file.originalname,
            mime_type: file.mimetype,
            size_bytes: file.size,
            extraction_status: 'pending',
            uploaded_at: new Date().toISOString(),
        }, { useAdmin: true });
        this.logger.log(`Conversation with file created: ${intake.id}`);
        return intake;
    }
    async findById(id) {
        const intake = await this.supabase.findOne(this.TABLE, { id }, { useAdmin: true });
        if (!intake) {
            throw new common_1.NotFoundException(`Conversation not found: ${id}`);
        }
        return intake;
    }
    async getAttachments(conversationId) {
        return this.supabase.findMany(this.ATTACHMENTS_TABLE, {
            filters: { conversation_intake_id: conversationId },
            orderBy: { column: 'uploaded_at', ascending: false },
            useAdmin: true,
        });
    }
    async search(dto) {
        const limit = dto.limit || 20;
        const offset = dto.offset || 0;
        const client = this.supabase.getAdminClient();
        let query = client.from(this.TABLE).select('*', { count: 'exact' });
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
    async findByEmployee(employeeId) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_id: employeeId },
            orderBy: { column: 'conversation_date', ascending: false },
            useAdmin: true,
        });
    }
    async update(id, dto) {
        this.logger.log(`Updating conversation: ${id}`);
        const intake = await this.supabase.update(this.TABLE, { id }, dto, { useAdmin: true });
        if (!intake) {
            throw new common_1.NotFoundException(`Conversation not found: ${id}`);
        }
        return intake;
    }
    async updateStatus(id, status, error) {
        const updateData = {
            intake_status: status,
        };
        if (status === conversations_dto_1.IntakeStatus.FAILED && error) {
            updateData.extraction_error = error;
            updateData.extraction_status = 'failed';
        }
        return this.update(id, updateData);
    }
    async updateExtractedText(id, extractedText) {
        this.logger.log(`Updating extracted text for conversation: ${id}`);
        return this.supabase.update(this.TABLE, { id }, {
            extracted_text: extractedText,
            extraction_status: 'completed',
            intake_status: conversations_dto_1.IntakeStatus.EXTRACTED,
        }, { useAdmin: true });
    }
    async delete(id) {
        this.logger.log(`Deleting conversation: ${id}`);
        const attachments = await this.getAttachments(id);
        if (attachments.length > 0) {
            const paths = attachments.map((a) => a.storage_path);
            await this.supabase.deleteFile('attachments', paths);
            await this.supabase.delete(this.ATTACHMENTS_TABLE, {
                conversation_intake_id: id,
            });
        }
        await this.supabase.delete(this.TABLE, { id }, { useAdmin: true });
    }
    async getPendingForExtraction(limit = 10) {
        return this.supabase.findMany(this.TABLE, {
            filters: { intake_status: conversations_dto_1.IntakeStatus.PENDING },
            orderBy: { column: 'created_at', ascending: true },
            limit,
            useAdmin: true,
        });
    }
    async getPendingForAnalysis(limit = 10) {
        return this.supabase.findMany(this.TABLE, {
            filters: { intake_status: conversations_dto_1.IntakeStatus.EXTRACTED },
            orderBy: { column: 'created_at', ascending: true },
            limit,
            useAdmin: true,
        });
    }
    async getStats() {
        const [total, pending, completed, failed, needFollowup] = await Promise.all([
            this.supabase.count(this.TABLE, {}, { useAdmin: true }),
            this.supabase.count(this.TABLE, { intake_status: conversations_dto_1.IntakeStatus.PENDING }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { intake_status: conversations_dto_1.IntakeStatus.COMPLETED }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { intake_status: conversations_dto_1.IntakeStatus.FAILED }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { need_followup: true }, { useAdmin: true }),
        ]);
        return { total, pending, completed, failed, needFollowup };
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = ConversationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map