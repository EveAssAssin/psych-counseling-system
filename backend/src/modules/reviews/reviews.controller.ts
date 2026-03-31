import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  CreateReviewResponseDto,
  SearchReviewDto,
  ReviewResponseDto,
} from './reviews.dto';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: '建立評價/客訴' })
  @ApiResponse({ status: 201, description: '建立成功' })
  async create(@Body() dto: CreateReviewDto) {
    try {
      const review = await this.reviewsService.create(dto);
      return {
        success: true,
        data: review,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: '搜尋評價' })
  @ApiResponse({ status: 200, description: '評價列表' })
  async search(@Query() dto: SearchReviewDto) {
    const result = await this.reviewsService.search(dto);
    return {
      success: true,
      ...result,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: '取得評價統計' })
  @ApiResponse({ status: 200, description: '統計資料' })
  async getStats() {
    const stats = await this.reviewsService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: '取得員工的評價列表' })
  @ApiParam({ name: 'employeeId', description: '員工 ID' })
  @ApiQuery({ name: 'limit', required: false })
  async getByEmployee(
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: number,
  ) {
    const reviews = await this.reviewsService.findByEmployee(employeeId, limit);
    return {
      success: true,
      data: reviews,
    };
  }

  @Get('employee/:employeeId/stats')
  @ApiOperation({ summary: '取得員工的評價統計' })
  @ApiParam({ name: 'employeeId', description: '員工 ID' })
  async getEmployeeStats(@Param('employeeId') employeeId: string) {
    const stats = await this.reviewsService.getEmployeeStats(employeeId);
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '取得單一評價' })
  @ApiParam({ name: 'id', description: '評價 ID' })
  async getById(@Param('id') id: string) {
    try {
      const review = await this.reviewsService.findById(id);
      const [attachments, responses] = await Promise.all([
        this.reviewsService.getAttachments(id),
        this.reviewsService.getResponses(id),
      ]);

      return {
        success: true,
        data: {
          ...review,
          attachments,
          responses,
        },
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/respond')
  @ApiOperation({ summary: '公關部追問/回覆' })
  @ApiParam({ name: 'id', description: '評價 ID' })
  async addResponse(
    @Param('id') id: string,
    @Body() body: { content: string; reviewer_name?: string },
  ) {
    try {
      const response = await this.reviewsService.addReviewerResponse(
        id,
        body.content,
        body.reviewer_name || '公關部',
      );
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id/close')
  @ApiOperation({ summary: '結案評價' })
  @ApiParam({ name: 'id', description: '評價 ID' })
  async close(
    @Param('id') id: string,
    @Body() body: { close_note?: string; closed_by?: string },
  ) {
    try {
      const review = await this.reviewsService.close(
        id,
        body.closed_by || null,
        body.close_note,
      );
      return {
        success: true,
        data: review,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Delete(':id')
  @ApiOperation({ summary: '刪除評價' })
  @ApiParam({ name: 'id', description: '評價 ID' })
  async delete(@Param('id') id: string) {
    try {
      await this.reviewsService.delete(id);
      return {
        success: true,
        message: '評價已刪除',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

// ============================================
// 員工回覆用的公開 Controller（不需登入）
// ============================================
@ApiTags('review-response')
@Controller('review-response')
export class ReviewResponseController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':token')
  @ApiOperation({ summary: '用 token 取得評價內容（員工回覆用）' })
  @ApiParam({ name: 'token', description: '回覆用的 token' })
  async getByToken(@Param('token') token: string) {
    try {
      const review = await this.reviewsService.findByToken(token);
      const [attachments, responses] = await Promise.all([
        this.reviewsService.getAttachments(review.id),
        this.reviewsService.getResponses(review.id),
      ]);

      return {
        success: true,
        data: {
          id: review.id,
          employee_name: review.employee_name,
          review_type: review.review_type,
          source: review.source,
          urgency: review.urgency,
          event_date: review.event_date,
          content: review.content,
          requires_response: review.requires_response,
          status: review.status,
          response_deadline: review.response_deadline,
          created_at: review.created_at,
          attachments: attachments.map(a => ({
            id: a.id,
            file_type: a.file_type,
            file_url: a.file_url,
            file_name: a.file_name,
          })),
          responses: responses.map(r => ({
            id: r.id,
            content: r.content,
            responder_type: r.responder_type,
            responder_name: r.responder_name,
            created_at: r.created_at,
          })),
        },
      };
    } catch (error) {
      if (error.status === 404) {
        throw new HttpException(
          { success: false, error: '無效的連結或評價不存在' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':token/respond')
  @ApiOperation({ summary: '員工提交回覆' })
  @ApiParam({ name: 'token', description: '回覆用的 token' })
  async submitResponse(
    @Param('token') token: string,
    @Body() dto: CreateReviewResponseDto,
  ) {
    try {
      const response = await this.reviewsService.submitResponse(token, dto);
      return {
        success: true,
        message: '回覆成功',
        data: response,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
