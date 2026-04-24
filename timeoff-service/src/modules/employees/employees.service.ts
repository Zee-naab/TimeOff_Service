import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  findAll(): Promise<Employee[]> {
    return this.employeeRepository.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOneBy({ id });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existing = await this.employeeRepository.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException(`Employee with email ${dto.email} already exists`);
    }
    const employee = this.employeeRepository.create(dto);
    return this.employeeRepository.save(employee);
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);
    if (dto.email && dto.email !== employee.email) {
      const existing = await this.employeeRepository.findOneBy({ email: dto.email });
      if (existing) {
        throw new ConflictException(`Email ${dto.email} is already in use`);
      }
    }
    Object.assign(employee, dto);
    return this.employeeRepository.save(employee);
  }

  async remove(id: number): Promise<void> {
    const employee = await this.findOne(id);
    await this.employeeRepository.remove(employee);
  }
}
