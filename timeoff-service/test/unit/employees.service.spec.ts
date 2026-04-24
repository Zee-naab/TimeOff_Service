import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmployeesService } from '../../src/modules/employees/employees.service';
import { EmployeeRepository } from '../../src/database/repositories/employee.repository';
import { Employee } from '../../src/database/entities/employee.entity';
import { CreateEmployeeDto } from '../../src/modules/employees/dto/create-employee.dto';

const mockEmployee = (): Employee => ({
  id: 1,
  name: 'Jane Doe',
  email: 'jane@example.com',
  created_at: new Date(),
});

const mockRepo = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: EmployeeRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    repo = module.get(EmployeeRepository);
  });

  describe('findAll', () => {
    it('returns all employees', async () => {
      const employees = [mockEmployee()];
      repo.findAll.mockResolvedValue(employees);
      expect(await service.findAll()).toEqual(employees);
      expect(repo.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns an employee when found', async () => {
      const employee = mockEmployee();
      repo.findOne.mockResolvedValue(employee);
      expect(await service.findOne(1)).toEqual(employee);
    });

    it('throws NotFoundException when employee does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns a new employee', async () => {
      const dto: CreateEmployeeDto = { name: 'Jane Doe', email: 'jane@example.com' };
      const employee = mockEmployee();
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockReturnValue(employee);
      repo.save.mockResolvedValue(employee);
      expect(await service.create(dto)).toEqual(employee);
    });

    it('throws ConflictException when email already exists', async () => {
      const dto: CreateEmployeeDto = { name: 'Jane Doe', email: 'jane@example.com' };
      repo.findByEmail.mockResolvedValue(mockEmployee());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('removes an employee when found', async () => {
      const employee = mockEmployee();
      repo.findOne.mockResolvedValue(employee);
      repo.remove.mockResolvedValue(employee);
      await service.remove(1);
      expect(repo.remove).toHaveBeenCalledWith(employee);
    });

    it('throws NotFoundException when employee does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
