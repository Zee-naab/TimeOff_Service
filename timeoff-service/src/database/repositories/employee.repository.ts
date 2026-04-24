import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';

@Injectable()
export class EmployeeRepository {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  findAll(): Promise<Employee[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  findOne(id: number): Promise<Employee | null> {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<Employee | null> {
    return this.repo.findOneBy({ email });
  }

  create(data: Partial<Employee>): Employee {
    return this.repo.create(data);
  }

  save(employee: Employee): Promise<Employee> {
    return this.repo.save(employee);
  }

  remove(employee: Employee): Promise<Employee> {
    return this.repo.remove(employee);
  }
}
