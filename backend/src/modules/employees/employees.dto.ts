import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEmail,
  IsDateString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

// ============================================
// Entity
// ============================================
export interface Employee {
  id: string;
  employeeappnumber: string;
  employeeerpid?: string;
  name: string;
  role?: string;
  title?: string;
  store_id?: string;
  store_name?: string;
  department?: string;
  email?: string;
  phone?: string;
  hire_date?: string;
  is_active: boolean;
  is_leave: boolean;
  leave_type?: string;
  leave_start_date?: string;
  leave_end_date?: string;
  source_payload?: Record<string, any>;
  source_updated_at?: string;
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// DTOs
// ============================================

export class CreateEmployeeDto {
  @ApiProperty({ description: 'APP 員工編號（主鍵）' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  employeeappnumber: string;

  @ApiPropertyOptional({ description: 'ERP 員工編號' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  employeeerpid?: string;

  @ApiProperty({ description: '姓名' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: '角色' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: '職稱' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: '門市 ID' })
  @IsUUID()
  @IsOptional()
  store_id?: string;

  @ApiPropertyOptional({ description: '門市名稱' })
  @IsString()
  @IsOptional()
  store_name?: string;

  @ApiPropertyOptional({ description: '部門' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '電話' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: '到職日' })
  @IsDateString()
  @IsOptional()
  hire_date?: string;

  @ApiPropertyOptional({ description: '是否在職', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '是否留停', default: false })
  @IsBoolean()
  @IsOptional()
  is_leave?: boolean;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'ERP 員工編號' })
  @IsString()
  @IsOptional()
  employeeerpid?: string;

  @ApiPropertyOptional({ description: '姓名' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '角色' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: '職稱' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: '門市 ID' })
  @IsUUID()
  @IsOptional()
  store_id?: string;

  @ApiPropertyOptional({ description: '門市名稱' })
  @IsString()
  @IsOptional()
  store_name?: string;

  @ApiPropertyOptional({ description: '部門' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '電話' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: '是否在職' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '是否留停' })
  @IsBoolean()
  @IsOptional()
  is_leave?: boolean;

  @ApiPropertyOptional({ description: '留停類型' })
  @IsString()
  @IsOptional()
  leave_type?: string;

  @ApiPropertyOptional({ description: '留停開始日' })
  @IsDateString()
  @IsOptional()
  leave_start_date?: string;

  @ApiPropertyOptional({ description: '留停結束日' })
  @IsDateString()
  @IsOptional()
  leave_end_date?: string;
}

export class SearchEmployeeDto {
  @ApiPropertyOptional({ description: '搜尋關鍵字（姓名、編號）' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: '門市 ID' })
  @IsUUID()
  @IsOptional()
  store_id?: string;

  @ApiPropertyOptional({ description: '部門' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ description: '是否在職' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: '每頁筆數', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: '偏移量', default: 0 })
  @IsOptional()
  offset?: number;
}

export class EmployeeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeappnumber: string;

  @ApiPropertyOptional()
  employeeerpid?: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  store_id?: string;

  @ApiPropertyOptional()
  store_name?: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  is_leave: boolean;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}

export class EmployeeListResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  data: EmployeeResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
