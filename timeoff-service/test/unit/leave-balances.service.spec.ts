import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { LedgerEntryRepository } from '../../src/database/repositories/ledger-entry.repository';
import { LedgerEntryType } from '../../src/database/entities/ledger-entry.entity';

const mockLedgerRepo = () => ({
  hasCombination: jest.fn(),
  computeBalance: jest.fn(),
  getLastSyncedAt: jest.fn(),
  addEntry: jest.fn(),
  findEntry: jest.fn(),
  findAllSummaries: jest.fn(),
  findSummariesByEmployee: jest.fn(),
  saveEntry: jest.fn(),
  removeEntry: jest.fn(),
});

describe('LeaveBalancesService', () => {
  let service: LeaveBalancesService;
  let repo: ReturnType<typeof mockLedgerRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveBalancesService,
        { provide: LedgerEntryRepository, useFactory: mockLedgerRepo },
      ],
    }).compile();

    service = module.get<LeaveBalancesService>(LeaveBalancesService);
    repo = module.get(LedgerEntryRepository);
  });

  describe('findOne', () => {
    it('returns a ledger entry when found', async () => {
      const entry = { id: 1, amount: 15, entry_type: LedgerEntryType.SYNC };
      repo.findEntry.mockResolvedValue(entry);
      expect(await service.findOne(1)).toEqual(entry);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findEntry.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductBalance', () => {
    it('adds a DEDUCTION entry when balance is sufficient', async () => {
      repo.hasCombination.mockResolvedValue(true);
      repo.computeBalance.mockResolvedValue(15);
      repo.addEntry.mockResolvedValue({ id: 2, amount: -5, entry_type: LedgerEntryType.DEDUCTION });

      await service.deductBalance(1, 1, 1, 5);

      expect(repo.addEntry).toHaveBeenCalledWith(1, 1, 1, -5, LedgerEntryType.DEDUCTION);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      repo.hasCombination.mockResolvedValue(true);
      repo.computeBalance.mockResolvedValue(3);

      await expect(service.deductBalance(1, 1, 1, 5)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no balance record exists', async () => {
      repo.hasCombination.mockResolvedValue(false);

      await expect(service.deductBalance(1, 1, 1, 5)).rejects.toThrow(NotFoundException);
    });
  });
});
