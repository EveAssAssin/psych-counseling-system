import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoresService } from './stores.service';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: '取得所有門市' })
  @ApiResponse({ status: 200, description: '門市列表' })
  async findAll() {
    return this.storesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一門市' })
  @ApiResponse({ status: 200, description: '門市資料' })
  async findOne(@Param('id') id: string) {
    return this.storesService.findById(id);
  }
}
