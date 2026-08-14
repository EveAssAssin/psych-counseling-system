import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SyncModule } from '../sync/sync.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [SupabaseModule, SyncModule, UploadModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
