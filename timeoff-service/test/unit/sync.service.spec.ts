import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { SyncService } from '../../src/modules/sync/sync.service';
import { SyncType, SyncStatus } from '../../src/database/entities/sync-log.entity';
import { SyncLogRepository } from '../../src/database/repositories/sync-log.repository';
import { LedgerEntryRepository } from '../../src/database/repositories/ledger-entry.repository';
import { LedgerEntryType } from '../../src/database/entities/ledger-entry.entity';

const mockSyncLogRepo = () => ({
  findAll: jest.fn(),
  createLog: jest.fn(),
});

const mockLedgerRepo = () => ({
  computeBalance: jest.fn(),
  addEntry: jest.fn(),
});

const mockHttpService = () => ({ get: jest.fn(), post: jest.fn() });

const mockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
    const cfg: Record<string, string> = {
      HCM_BASE_URL: 'http://localhost:4000',
      HCM_API_KEY: 'mock-hcm-secret',
    };
    return cfg[key] ?? defaultVal;
  }),
});

describe('SyncService', () => {
  let service: SyncService;
  let http: ReturnType<typeof mockHttpService>;
  let syncLogRepo: ReturnType<typeof mockSyncLogRepo>;
  let ledgerRepo: ReturnType<typeof mockLedgerRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: SyncLogRepository, useFactory: mockSyncLogRepo },
        { provide: LedgerEntryRepository, useFactory: mockLedgerRepo },
        { provide: HttpService, useFactory: mockHttpService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    http = module.get(HttpService);
    syncLogRepo = module.get(SyncLogRepository);
    ledgerRepo = module.get(LedgerEntryRepository);
  });

  // ─── syncRealtime ────────────────────────────────────────────────────────────

  describe('syncRealtime', () => {
    it('syncs balance from HCM and writes a SUCCESS log', async () => {
      http.get.mockReturnValue(
        of({ data: { success: true, employeeId: 1, locationId: 1, leaveTypeId: 1, balance: 15 } }),
      );
      ledgerRepo.computeBalance.mockResolvedValue(10);
      ledgerRepo.addEntry.mockResolvedValue({ id: 1, amount: 5, entry_type: LedgerEntryType.SYNC });

      const log = { type: SyncType.REALTIME, status: SyncStatus.SUCCESS, id: 1 };
      syncLogRepo.createLog.mockResolvedValue(log);

      const result = await service.syncRealtime(1, 1, 1);

      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:4000/hcm/balance/1/1/1',
        { headers: { 'x-api-key': 'mock-hcm-secret' } },
      );
      expect(ledgerRepo.addEntry).toHaveBeenCalledWith(1, 1, 1, 5, LedgerEntryType.SYNC);
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });

    it('writes a FAILED log when HCM call throws an error', async () => {
      http.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const log = { type: SyncType.REALTIME, status: SyncStatus.FAILED, id: 2 };
      syncLogRepo.createLog.mockResolvedValue(log);

      const result = await service.syncRealtime(1, 1, 1);

      expect(ledgerRepo.addEntry).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncStatus.FAILED);
    });
  });

  // ─── syncBatch ───────────────────────────────────────────────────────────────

  describe('syncBatch', () => {
    it('upserts all balances returned by HCM and writes a SUCCESS log', async () => {
      const balances = [
        { employeeId: 1, locationId: 1, leaveTypeId: 1, balance: 10 },
        { employeeId: 1, locationId: 1, leaveTypeId: 2, balance: 5 },
      ];
      http.post.mockReturnValue(of({ data: { success: true, balances } }));
      ledgerRepo.computeBalance.mockResolvedValue(0);
      ledgerRepo.addEntry.mockResolvedValue({ id: 1 });

      const log = { type: SyncType.BATCH, status: SyncStatus.SUCCESS, id: 3 };
      syncLogRepo.createLog.mockResolvedValue(log);

      const result = await service.syncBatch();

      expect(http.post).toHaveBeenCalledWith(
        'http://localhost:4000/hcm/batch',
        {},
        { headers: { 'x-api-key': 'mock-hcm-secret' } },
      );
      expect(ledgerRepo.addEntry).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });

    it('handles an empty batch response gracefully and still writes SUCCESS log', async () => {
      http.post.mockReturnValue(of({ data: { success: true, balances: [] } }));

      const log = { type: SyncType.BATCH, status: SyncStatus.SUCCESS, id: 4 };
      syncLogRepo.createLog.mockResolvedValue(log);

      const result = await service.syncBatch();

      expect(ledgerRepo.addEntry).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });
  });
});
