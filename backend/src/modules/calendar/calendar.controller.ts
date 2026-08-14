import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import {
  CreateScheduleDto, UpdateScheduleDto, CancelScheduleDto,
  CreateSubcategoryDto, RenameSubcategoryDto, ListSchedulesQueryDto,
  OverdueHandleDto, MonitorPhotoDto,
  CATEGORY_KEYS, CATEGORY_LABELS, STATUS_LABELS, DURATION_OPTIONS,
} from './calendar.dto';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly svc: CalendarService) {}

  // ── 分類 / 常數（給前端下拉用）──
  @Get('meta')
  @ApiOperation({ summary: '取得行事曆常數：大分類、狀態、時長選項' })
  getMeta() {
    return {
      categories: CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_LABELS[k] })),
      statuses: Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label })),
      durations: DURATION_OPTIONS,
      work_hours: { start: '11:00', end: '21:00' },
    };
  }

  // ── 排休 / 出勤檢查 ──
  @Get('attendance/:appNumber')
  @ApiOperation({ summary: '查某員工某日排班狀態（work / off / unknown）' })
  checkAttendance(@Param('appNumber') appNumber: string, @Query('date') date: string) {
    return this.svc.checkAttendance(appNumber, date);
  }

  // ── 小分類 ──
  @Get('subcategories')
  @ApiOperation({ summary: '列出小分類（可依大分類過濾）' })
  listSubcategories(@Query('category_key') categoryKey?: string) {
    return this.svc.listSubcategories(categoryKey);
  }

  @Post('subcategories')
  @ApiOperation({ summary: '新增自訂小分類' })
  createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.svc.createSubcategory(dto);
  }

  @Patch('subcategories/:id')
  @ApiOperation({ summary: '修改小分類名稱' })
  renameSubcategory(@Param('id') id: string, @Body() dto: RenameSubcategoryDto) {
    return this.svc.renameSubcategory(id, dto.name);
  }

  @Delete('subcategories/:id')
  @ApiOperation({ summary: '停用小分類（不實體刪除）' })
  deactivateSubcategory(@Param('id') id: string) {
    return this.svc.deactivateSubcategory(id);
  }

  // ── 排程 ──
  @Get('schedules')
  @ApiOperation({ summary: '查詢區間內排程（週檢視）' })
  listSchedules(@Query() q: ListSchedulesQueryDto) {
    return this.svc.listSchedules(q);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: '排程詳情' })
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Post('schedules')
  @ApiOperation({ summary: '建立排程（含排休 + 衝突檢查）' })
  create(@Body() dto: CreateScheduleDto) {
    return this.svc.create(dto);
  }

  @Patch('schedules/:id')
  @ApiOperation({ summary: '編輯排程（改期/換人會重新檢查）' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.svc.update(id, dto);
  }

  @Post('schedules/:id/cancel')
  @ApiOperation({ summary: '取消排程（保留紀錄）' })
  cancel(@Param('id') id: string, @Body() dto: CancelScheduleDto) {
    return this.svc.cancel(id, dto);
  }

  @Post('schedules/:id/mark-rescheduled')
  @ApiOperation({ summary: '標記逾期排程為已重新安排' })
  markRescheduled(@Param('id') id: string, @Body() body: { rescheduled_to_id?: string }) {
    return this.svc.markRescheduled(id, body?.rescheduled_to_id);
  }

  // ── 逾期處理 ──
  @Post('schedules/:id/overdue-handle')
  @ApiOperation({ summary: '逾期處理：填原因+設定下次時間→建立新排程、保留原始' })
  handleOverdue(@Param('id') id: string, @Body() dto: OverdueHandleDto) {
    return this.svc.handleOverdue(id, dto);
  }

  @Get('schedules/:id/reschedules')
  @ApiOperation({ summary: '排程的改期歷史' })
  listReschedules(@Param('id') id: string) {
    return this.svc.listReschedules(id);
  }

  // ── 監控證明照片 ──
  @Get('schedules/:id/photos')
  @ApiOperation({ summary: '列出監控證明照片' })
  listPhotos(@Param('id') id: string) {
    return this.svc.listMonitorPhotos(id);
  }

  @Post('schedules/:id/photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: '上傳監控證明照片（支援手機拍照）' })
  addPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: MonitorPhotoDto,
  ) {
    return this.svc.addMonitorPhoto(id, file, dto);
  }

  @Delete('photos/:photoId')
  @ApiOperation({ summary: '刪除監控證明（已完成/已結案不可刪）' })
  deletePhoto(@Param('photoId') photoId: string) {
    return this.svc.deleteMonitorPhoto(photoId);
  }
}
