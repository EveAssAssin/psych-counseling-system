import { Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmployeeSyncService } from './employee-sync.service';

@ApiTags('employee-sync')
@Controller('employee-sync')
export class EmployeeSyncController {
  constructor(private readonly syncService: EmployeeSyncService) {}

  @Post('stores')
  @ApiOperation({ summary: '同步門市員工' })
  async syncStores() {
    const result = await this.syncService.syncStoreEmployees();
    return { success: true, data: result };
  }

  @Post('backend')
  @ApiOperation({ summary: '同步後勤人員' })
  async syncBackend() {
    const result = await this.syncService.syncBackendEmployees();
    return { success: true, data: result };
  }

  @Post('all')
  @ApiOperation({ summary: '完整同步（門市+後勤）' })
  async syncAll() {
    const result = await this.syncService.syncAll();
    return { success: true, data: result };
  }

  @Get('stats')
  @ApiOperation({ summary: '取得同步統計' })
  async getStats() {
    const stats = await this.syncService.getStats();
    return { success: true, data: stats };
  }
}
