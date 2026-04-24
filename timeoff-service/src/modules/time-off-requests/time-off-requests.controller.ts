import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TimeOffRequestsService } from './time-off-requests.service';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateTimeOffRequestStatusDto } from './dto/update-time-off-request-status.dto';

@ApiTags('Time Off Requests')
@Controller('time-off-requests')
export class TimeOffRequestsController {
  constructor(private readonly timeOffRequestsService: TimeOffRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all time off requests' })
  @ApiResponse({ status: 200, description: 'List of all time off requests' })
  findAll() {
    return this.timeOffRequestsService.findAll();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get all time off requests for a specific employee' })
  @ApiParam({ name: 'employeeId', type: Number })
  @ApiResponse({ status: 200, description: 'Time off requests for the employee' })
  findByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.timeOffRequestsService.findByEmployee(employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get time off request by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Time off request found' })
  @ApiResponse({ status: 404, description: 'Time off request not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.timeOffRequestsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new time off request' })
  @ApiResponse({ status: 201, description: 'Time off request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dates or insufficient leave balance' })
  create(@Body() dto: CreateTimeOffRequestDto) {
    return this.timeOffRequestsService.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of a time off request (approve, reject, cancel)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid state transition' })
  @ApiResponse({ status: 404, description: 'Time off request not found' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimeOffRequestStatusDto,
  ) {
    return this.timeOffRequestsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time off request (only non-approved requests)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Time off request deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete an approved request' })
  @ApiResponse({ status: 404, description: 'Time off request not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.timeOffRequestsService.remove(id);
  }
}
