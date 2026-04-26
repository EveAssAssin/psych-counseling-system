import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupervisorNotesService } from './supervisor-notes.service';
import {
  CreateNoteDto, UpdateNoteDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupervisorDto, AddConfidentialDto,
} from './supervisor-notes.dto';

@ApiTags('supervisor-hub')
@Controller('supervisor-hub')
export class SupervisorNotesController {
  constructor(private readonly svc: SupervisorNotesService) {}

  // ── 身份驗證 ──
  @Get('auth/check')
  @ApiOperation({ summary: '確認主管是否有權限' })
  async checkAuth(@Query('identifier') identifier: string) {
    const info = await this.svc.getSupervisorInfo(identifier);
    if (!info) return { authorized: false, role: null, name: null };
    return { authorized: true, role: info.role, name: info.name };
  }

  // ── 分類 ──
  @Get('categories')
  @ApiOperation({ summary: '取得所有啟用分類' })
  getCategories() { return this.svc.getCategories(); }

  @Post('categories')
  @ApiOperation({ summary: '新增分類' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Query('supervisor_id') supervisorId?: string,
  ) { return this.svc.createCategory(dto, supervisorId); }

  @Patch('categories/:id')
  @ApiOperation({ summary: '更新分類' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '刪除分類（軟刪除）' })
  deleteCategory(@Param('id') id: string) { return this.svc.deleteCategory(id); }

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
  @ApiOperation({ summary: '取得主管名單' })
  getSupervisors() { return this.svc.getSupervisors(); }

  @Post('supervisors')
  @ApiOperation({ summary: '新增主管' })
  createSupervisor(@Body() dto: CreateSupervisorDto) { return this.svc.createSupervisor(dto); }

  @Patch('supervisors/:id')
  @ApiOperation({ summary: '更新主管資料' })
  updateSupervisor(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateSupervisor(id, dto);
  }

  @Delete('supervisors/:id')
  @ApiOperation({ summary: '停用主管' })
  deleteSupervisor(@Param('id') id: string) { return this.svc.deleteSupervisor(id); }

  // ── AI 機密名單 ──
  @Get('confidential')
  @ApiOperation({ summary: '取得 AI 機密名單' })
  getConfidentialList() { return this.svc.getConfidentialList(); }

  @Post('confidential')
  @ApiOperation({ summary: '加入 AI 機密名單' })
  addConfidential(@Body() dto: AddConfidentialDto) { return this.svc.addToConfidential(dto); }

  @Delete('confidential/:id')
  @ApiOperation({ summary: '從 AI 機密名單移除' })
  removeConfidential(@Param('id') id: string) { return this.svc.removeFromConfidential(id); }
}
