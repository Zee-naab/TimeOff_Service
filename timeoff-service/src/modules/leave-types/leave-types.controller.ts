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
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@ApiTags('Leave Types')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all leave types' })
  @ApiResponse({ status: 200, description: 'List of all leave types' })
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave type by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Leave type found' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leaveTypesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new leave type' })
  @ApiResponse({ status: 201, description: 'Leave type created successfully' })
  @ApiResponse({ status: 409, description: 'Leave type with this name already exists' })
  create(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Leave type updated successfully' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveTypesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a leave type' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Leave type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leaveTypesService.remove(id);
  }
}
