import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { EmployeesModule } from '../employees/employees.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [EmployeesModule, AnalysisModule],
  controllers: [QueryController],
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
