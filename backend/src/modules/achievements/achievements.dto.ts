import { IsString, IsOptional, IsDateString, IsUUID, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 大分類
export const RECORD_TYPES = ['事實', '感受'] as const;
// 事實的固定子標籤
export const FACT_CATEGORIES = ['表揚', '懲處', '事件', '貢獻', '爭議'] as const;

export class CreateAchievementDto {
  @ApiProperty({ description: '員工 id' })
  @IsUUID() employee_id: string;

  @ApiProperty({ description: '大分類：事實 / 感受', enum: RECORD_TYPES })
  @IsIn(RECORD_TYPES as any) record_type: string;

  @ApiProperty({ description: '標題' })
  @IsString() @MaxLength(200) title: string;

  @ApiProperty({ description: '內容（事實需含數據）' })
  @IsString() content: string;

  @ApiProperty({ description: '事蹟日期 YYYY-MM-DD' })
  @IsDateString() record_date: string;

  @ApiPropertyOptional({ description: '子標籤（事實:表揚/懲處/事件/貢獻/爭議；感受:自訂標籤）' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ description: '建立人' })
  @IsOptional() @IsString() created_by?: string;
}

export class UpdateAchievementDto {
  @ApiPropertyOptional({ enum: RECORD_TYPES }) @IsOptional() @IsIn(RECORD_TYPES as any) record_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() record_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() updated_by?: string;
}

export class CreateFeelingTagDto {
  @ApiProperty({ description: '感受標籤名稱' })
  @IsString() @MaxLength(20) name: string;
}
