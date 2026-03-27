import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Config
import { configuration } from './config/configuration';

// Core modules
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';

// Feature modules
import { EmployeesModule } from './modules/employees/employees.module';
import { StoresModule } from './modules/stores/stores.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { RiskFlagsModule } from './modules/risk-flags/risk-flags.module';
import { SyncModule } from './modules/sync/sync.module';
import { QueryModule } from './modules/query/query.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { OfficialChannelModule } from './modules/official-channel/official-channel.module';

// Health check
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Core
    SupabaseModule,
    AuthModule,

    // Features
    EmployeesModule,
    StoresModule,
    ConversationsModule,
    AnalysisModule,
    RiskFlagsModule,
    SyncModule,
    QueryModule,
    SchedulerModule,
    OfficialChannelModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
