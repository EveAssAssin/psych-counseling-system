import { Module } from '@nestjs/common';
import { SupervisorAiController } from './supervisor-ai.controller';
import { SupervisorAiService } from './supervisor-ai.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupervisorNotesModule } from '../supervisor-notes/supervisor-notes.module';

@Module({
  imports: [SupabaseModule, SupervisorNotesModule],
  controllers: [SupervisorAiController],
  providers: [SupervisorAiService],
})
export class SupervisorAiModule {}
