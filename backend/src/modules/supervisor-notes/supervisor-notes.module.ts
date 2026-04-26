import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SupervisorNotesController } from './supervisor-notes.controller';
import { SupervisorNotesService } from './supervisor-notes.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    SupabaseModule,
    UploadModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  ],
  controllers: [SupervisorNotesController],
  providers: [SupervisorNotesService],
  exports: [SupervisorNotesService],
})
export class SupervisorNotesModule {}
