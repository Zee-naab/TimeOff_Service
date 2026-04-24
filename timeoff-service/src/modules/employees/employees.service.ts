import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Employee } from '../../database/entities/employee.entity';
import { EmployeeRepository } from '../../database/repositories/employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  findAll(): Promise<Employee[]> {
    return this.employeeRepository.findAll();
  }

  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOne(id);
    if (!employee) throw new NotFoundException(`Employee with ID ${id} not found`);
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existing = await this.employeeRepository.findByEmail(dto.email);
    if (existing) throw new ConflictException(`Employee with email ${dto.email} already exists`);
    const employee = this.employeeRepository.create(dto);
    return this.employeeRepository.save(employee);
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);
    if (dto.email && dto.email !== employee.email) {
      const existing = await this.employeeRepository.findByEmail(dto.email);
      if (existing) throw new ConflictException(`Email ${dto.email} is already in use`);
    }
    Object.assign(employee, dto);
    return this.employeeRepository.save(employee);
  }

  async remove(id: number): Promise<void> {
    const employee = await this.findOne(id);
    await this.employeeRepository.remove(employee);
  }
}
