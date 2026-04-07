import { Module } from '@nestjs/common';
import { TicketHistoryController } from './ticket-history.controller';
import { TicketHistoryService } from './ticket-history.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TicketHistoryController],
  providers: [TicketHistoryService],
  exports: [TicketHistoryService],
})
export class TicketHistoryModule {}
