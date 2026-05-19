import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ExtractionService } from './extraction.service';
import { EmployeeContextService } from './employee-context.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import { SmartFillService } from './smart-fill.service';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    EmployeesModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.get<number>('upload.maxFileSize'),
        },
      }),
    }),
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    ExtractionService,
    EmployeeContextService,
    AudioTranscriptionService,
    SmartFillService,
  ],
  exports: [
    ConversationsService,
    ExtractionService,
    EmployeeContextService,
    AudioTranscriptionService,
    SmartFillService,
  ],
})
export class ConversationsModule {}
