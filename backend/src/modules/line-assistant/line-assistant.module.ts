import { Module } from '@nestjs/common';
import { LineAssistantController } from './line-assistant.controller';
import { LineAssistantService } from './line-assistant.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [SupabaseModule, ConversationsModule, EmployeesModule],
  controllers: [LineAssistantController],
  providers: [LineAssistantService],
  exports: [LineAssistantService],
})
export class LineAssistantModule {}
