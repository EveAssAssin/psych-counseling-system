import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsInt, Min, Max } from 'class-validator';

export class GenerateAiSuggestionDto {
  @IsString() thread_id: string;
  @IsString() original_message: string;
  @IsOptional() @IsString() employee_app_number?: string;
  @IsOptional() @IsString() employee_name?: string;
}

export class SendReplyDto {
  @IsString() thread_id: string;
  @IsString() final_reply: string;
  @IsOptional() @IsString() original_message?: string;
  @IsOptional() @IsString() ai_suggestion?: string;
  @IsOptional() @IsString() employee_app_number?: string;
  @IsOptional() @IsString() employee_name?: string;
  @IsOptional() @IsString() sent_by?: string;
  @IsOptional() @IsString() sent_by_name?: string;
  @IsOptional() @IsBoolean() is_auto_reply?: boolean;
}

export class SaveDraftDto {
  @IsString() thread_id: string;
  @IsString() final_reply: string;
  @IsOptional() @IsString() original_message?: string;
  @IsOptional() @IsString() ai_suggestion?: string;
  @IsOptional() @IsString() employee_app_number?: string;
  @IsOptional() @IsString() employee_name?: string;
  @IsOptional() @IsString() sent_by?: string;
  @IsOptional() @IsString() sent_by_name?: string;
}

export class CreateGuidelineDto {
  @IsString() title: string;
  @IsOptional() @IsString() category?: string;
  @IsString() content: string;
  @IsOptional() @IsNumber() sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateGuidelineDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsNumber() sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateAutoReplySettingsDto {
  @IsOptional() @IsBoolean() is_enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(23) start_hour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) end_hour?: number;
  @IsOptional() @IsArray() days_of_week?: number[];
  @IsOptional() @IsString() ai_persona?: string;
  @IsOptional() @IsInt() @Min(0) delay_seconds?: number;
  @IsOptional() @IsString() updated_by?: string;
}
