import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  SearchEmployeeDto,
  EmployeeResponseDto,
  EmployeeListResponseDto,
} from './employees.dto';

@ApiTags('employees')
@Controller('employees')
// @ApiBearerAuth() // 暫時註解，待 Auth 模組完成後啟用
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: '建立員工' })
  @ApiResponse({ status: 201, description: '建立成功', type: EmployeeResponseDto })
  async create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '搜尋員工' })
  @ApiResponse({ status: 200, description: '搜尋結果', type: EmployeeListResponseDto })
  @ApiQuery({ name: 'q', required: false, description: '搜尋關鍵字' })
  @ApiQuery({ name: 'store_id', required: false, description: '門市 ID' })
  @ApiQuery({ name: 'department', required: false, description: '部門' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: '是否在職' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每頁筆數' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: '偏移量' })
  async search(@Query() dto: SearchEmployeeDto) {
    return this.employeesService.search(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: '取得員工統計' })
  @ApiResponse({ status: 200, description: '統計資料' })
  async getStats() {
    return this.employeesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一員工' })
  @ApiParam({ name: 'id', description: '員工 ID' })
  @ApiResponse({ status: 200, description: '員工資料', type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: '員工不存在' })
  async findOne(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Get('by-appnumber/:appnumber')
  @ApiOperation({ summary: '以 APP 編號取得員工' })
  @ApiParam({ name: 'appnumber', description: 'APP 員工編號' })
  @ApiResponse({ status: 200, description: '員工資料', type: EmployeeResponseDto })
  async findByAppNumber(@Param('appnumber') appnumber: string) {
    const employee = await this.employeesService.findByAppNumber(appnumber);
    if (!employee) {
      return { found: false, message: `Employee not found: ${appnumber}` };
    }
    return employee;
  }

  @Put(':id')
  @ApiOperation({ summary: '更新員工' })
  @ApiParam({ name: 'id', description: '員工 ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: EmployeeResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '刪除員工（軟刪除）' })
  @ApiParam({ name: 'id', description: '員工 ID' })
  @ApiResponse({ status: 204, description: '刪除成功' })
  async delete(@Param('id') id: string) {
    await this.employeesService.softDelete(id);
  }

  @Post('identify')
  @ApiOperation({ summary: '對人識別' })
  @ApiResponse({ status: 200, description: '識別結果' })
  async identify(
    @Body()
    body: {
      employeeappnumber?: string;
      employeeerpid?: string;
      name?: string;
      store_name?: string;
    },
  ) {
    const employee = await this.employeesService.identify(body);
    if (!employee) {
      return { found: false, message: 'Employee not found with given identifiers' };
    }
    return { found: true, employee };
  }

  @Post('bulk-upsert')
  @ApiOperation({ summary: '批量同步員工' })
  @ApiResponse({ status: 200, description: '同步結果' })
  async bulkUpsert(
    @Body()
    body: {
      employees: (CreateEmployeeDto & { source_payload?: Record<string, any> })[];
    },
  ) {
    return this.employeesService.bulkUpsert(body.employees);
  }
}
