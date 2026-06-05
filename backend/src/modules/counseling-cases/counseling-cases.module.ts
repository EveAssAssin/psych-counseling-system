import { Module } from '@nestjs/common';
import { CounselingCasesController } from './counseling-cases.controller';
import { CounselingCasesService } from './counseling-cases.service';
import { HolidaysService } from './holidays.service';
import { CaseDraftStoreService } from './case-draft-store.service';
import { AiPlannerService } from './ai-planner.service';
import { CaseAiService } from './case-ai.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmployeeInsightModule } from '../insight/employee-insight.module';

@Module({
  imports: [SupabaseModule, EmployeeInsightModule],
  controllers: [CounselingCasesController],
  providers: [
    CounselingCasesService,
    HolidaysService,
    CaseDraftStoreService,
    AiPlannerService,
    CaseAiService,
  ],
  exports: [CounselingCasesService, HolidaysService, CaseAiService],
})
export class CounselingCasesModule {}
