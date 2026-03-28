import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmployeeInsightController } from './employee-insight.controller';
import { EmployeeInsightService } from './employee-insight.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmployeesModule } from '../employees/employees.module';
import { OfficialChannelModule } from '../official-channel/official-channel.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    EmployeesModule,
    OfficialChannelModule,
    ReviewsModule,
  ],
  controllers: [EmployeeInsightController],
  providers: [EmployeeInsightService],
  exports: [EmployeeInsightService],
})
export class EmployeeInsightModule {}
