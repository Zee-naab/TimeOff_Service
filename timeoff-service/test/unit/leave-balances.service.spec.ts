import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { LeaveBalance } from '../../src/modules/leave-balances/leave-balance.entity';

const mockBalance = (): LeaveBalance => ({
  id: 1,
  employee: { id: 1, name: 'Jane', email: 'jane@example.com', created_at: new Date() },
  location: { id: 1, name: 'New York', created_at: new Date() },
  leave_type: { id: 1, name: 'Vacation', created_at: new Date() },
  balance: 15,
  last_synced_at: null,
  created_at: new Date(),
  updated_at: new Date(),
});

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('LeaveBalancesService', () => {
  let service: LeaveBalancesService;
  let repo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveBalancesService,
        { provide: getRepositoryToken(LeaveBalance), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<LeaveBalancesService>(LeaveBalancesService);
    repo = module.get(getRepositoryToken(LeaveBalance));
  });

  describe('findOne', () => {
    it('returns a leave balance when found', async () => {
      const balance = mockBalance();
      repo.findOne.mockResolvedValue(balance);
      expect(await service.findOne(1)).toEqual(balance);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductBalance', () => {
    it('deducts balance when sufficient funds exist', async () => {
      const balance = mockBalance();
      repo.findOne.mockResolvedValue(balance);
      repo.save.mockResolvedValue({ ...balance, balance: 10 });
      const result = await service.deductBalance(1, 1, 1, 5);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      const balance = { ...mockBalance(), balance: 3 };
      repo.findOne.mockResolvedValue(balance);
      await expect(service.deductBalance(1, 1, 1, 5)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no balance record exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deductBalance(1, 1, 1, 5)).rejects.toThrow(NotFoundException);
    });
  });
});
