import { IsString, IsOptional, IsArray, IsUUID, IsInt, IsIn, IsDateString, IsNumber, ArrayNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ──────────────────────────────────────────────
//  常數定義
// ──────────────────────────────────────────────
export const CASE_STATUSES = ['planning', 'active', 'paused', 'completed', 'archived'] as const;
export type CaseStatus = typeof CASE_STATUSES[number];

export const PLAN_ITEM_STATUSES = ['pending', 'done', 'skipped', 'rescheduled'] as const;
export type PlanItemStatus = typeof PLAN_ITEM_STATUSES[number];

export const COUNSELING_METHODS = ['phone', 'face_to_face', 'line_text', 'observation', 'group', 'written'] as const;
export type CounselingMethod = typeof COUNSELING_METHODS[number];


// ──────────────────────────────────────────────
//  輔導案 — 建立 / 更新
// ──────────────────────────────────────────────
export class CreateCaseDraftDto {
  @ApiProperty({ description: '目標員工 app_number' })
  @IsString() employee_app_number: string;

  @ApiProperty({ description: '建案輔導員 ID（authorized_supervisors.id）' })
  @IsUUID() supervisor_id: string;

  @ApiProperty({ description: '狀態標籤 code 陣列', type: [String] })
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  state_tag_codes: string[];

  @ApiPropertyOptional({ description: '狀態自由文字補充' })
  @IsOptional() @IsString() state_description?: string;

  @ApiProperty({ description: '輔導目標' })
  @IsString() goal: string;

  @ApiProperty({ description: '開始日期 YYYY-MM-DD' })
  @IsDateString() start_date: string;

  @ApiProperty({ description: '預計結束日期 YYYY-MM-DD' })
  @IsDateString() target_end_date: string;

  @ApiProperty({ description: '可用方法陣列', type: [String] })
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  allowed_methods: string[];
}

export class ConfirmCaseDto {
  @ApiProperty({ description: '草稿時拿到的 draftToken（暫存 key）' })
  @IsString() draft_token: string;

  @ApiPropertyOptional({ description: '輔導員調整後的 plan_items（覆蓋 AI 草稿）' })
  @IsOptional() @IsArray()
  adjusted_plan_items?: AdjustedPlanItemDto[];

  @ApiPropertyOptional({ description: '輔導員調整後的整體計畫摘要' })
  @IsOptional() @IsString() adjusted_summary?: string;
}

export class AdjustedPlanItemDto {
  @ApiProperty() @IsDateString() scheduled_date: string;
  @ApiProperty() @IsInt() sequence: number;
  @ApiProperty() @IsString() method: string;
  @ApiProperty() @IsString() objective: string;
  @ApiPropertyOptional() @IsOptional() recommended_actions?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsInt() estimated_minutes?: number;
}

export class UpdateCaseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() goal?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state_description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() target_end_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) allowed_methods?: string[];
  @ApiPropertyOptional() @IsOptional() @IsIn(CASE_STATUSES as any) status?: CaseStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() closing_summary?: string;
}


// ──────────────────────────────────────────────
//  排程節點 — 更新（改期、跳過）
// ──────────────────────────────────────────────
export class UpdatePlanItemDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduled_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() recommended_actions?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsInt() estimated_minutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(PLAN_ITEM_STATUSES as any) status?: PlanItemStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() reschedule_reason?: string;
}


// ──────────────────────────────────────────────
//  執行紀錄
// ──────────────────────────────────────────────
export class CreateExecutionDto {
  @ApiPropertyOptional({ description: '對應的 plan_item_id；無對應排程可不填' })
  @IsOptional() @IsUUID() plan_item_id?: string;

  @ApiProperty() @IsString() actual_method: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() duration_minutes?: number;

  @ApiProperty({ description: '經過描述' }) @IsString() what_happened: string;

  @ApiPropertyOptional() @IsOptional() @IsString() employee_reaction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() next_action_hint?: string;

  @ApiPropertyOptional({ description: '員工當下情緒 1-5' })
  @IsOptional() @IsInt() @Min(1) @Max(5) mood_score?: number;

  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: any[];

  @ApiProperty() @IsUUID() recorded_by: string;
  @ApiProperty() @IsString() recorded_by_name: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() executed_at?: string;
}


// ──────────────────────────────────────────────
//  狀態標籤管理（後台）
// ──────────────────────────────────────────────
export class UpsertStateTagDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ai_prompt_hint?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['low', 'moderate', 'high', 'critical']) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() default_duration_days?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() sort_order?: number;
}


// ──────────────────────────────────────────────
//  假日管理（後台）
// ──────────────────────────────────────────────
export class UpsertHolidayDto {
  @ApiProperty() @IsDateString() date: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['national', 'company', 'makeup_workday']) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}


// ──────────────────────────────────────────────
//  Query DTOs
// ──────────────────────────────────────────────
export class TodayTasksQueryDto {
  @ApiPropertyOptional({ description: '指定日期，預設今日 YYYY-MM-DD' })
  @IsOptional() @IsDateString() date?: string;

  @ApiPropertyOptional({ description: '指定輔導員，預設不限' })
  @IsOptional() @IsUUID() supervisor_id?: string;
}

export class ListCasesQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisor_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employee_app_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state_tag_code?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() offset?: number;
}
