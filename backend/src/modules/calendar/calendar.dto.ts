import { IsString, IsOptional, IsInt, IsIn, IsDateString, Matches, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ──────────────────────────────────────────────
//  常數定義（與前端 CalendarPage 保持一致）
// ──────────────────────────────────────────────
export const CATEGORY_KEYS = ['routine', 'announce', 'project', 'newcomer', 'urgent'] as const;
export type CategoryKey = typeof CATEGORY_KEYS[number];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  routine: '例行性關懷',
  announce: '流程佈達',
  project: '專案焦點',
  newcomer: '新人輔導',
  urgent: '緊急案件',
};

export const DURATION_OPTIONS = [5, 10, 15, 30, 60] as const;

export const SCHEDULE_STATUSES = ['pending', 'completed', 'cancelled', 'no_show', 'follow_up'] as const;
export type ScheduleStatus = typeof SCHEDULE_STATUSES[number];

export const STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: '待進行',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '未執行',
  follow_up: '需後續追蹤',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ──────────────────────────────────────────────
//  排程 — 建立
// ──────────────────────────────────────────────
export class CreateScheduleDto {
  @ApiProperty({ description: '排程日期 YYYY-MM-DD' })
  @IsDateString() schedule_date: string;

  @ApiProperty({ description: '開始時間 HH:mm' })
  @Matches(HHMM, { message: 'start_time 必須為 HH:mm' }) start_time: string;

  @ApiProperty({ description: '談話時長（分鐘）', enum: DURATION_OPTIONS })
  @IsInt() @IsIn(DURATION_OPTIONS as any) duration_minutes: number;

  @ApiProperty({ description: '員工 app_number' })
  @IsString() employee_app_number: string;

  @ApiProperty({ description: '大分類 key', enum: CATEGORY_KEYS })
  @IsIn(CATEGORY_KEYS as any) category_key: CategoryKey;

  @ApiProperty({ description: '小分類名稱' })
  @IsString() @MaxLength(20) subcategory_name: string;

  @ApiPropertyOptional({ description: '小分類 id（既有項目時帶）' })
  @IsOptional() @IsString() subcategory_id?: string;

  @ApiProperty({ description: '談話主題 / 備註' })
  @IsString() @MaxLength(500) note: string;

  @ApiPropertyOptional({ description: '建立人顯示名' })
  @IsOptional() @IsString() created_by?: string;

  @ApiPropertyOptional({ description: '建立人識別（app_number 或 supervisor id）' })
  @IsOptional() @IsString() created_by_id?: string;
}

// ──────────────────────────────────────────────
//  排程 — 更新
// ──────────────────────────────────────────────
export class UpdateScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() schedule_date?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(HHMM) start_time?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @IsIn(DURATION_OPTIONS as any) duration_minutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() employee_app_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(CATEGORY_KEYS as any) category_key?: CategoryKey;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) subcategory_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subcategory_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SCHEDULE_STATUSES as any) status?: ScheduleStatus;
  @ApiPropertyOptional({ description: '實際談話用時（分鐘），可傳 null 清除' })
  @IsOptional() @IsInt() @Min(0) actual_minutes?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() updated_by?: string;
}

// ──────────────────────────────────────────────
//  排程 — 取消
// ──────────────────────────────────────────────
export class CancelScheduleDto {
  @ApiProperty({ description: '取消原因' })
  @IsString() cancel_reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() updated_by?: string;
}

// ──────────────────────────────────────────────
//  小分類 — 建立
// ──────────────────────────────────────────────
export class CreateSubcategoryDto {
  @ApiProperty({ enum: CATEGORY_KEYS })
  @IsIn(CATEGORY_KEYS as any) category_key: CategoryKey;

  @ApiProperty({ description: '小分類名稱（上限 20 字）' })
  @IsString() @MaxLength(20) name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() created_by?: string;
}

// ──────────────────────────────────────────────
//  週查詢
// ──────────────────────────────────────────────
export class ListSchedulesQueryDto {
  @ApiProperty({ description: '起 YYYY-MM-DD' })
  @IsDateString() start_date: string;
  @ApiProperty({ description: '迄 YYYY-MM-DD' })
  @IsDateString() end_date: string;
  @ApiPropertyOptional({ description: '篩選建立人識別' })
  @IsOptional() @IsString() created_by_id?: string;
  @ApiPropertyOptional({ description: '是否含已取消，預設 false' })
  @IsOptional() @IsString() include_cancelled?: string;
}
