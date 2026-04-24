import {
  Controller,
  Get,
  Post,
  Put,
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
import { LeaveBalancesService } from './leave-balances.service';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';

@ApiTags('Leave Balances')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all leave balances' })
  @ApiResponse({ status: 200, description: 'List of all leave balances with employee/location/leave-type details' })
  findAll() {
    return this.leaveBalancesService.findAll();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get all leave balances for a specific employee' })
  @ApiParam({ name: 'employeeId', type: Number })
  @ApiResponse({ status: 200, description: 'Leave balances for the employee' })
  findByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.leaveBalancesService.findByEmployee(employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave balance by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Leave balance found' })
  @ApiResponse({ status: 404, description: 'Leave balance not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leaveBalancesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new leave balance record' })
  @ApiResponse({ status: 201, description: 'Leave balance created successfully' })
  @ApiResponse({ status: 400, description: 'Leave balance for this combination already exists' })
  create(@Body() dto: CreateLeaveBalanceDto) {
    return this.leaveBalancesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a leave balance' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Leave balance updated successfully' })
  @ApiResponse({ status: 404, description: 'Leave balance not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeaveBalanceDto) {
    return this.leaveBalancesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a leave balance record' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Leave balance deleted successfully' })
  @ApiResponse({ status: 404, description: 'Leave balance not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leaveBalancesService.remove(id);
  }
}
