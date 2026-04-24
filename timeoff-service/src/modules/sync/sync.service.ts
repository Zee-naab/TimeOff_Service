import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SyncLog, SyncType, SyncStatus } from '../../database/entities/sync-log.entity';
import { LedgerEntryType } from '../../database/entities/ledger-entry.entity';
import { SyncLogRepository } from '../../database/repositories/sync-log.repository';
import { LedgerEntryRepository } from '../../database/repositories/ledger-entry.repository';
import { HcmBalanceResponse, HcmBatchResponse } from '../../database/types/hcm.types';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly syncLogRepository: SyncLogRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get hcmBaseUrl(): string {
    return this.configService.get<string>('HCM_BASE_URL', 'http://localhost:4000');
  }

  private get hcmHeaders(): Record<string, string> {
    return { 'x-api-key': this.configService.get<string>('HCM_API_KEY', 'mock-hcm-secret') };
  }

  findAllLogs(): Promise<SyncLog[]> {
    return this.syncLogRepository.findAll();
  }

  private async upsertBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    hcmBalance: number,
  ): Promise<void> {
    const currentBalance = await this.ledgerEntryRepository.computeBalance(employeeId, locationId, leaveTypeId);
    const delta = hcmBalance - currentBalance;
    await this.ledgerEntryRepository.addEntry(employeeId, locationId, leaveTypeId, delta, LedgerEntryType.SYNC);
  }

  async syncRealtime(employeeId: number, locationId: number, leaveTypeId: number): Promise<SyncLog> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/balance/${employeeId}/${locationId}/${leaveTypeId}`;
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceResponse>(url, { headers: this.hcmHeaders }),
      );

      await this.upsertBalance(employeeId, locationId, leaveTypeId, response.data.balance);

      this.logger.log(
        `Realtime sync success: employee=${employeeId}, location=${locationId}, leaveType=${leaveTypeId}, balance=${response.data.balance}`,
      );

      return this.syncLogRepository.createLog(
        SyncType.REALTIME,
        SyncStatus.SUCCESS,
        JSON.stringify({ employeeId, locationId, leaveTypeId, balance: response.data.balance }),
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const message = e?.response?.data?.message || e?.message || 'Unknown error';
      this.logger.error(`Realtime sync failed: ${message}`);
      return this.syncLogRepository.createLog(
        SyncType.REALTIME,
        SyncStatus.FAILED,
        JSON.stringify({ employeeId, locationId, leaveTypeId, error: message }),
      );
    }
  }

  async syncBatch(): Promise<SyncLog> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/batch`;
      const response = await firstValueFrom(
        this.httpService.post<HcmBatchResponse>(url, {}, { headers: this.hcmHeaders }),
      );

      const balances = response.data.balances;
      let synced = 0;
      for (const item of balances) {
        await this.upsertBalance(item.employeeId, item.locationId, item.leaveTypeId, item.balance);
        synced++;
      }

      this.logger.log(`Batch sync success: ${synced} balances updated`);

      return this.syncLogRepository.createLog(
        SyncType.BATCH,
        SyncStatus.SUCCESS,
        JSON.stringify({ totalSynced: synced, timestamp: new Date().toISOString() }),
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const message = e?.response?.data?.message || e?.message || 'Unknown error';
      this.logger.error(`Batch sync failed: ${message}`);
      return this.syncLogRepository.createLog(
        SyncType.BATCH,
        SyncStatus.FAILED,
        JSON.stringify({ error: message }),
      );
    }
  }
}
