import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SupervisorNotesService } from './supervisor-notes.service';
import { UploadService } from '../upload/upload.service';
import {
  CreateNoteDto, UpdateNoteDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupervisorDto, AddConfidentialDto,
  CreateReviewRecordDto, UpdateReviewRecordDto,
} from './supervisor-notes.dto';

@ApiTags('supervisor-hub')
@Controller('supervisor-hub')
export class SupervisorNotesController {
  constructor(
    private readonly svc: SupervisorNotesService,
    private readonly uploadSvc: UploadService,
  ) {}

  // ── 身份驗證 ──
  @Get('auth/check')
  @ApiOperation({ summary: '確認主管是否有權限' })
  async checkAuth(
    @Query('identifier') identifier: string,
    @Query('password') password?: string,
  ) {
    if (password) {
      const result = await this.svc.verifyLogin(identifier, password);
      if (!result.success) return { authorized: false, role: null, name: null };
      return { authorized: true, role: result.info!.role, name: result.info!.name };
    }
    const info = await this.svc.getSupervisorInfo(identifier);
    if (!info) return { authorized: false, role: null, name: null };
    return { authorized: true, role: info.role, name: info.name };
  }

  @Post('auth/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '主管修改自己的密碼（需驗證舊密碼）' })
  changeOwnPassword(
    @Body() body: { identifier: string; currentPassword: string; newPassword: string },
  ) {
    return this.svc.changeOwnPassword(body.identifier, body.currentPassword, body.newPassword);
  }

  // ── 分類 ──
  @Get('categories')
  @ApiOperation({ summary: '取得分類（全域+個人）' })
  getCategories(@Query('supervisor_id') supervisorId?: string) {
    return this.svc.getCategories(supervisorId);
  }

  @Post('categories')
  @ApiOperation({ summary: '新增分類' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Query('supervisor_id') supervisorId?: string,
  ) { return this.svc.createCategory(dto, supervisorId, supervisorId); }

  @Patch('categories/order')
  @ApiOperation({ summary: '更新主管分類排序' })
  updateCategoryOrder(
    @Body() body: { supervisor_id: string; ordered_ids: string[] },
  ) { return this.svc.updateCategoryOrder(body.supervisor_id, body.ordered_ids); }

  @Patch('categories/:id')
  @ApiOperation({ summary: '更新分類' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '刪除分類（軟刪除）' })
  deleteCategory(@Param('id') id: string) { return this.svc.deleteCategory(id); }

  // ── 附件上傳 ──
  @Post('upload')
  @ApiOperation({ summary: '上傳附件（圖片/影片/文件）' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadAttachments(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) return { attachments: [] };
    const results = await Promise.all(
      files.map(f => this.uploadSvc.uploadFile(f, 'reviews', 'supervisor-notes'))
    );
    const attachments = results
      .filter(r => r.success)
      .map(r => ({
        url: r.url,
        originalName: r.fileName,
        type: r.mimeType,
        size: r.fileSize,
      }));
    return { attachments };
  }

  // ── 隨手記 ──
  @Post('notes')
  @ApiOperation({ summary: '建立新隨手記' })
  createNote(@Body() dto: CreateNoteDto) { return this.svc.createNote(dto); }

  @Get('notes')
  @ApiOperation({ summary: '查詢隨手記列表（分頁）' })
  getNotes(
    @Query('supervisor_id')       supervisorId?: string,
    @Query('employee_id')          employeeId?: string,
    @Query('employee_app_number')  appNumber?: string,
    @Query('search')               search?: string,
    @Query('category_id')          categoryId?: string,
    @Query('page')                 page?: number,
    @Query('limit')                limit?: number,
  ) {
    return this.svc.getNotes({ supervisor_id: supervisorId, employee_id: employeeId, employee_app_number: appNumber, search, category_id: categoryId, page, limit });
  }

  @Get('notes/:id')
  @ApiOperation({ summary: '取得單筆隨手記' })
  getNoteById(@Param('id') id: string) { return this.svc.getNoteById(id); }

  @Patch('notes/:id')
  @ApiOperation({ summary: '更新隨手記' })
  updateNote(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @Query('supervisor_id') supervisorId: string,
  ) { return this.svc.updateNote(id, supervisorId, dto); }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除隨手記（軟刪除）' })
  deleteNote(
    @Param('id') id: string,
    @Query('supervisor_id') supervisorId: string,
  ) { return this.svc.deleteNote(id, supervisorId); }

  // ── 人員搜尋 ──
  @Get('employees/search')
  @ApiOperation({ summary: '快搜人員' })
  searchEmployees(
    @Query('q') keyword?: string,
    @Query('store_id') storeId?: string,
  ) { return this.svc.searchEmployees(keyword || '', storeId); }

  @Get('stores')
  @ApiOperation({ summary: '取得店家清單' })
  getStores() { return this.svc.getStores(); }

  // ── 有權主管管理 ──
  @Get('supervisors')
  getSupervisors() { return this.svc.getSupervisors(); }

  @Post('supervisors')
  createSupervisor(@Body() dto: CreateSupervisorDto) { return this.svc.createSupervisor(dto); }

  @Patch('supervisors/:id')
  updateSupervisor(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateSupervisor(id, dto);
  }

  @Delete('supervisors/:id')
  deleteSupervisor(@Param('id') id: string) { return this.svc.deleteSupervisor(id); }

  @Patch('supervisors/:id/password')
  setPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.svc.setPassword(id, body.password);
  }

  // ── 人評會記錄 ──
  @Get('review-records')
  @ApiOperation({ summary: '查詢人評會記錄' })
  getReviewRecords(
    @Query('employee_app_number') employeeAppNumber?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getReviewRecords({ employee_app_number: employeeAppNumber, search, page, limit });
  }

  @Post('review-records')
  @ApiOperation({ summary: '建立人評會記錄' })
  createReviewRecord(@Body() dto: CreateReviewRecordDto) {
    return this.svc.createReviewRecord(dto);
  }

  @Patch('review-records/:id')
  @ApiOperation({ summary: '更新人評會記錄' })
  updateReviewRecord(
    @Param('id') id: string,
    @Body() dto: UpdateReviewRecordDto,
    @Query('supervisor_id') supervisorId: string,
  ) {
    return this.svc.updateReviewRecord(id, supervisorId, dto);
  }

  @Delete('review-records/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除人評會記錄（軟刪除）' })
  deleteReviewRecord(
    @Param('id') id: string,
    @Query('supervisor_id') supervisorId: string,
  ) {
    return this.svc.deleteReviewRecord(id, supervisorId);
  }

  // ── AI 機密名單 ──
  @Get('confidential')
  getConfidentialList() { return this.svc.getConfidentialList(); }

  @Post('confidential')
  addConfidential(@Body() dto: AddConfidentialDto) { return this.svc.addToConfidential(dto); }

  @Delete('confidential/:id')
  removeConfidential(@Param('id') id: string) { return this.svc.removeFromConfidential(id); }
}
