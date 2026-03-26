import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { LefthandApiService } from './lefthand-api.service';
import { EmployeesModule } from '../employees/employees.module';
import { StoresModule } from '../stores/stores.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    EmployeesModule,
    StoresModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, LefthandApiService],
  exports: [SyncService, LefthandApiService],
})
export class SyncModule {}
