import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { SyncService } from '../../src/modules/sync/sync.service';
import { SyncLog, SyncType, SyncStatus } from '../../src/modules/sync/sync-log.entity';
import { LeaveBalance } from '../../src/modules/leave-balances/leave-balance.entity';

const mockSyncLogRepo = () => ({
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockLeaveBalanceRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockHttpService = () => ({
  get: jest.fn(),
  post: jest.fn(),
});

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
  let leaveBalanceRepo: ReturnType<typeof mockLeaveBalanceRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncLog), useFactory: mockSyncLogRepo },
        { provide: getRepositoryToken(LeaveBalance), useFactory: mockLeaveBalanceRepo },
        { provide: HttpService, useFactory: mockHttpService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    http = module.get(HttpService);
    syncLogRepo = module.get(getRepositoryToken(SyncLog));
    leaveBalanceRepo = module.get(getRepositoryToken(LeaveBalance));
  });

  // ─── syncRealtime ────────────────────────────────────────────────────────────

  describe('syncRealtime', () => {
    it('syncs balance from HCM and writes a SUCCESS log', async () => {
      http.get.mockReturnValue(
        of({ data: { success: true, employeeId: 1, locationId: 1, leaveTypeId: 1, balance: 15 } }),
      );
      leaveBalanceRepo.findOne.mockResolvedValue(null);
      leaveBalanceRepo.create.mockReturnValue({ balance: 15 });
      leaveBalanceRepo.save.mockResolvedValue({ id: 1, balance: 15 });

      const log = { type: SyncType.REALTIME, status: SyncStatus.SUCCESS, id: 1 };
      syncLogRepo.create.mockReturnValue(log);
      syncLogRepo.save.mockResolvedValue(log);

      const result = await service.syncRealtime(1, 1, 1);

      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:4000/hcm/balance/1/1/1',
        { headers: { 'x-api-key': 'mock-hcm-secret' } },
      );
      expect(leaveBalanceRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });

    it('writes a FAILED log when HCM call throws an error', async () => {
      http.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const log = { type: SyncType.REALTIME, status: SyncStatus.FAILED, id: 2 };
      syncLogRepo.create.mockReturnValue(log);
      syncLogRepo.save.mockResolvedValue(log);

      const result = await service.syncRealtime(1, 1, 1);

      expect(leaveBalanceRepo.save).not.toHaveBeenCalled();
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
      leaveBalanceRepo.findOne.mockResolvedValue(null);
      leaveBalanceRepo.create.mockReturnValue({});
      leaveBalanceRepo.save.mockResolvedValue({ id: 1 });

      const log = { type: SyncType.BATCH, status: SyncStatus.SUCCESS, id: 3 };
      syncLogRepo.create.mockReturnValue(log);
      syncLogRepo.save.mockResolvedValue(log);

      const result = await service.syncBatch();

      expect(http.post).toHaveBeenCalledWith(
        'http://localhost:4000/hcm/batch',
        {},
        { headers: { 'x-api-key': 'mock-hcm-secret' } },
      );
      expect(leaveBalanceRepo.save).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });

    it('handles an empty batch response gracefully and still writes SUCCESS log', async () => {
      http.post.mockReturnValue(of({ data: { success: true, balances: [] } }));

      const log = { type: SyncType.BATCH, status: SyncStatus.SUCCESS, id: 4 };
      syncLogRepo.create.mockReturnValue(log);
      syncLogRepo.save.mockResolvedValue(log);

      const result = await service.syncBatch();

      expect(leaveBalanceRepo.save).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncStatus.SUCCESS);
    });
  });
});
