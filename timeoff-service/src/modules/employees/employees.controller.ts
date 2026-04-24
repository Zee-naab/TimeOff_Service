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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all employees' })
  @ApiResponse({ status: 200, description: 'List of all employees' })
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Employee found' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 409, description: 'Employee with this email already exists' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an employee' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Employee deleted successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }
}
