import { Module } from '@nestjs/common';
import { SupervisorAiController } from './supervisor-ai.controller';
import { SupervisorAiService } from './supervisor-ai.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupervisorNotesModule } from '../supervisor-notes/supervisor-notes.module';
import { SyncModule } from '../sync/sync.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [SupabaseModule, SupervisorNotesModule, SyncModule, ConversationsModule],
  controllers: [SupervisorAiController],
  providers: [SupervisorAiService],
})
export class SupervisorAiModule {}
