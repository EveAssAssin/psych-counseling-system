import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PeriodAnalysisController } from './period-analysis.controller';
import { PeriodAnalysisService } from './period-analysis.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [PeriodAnalysisController],
  providers: [PeriodAnalysisService],
})
export class PeriodAnalysisModule {}
