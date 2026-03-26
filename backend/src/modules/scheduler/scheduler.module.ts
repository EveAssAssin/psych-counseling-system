import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SyncModule } from '../sync/sync.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [SyncModule, ConversationsModule, AnalysisModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
