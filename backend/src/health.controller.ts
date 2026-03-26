import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '健康檢查' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'psych-counseling-backend',
      version: '2.0.0',
    };
  }
}
