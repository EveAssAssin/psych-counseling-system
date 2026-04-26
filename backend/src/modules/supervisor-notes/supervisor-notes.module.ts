import { Module } from '@nestjs/common';
import { SupervisorNotesController } from './supervisor-notes.controller';
import { SupervisorNotesService } from './supervisor-notes.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SupervisorNotesController],
  providers: [SupervisorNotesService],
  exports: [SupervisorNotesService],
})
export class SupervisorNotesModule {}
