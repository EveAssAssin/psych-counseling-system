import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ExtractionService } from './extraction.service';

@Module({
  imports: [
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
  providers: [ConversationsService, ExtractionService],
  exports: [ConversationsService, ExtractionService],
})
export class ConversationsModule {}
