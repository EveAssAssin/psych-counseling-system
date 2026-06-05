import { Module } from '@nestjs/common';
import { CounselingCasesController } from './counseling-cases.controller';
import { CounselingCasesService } from './counseling-cases.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmployeeInsightModule } from '../insight/employee-insight.module';

@Module({
  imports: [SupabaseModule, EmployeeInsightModule],
  controllers: [CounselingCasesController],
  providers: [CounselingCasesService],
  exports: [CounselingCasesService],
})
export class CounselingCasesModule {}
