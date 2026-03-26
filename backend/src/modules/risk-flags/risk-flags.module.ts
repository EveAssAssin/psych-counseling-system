import { Module } from '@nestjs/common';
import { RiskFlagsController } from './risk-flags.controller';
import { RiskFlagsService } from './risk-flags.service';

@Module({
  controllers: [RiskFlagsController],
  providers: [RiskFlagsService],
  exports: [RiskFlagsService],
})
export class RiskFlagsModule {}
