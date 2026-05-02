import { Module } from '@nestjs/common';
import { LineAssistantController } from './line-assistant.controller';
import { LineAssistantService } from './line-assistant.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [LineAssistantController],
  providers: [LineAssistantService],
  exports: [LineAssistantService],
})
export class LineAssistantModule {}
