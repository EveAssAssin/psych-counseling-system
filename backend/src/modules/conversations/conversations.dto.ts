import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsEnum,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

// ============================================
// Enums
// ============================================
export enum IntakeSourceType {
  MANUAL_TEXT = 'manual_text',
  PDF = 'pdf',
  DOCX = 'docx',
  IMAGE_OCR = 'image_ocr',
  EXTERNAL_SYNC = 'external_sync',
  OFFICIAL_CHANNEL = 'official_channel',
}

export enum IntakeStatus {
  PENDING = 'pending',
  EXTRACTING = 'extracting',
  EXTRACTED = 'extracted',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ============================================
// Entity
// ============================================
export interface ConversationIntake {
  id: string;
  employee_id: string;
  source_type: IntakeSourceType;
  conversation_date?: string;
  conversation_type?: string;
  interviewer_name?: string;
  background_note?: string;
  raw_text?: string;
  extracted_text?: string;
  priority: Priority;
  need_followup: boolean;
  tags: string[];
  intake_status: IntakeStatus;
  extraction_status?: string;
  extraction_error?: string;
  analysis_status?: string;
  analysis_error?: string;
  uploaded_by?: string;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationAttachment {
  id: string;
  conversation_intake_id: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  size_bytes?: number;
  extracted_text?: string;
  extraction_status: string;
  extraction_error?: string;
  uploaded_at: string;
  created_at: string;
}

// ============================================
// DTOs
// ============================================

export class CreateConversationDto {
  @ApiProperty({ description: '員工 ID' })
  @IsUUID()
  @IsNotEmpty()
  employee_id: string;

  @ApiPropertyOptional({ description: '對話日期時間' })
  @IsDateString()
  @IsOptional()
  conversation_date?: string;

  @ApiPropertyOptional({ description: '對話類型', example: '一對一面談' })
  @IsString()
  @IsOptional()
  conversation_type?: string;

  @ApiPropertyOptional({ description: '訪談者姓名' })
  @IsString()
  @IsOptional()
  interviewer_name?: string;

  @ApiPropertyOptional({ description: '背景說明' })
  @IsString()
  @IsOptional()
  background_note?: string;

  @ApiProperty({ description: '對話內容文字' })
  @IsString()
  @IsNotEmpty()
  raw_text: string;

  @ApiPropertyOptional({
    enum: Priority,
    default: Priority.NORMAL,
    description: '優先等級',
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: '是否需要追蹤', default: false })
  @IsBoolean()
  @IsOptional()
  need_followup?: boolean;

  @ApiPropertyOptional({ description: '標籤', type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: '是否立即分析', default: true })
  @IsBoolean()
  @IsOptional()
  auto_analyze?: boolean;
}

export class CreateConversationWithFileDto {
  @ApiProperty({ description: '員工 ID' })
  @IsUUID()
  @IsNotEmpty()
  employee_id: string;

  @ApiPropertyOptional({ description: '對話日期時間' })
  @IsDateString()
  @IsOptional()
  conversation_date?: string;

  @ApiPropertyOptional({ description: '對話類型' })
  @IsString()
  @IsOptional()
  conversation_type?: string;

  @ApiPropertyOptional({ description: '訪談者姓名' })
  @IsString()
  @IsOptional()
  interviewer_name?: string;

  @ApiPropertyOptional({ description: '背景說明' })
  @IsString()
  @IsOptional()
  background_note?: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.NORMAL })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  need_followup?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '對話日期時間' })
  @IsDateString()
  @IsOptional()
  conversation_date?: string;

  @ApiPropertyOptional({ description: '對話類型' })
  @IsString()
  @IsOptional()
  conversation_type?: string;

  @ApiPropertyOptional({ description: '訪談者姓名' })
  @IsString()
  @IsOptional()
  interviewer_name?: string;

  @ApiPropertyOptional({ description: '背景說明' })
  @IsString()
  @IsOptional()
  background_note?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  need_followup?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class SearchConversationDto {
  @ApiPropertyOptional({ description: '員工 ID' })
  @IsUUID()
  @IsOptional()
  employee_id?: string;

  @ApiPropertyOptional({ enum: IntakeStatus })
  @IsEnum(IntakeStatus)
  @IsOptional()
  status?: IntakeStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  need_followup?: boolean;

  @ApiPropertyOptional({ description: '開始日期' })
  @IsDateString()
  @IsOptional()
  date_from?: string;

  @ApiPropertyOptional({ description: '結束日期' })
  @IsDateString()
  @IsOptional()
  date_to?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  offset?: number;
}

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employee_id: string;

  @ApiProperty({ enum: IntakeSourceType })
  source_type: IntakeSourceType;

  @ApiPropertyOptional()
  conversation_date?: string;

  @ApiPropertyOptional()
  conversation_type?: string;

  @ApiPropertyOptional()
  interviewer_name?: string;

  @ApiPropertyOptional()
  background_note?: string;

  @ApiPropertyOptional()
  raw_text?: string;

  @ApiPropertyOptional()
  extracted_text?: string;

  @ApiProperty({ enum: Priority })
  priority: Priority;

  @ApiProperty()
  need_followup: boolean;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ enum: IntakeStatus })
  intake_status: IntakeStatus;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}
