import { IsString, IsOptional, IsDateString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ACHIEVEMENT_CATEGORIES = ['表揚', '懲處', '事件', '貢獻'] as const;

export class CreateAchievementDto {
  @ApiProperty({ description: '員工 id' })
  @IsUUID() employee_id: string;

  @ApiProperty({ description: '標題' })
  @IsString() @MaxLength(200) title: string;

  @ApiProperty({ description: '內容' })
  @IsString() content: string;

  @ApiProperty({ description: '事蹟日期 YYYY-MM-DD' })
  @IsDateString() record_date: string;

  @ApiPropertyOptional({ description: '分類：表揚/懲處/事件/貢獻' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ description: '建立人' })
  @IsOptional() @IsString() created_by?: string;
}

export class UpdateAchievementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() record_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() updated_by?: string;
}
