import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SyncModule } from '../sync/sync.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { EmployeeSyncModule } from '../employee-sync/employee-sync.module';

@Module({
  imports: [SyncModule, ConversationsModule, AnalysisModule, EmployeeSyncModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
