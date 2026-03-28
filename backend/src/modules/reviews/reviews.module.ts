import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewsController, ReviewResponseController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    EmployeesModule,
  ],
  controllers: [ReviewsController, ReviewResponseController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
