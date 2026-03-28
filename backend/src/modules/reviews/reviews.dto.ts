import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUUID, IsEnum, IsDateString, IsArray } from 'class-validator';

// ============================================
// Enums
// ============================================
export enum ReviewSource {
  GOOGLE_MAP = 'google_map',
  FACEBOOK = 'facebook',
  PHONE = 'phone',
  APP = 'app',
  OTHER = 'other',
}

export enum ReviewType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  OTHER = 'other',
}

export enum Urgency {
  URGENT_PLUS = 'urgent_plus',  // 特急
  URGENT = 'urgent',            // 緊急
  NORMAL = 'normal',            // 普通
}

export enum ReviewStatus {
  PENDING = 'pending',
  RESPONDED = 'responded',
  CLOSED = 'closed',
}

// ============================================
// Entity
// ============================================
export interface Review {
  id: string;
  employee_id: string;
  is_proxy: boolean;
  actual_employee_id?: string;
  source: ReviewSource;
  review_type: ReviewType;
  urgency: Urgency;
  event_date?: string;
  content?: string;
  content_transcript?: string;
  requires_response: boolean;
  response_token?: string;
  response_deadline?: string;
  responded_at?: string;
  response_speed_hours?: number;
  status: ReviewStatus;
  closed_at?: string;
  closed_by?: string;
  close_note?: string;
  employee_notified: boolean;
  employee_notified_at?: string;
  manager_notified: boolean;
  manager_notified_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewAttachment {
  id: string;
  review_id: string;
  file_type: 'image' | 'video' | 'audio';
  file_name?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  transcript?: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'failed';
  uploaded_by: 'reviewer' | 'employee';
  uploaded_by_id?: string;
  created_at: string;
}

export interface ReviewResponse {
  id: string;
  review_id: string;
  employee_id: string;
  content?: string;
  responder_type: 'employee' | 'reviewer';
  responder_name?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// DTOs
// ============================================

export class CreateReviewDto {
  @ApiProperty({ description: '被指定處理的員工 ID' })
  @IsUUID()
  employee_id: string;

  @ApiPropertyOptional({ description: '是否代理處理' })
  @IsBoolean()
  @IsOptional()
  is_proxy?: boolean;

  @ApiPropertyOptional({ description: '實際被評價員工 ID（如果知道）' })
  @IsUUID()
  @IsOptional()
  actual_employee_id?: string;

  @ApiProperty({ enum: ReviewSource, description: '來源' })
  @IsEnum(ReviewSource)
  source: ReviewSource;

  @ApiProperty({ enum: ReviewType, description: '評價類型' })
  @IsEnum(ReviewType)
  review_type: ReviewType;

  @ApiPropertyOptional({ enum: Urgency, description: '緊急程度' })
  @IsEnum(Urgency)
  @IsOptional()
  urgency?: Urgency;

  @ApiPropertyOptional({ description: '事件發生日期' })
  @IsDateString()
  @IsOptional()
  event_date?: string;

  @ApiPropertyOptional({ description: '完整說明給員工' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: '是否需要回覆（僅 other 類型需指定）' })
  @IsBoolean()
  @IsOptional()
  requires_response?: boolean;

  @ApiPropertyOptional({ description: '回覆期限（小時）' })
  @IsOptional()
  response_deadline_hours?: number;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  close_note?: string;
}

export class CreateReviewResponseDto {
  @ApiProperty({ description: '回覆內容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '回覆者類型' })
  @IsOptional()
  @IsString()
  responder_type?: 'employee' | 'reviewer';

  @ApiPropertyOptional({ description: '回覆者名字' })
  @IsOptional()
  @IsString()
  responder_name?: string;
}

export class SearchReviewDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  employee_id?: string;

  @ApiPropertyOptional({ enum: ReviewType })
  @IsEnum(ReviewType)
  @IsOptional()
  review_type?: ReviewType;

  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @ApiPropertyOptional({ enum: ReviewSource })
  @IsEnum(ReviewSource)
  @IsOptional()
  source?: ReviewSource;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  offset?: number;
}

// ============================================
// Response DTOs
// ============================================

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employee_id: string;

  @ApiPropertyOptional()
  employee_name?: string;

  @ApiProperty()
  is_proxy: boolean;

  @ApiPropertyOptional()
  actual_employee_id?: string;

  @ApiProperty({ enum: ReviewSource })
  source: ReviewSource;

  @ApiProperty({ enum: ReviewType })
  review_type: ReviewType;

  @ApiProperty({ enum: Urgency })
  urgency: Urgency;

  @ApiPropertyOptional()
  event_date?: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiProperty()
  requires_response: boolean;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional()
  responded_at?: string;

  @ApiPropertyOptional()
  response_speed_hours?: number;

  @ApiProperty()
  created_at: string;

  @ApiPropertyOptional()
  attachments?: ReviewAttachment[];

  @ApiPropertyOptional()
  responses?: ReviewResponse[];
}

export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] })
  data: ReviewResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}

// 來源標籤（前端顯示用）
export const SOURCE_LABELS: Record<ReviewSource, string> = {
  [ReviewSource.GOOGLE_MAP]: 'Google MAP',
  [ReviewSource.FACEBOOK]: 'Facebook',
  [ReviewSource.PHONE]: '電話客服',
  [ReviewSource.APP]: 'APP 客服',
  [ReviewSource.OTHER]: '其他',
};

// 類型標籤
export const TYPE_LABELS: Record<ReviewType, string> = {
  [ReviewType.POSITIVE]: '正評',
  [ReviewType.NEGATIVE]: '負評',
  [ReviewType.OTHER]: '其他',
};

// 緊急程度標籤
export const URGENCY_LABELS: Record<Urgency, string> = {
  [Urgency.URGENT_PLUS]: '特急',
  [Urgency.URGENT]: '緊急',
  [Urgency.NORMAL]: '普通',
};

// 狀態標籤
export const STATUS_LABELS: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: '待處理',
  [ReviewStatus.RESPONDED]: '已回覆',
  [ReviewStatus.CLOSED]: '已結案',
};
