import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, IsEnum } from 'class-validator';

// ============================================
// Enums
// ============================================
export enum StressLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ============================================
// Entity
// ============================================
export interface AnalysisResult {
  id: string;
  conversation_intake_id: string;
  employee_id: string;

  // 核心分析結果
  current_psychological_state?: string;
  stress_level?: StressLevel;
  risk_level?: RiskLevel;
  summary?: string;

  // JSON 結構化資料
  key_topics: string[];
  observations: string[];
  suggested_actions: string[];
  taboo_topics: string[];
  interviewer_question_suggestions: string[];

  // 後續追蹤
  followup_needed: boolean;
  followup_suggested_at?: string;
  supervisor_involvement?: string;
  next_talk_focus?: string;

  // 分析元資料
  model_name?: string;
  model_version?: string;
  analysis_prompt_version?: string;
  raw_response?: Record<string, any>;
  confidence_score?: number;

  created_at: string;
  updated_at: string;
}

// ============================================
// AI 分析輸出 Schema
// ============================================
export interface AIAnalysisOutput {
  current_psychological_state: string;
  stress_level: StressLevel;
  risk_level: RiskLevel;
  summary: string;
  key_topics: string[];
  observations: string[];
  suggested_actions: string[];
  taboo_topics: string[];
  interviewer_question_suggestions: string[];
  followup_needed: boolean;
  followup_suggested_days?: number;
  supervisor_involvement: string;
  next_talk_focus: string;
  confidence_score: number;
  risk_flags?: {
    type: string;
    severity: RiskLevel;
    title: string;
    description: string;
    evidence: string;
  }[];
}

// ============================================
// DTOs
// ============================================

export class RunAnalysisDto {
  @ApiProperty({ description: '對話 ID' })
  @IsUUID()
  conversation_intake_id: string;

  @ApiPropertyOptional({ description: '是否強制重新分析' })
  @IsOptional()
  force?: boolean;
}

export class AnalysisResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversation_intake_id: string;

  @ApiProperty()
  employee_id: string;

  @ApiPropertyOptional()
  current_psychological_state?: string;

  @ApiPropertyOptional({ enum: StressLevel })
  stress_level?: StressLevel;

  @ApiPropertyOptional({ enum: RiskLevel })
  risk_level?: RiskLevel;

  @ApiPropertyOptional()
  summary?: string;

  @ApiProperty({ type: [String] })
  key_topics: string[];

  @ApiProperty({ type: [String] })
  observations: string[];

  @ApiProperty({ type: [String] })
  suggested_actions: string[];

  @ApiProperty({ type: [String] })
  taboo_topics: string[];

  @ApiProperty({ type: [String] })
  interviewer_question_suggestions: string[];

  @ApiProperty()
  followup_needed: boolean;

  @ApiPropertyOptional()
  followup_suggested_at?: string;

  @ApiPropertyOptional()
  supervisor_involvement?: string;

  @ApiPropertyOptional()
  next_talk_focus?: string;

  @ApiProperty()
  created_at: string;
}

export class SearchAnalysisDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  employee_id?: string;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsEnum(RiskLevel)
  @IsOptional()
  risk_level?: RiskLevel;

  @ApiPropertyOptional({ enum: StressLevel })
  @IsEnum(StressLevel)
  @IsOptional()
  stress_level?: StressLevel;

  @ApiPropertyOptional()
  @IsOptional()
  followup_needed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  offset?: number;
}
