import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto, UpdateAchievementDto, CreateFeelingTagDto } from './achievements.dto';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly svc: AchievementsService) {}

  // ── 感受標籤字典 ──
  @Get('feeling-tags')
  @ApiOperation({ summary: '列出感受自訂標籤' })
  listFeelingTags() {
    return this.svc.listFeelingTags();
  }

  @Post('feeling-tags')
  @ApiOperation({ summary: '新增感受自訂標籤（可重用）' })
  createFeelingTag(@Body() dto: CreateFeelingTagDto) {
    return this.svc.createFeelingTag(dto.name);
  }

  @Get()
  @ApiOperation({ summary: '列出某員工的事蹟紀錄' })
  @ApiQuery({ name: 'employee_id', required: true })
  list(@Query('employee_id') employeeId: string) {
    return this.svc.listByEmployee(employeeId);
  }

  @Post()
  @ApiOperation({ summary: '新增事蹟紀錄' })
  create(@Body() dto: CreateAchievementDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '編輯事蹟紀錄' })
  update(@Param('id') id: string, @Body() dto: UpdateAchievementDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '刪除事蹟紀錄' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
