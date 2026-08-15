import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LearningProgressService } from './learning-progress.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, LearningProgressService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
