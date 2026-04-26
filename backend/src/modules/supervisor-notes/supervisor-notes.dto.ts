import { IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── 主管身份（從 query 或 header 帶入）──
export class SupervisorIdentityDto {
  @ApiProperty() @IsString() identifier: string;
  @ApiProperty() @IsString() name: string;
}

// ── 紀錄分類 ──
export class CreateCategoryDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() sort_order?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() sort_order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_active?: boolean;
}

// ── 隨手記 ──
export class CreateNoteDto {
  @ApiProperty({ description: '主管識別碼' }) @IsString() supervisor_id: string;
  @ApiProperty({ description: '主管姓名' }) @IsString() supervisor_name: string;

  // 對象（三選一）
  @ApiPropertyOptional() @IsOptional() @IsUUID() employee_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employee_app_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() non_employee_name?: string;
  @ApiPropertyOptional() @IsOptional() non_employee_info?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_external?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category_name?: string;

  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() images?: string[];
}

export class UpdateNoteDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() category_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() images?: string[];
}

// ── 有權主管 ──
export class CreateSupervisorDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() identifier: string;
  @ApiPropertyOptional() @IsOptional() @IsString() display_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
}

// ── AI 機密名單 ──
export class AddConfidentialDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() employee_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employee_app_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employee_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() created_by?: string;
}
