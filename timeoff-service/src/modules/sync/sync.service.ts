import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SyncLog, SyncType, SyncStatus } from './sync-log.entity';
import { LeaveBalance } from '../leave-balances/leave-balance.entity';

interface HcmBalanceResponse {
  success: boolean;
  balance: number;
}

interface HcmBatchItem {
  employeeId: number;
  locationId: number;
  leaveTypeId: number;
  balance: number;
}

interface HcmBatchResponse {
  success: boolean;
  balances: HcmBatchItem[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get hcmBaseUrl(): string {
    return this.configService.get<string>('HCM_BASE_URL', 'http://localhost:4000');
  }

  private get hcmHeaders(): Record<string, string> {
    return {
      'x-api-key': this.configService.get<string>('HCM_API_KEY', 'mock-hcm-secret'),
    };
  }

  findAllLogs(): Promise<SyncLog[]> {
    return this.syncLogRepository.find({ order: { created_at: 'DESC' } });
  }

  private async createLog(type: SyncType, status: SyncStatus, details?: string): Promise<SyncLog> {
    const log = this.syncLogRepository.create({ type, status, details });
    return this.syncLogRepository.save(log);
  }

  private async upsertLeaveBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    balance: number,
  ): Promise<void> {
    const existing = await this.leaveBalanceRepository.findOne({
      where: {
        employee: { id: employeeId },
        location: { id: locationId },
        leave_type: { id: leaveTypeId },
      },
    });

    if (existing) {
      existing.balance = balance;
      existing.last_synced_at = new Date();
      await this.leaveBalanceRepository.save(existing);
    } else {
      const newBalance = this.leaveBalanceRepository.create({
        employee: { id: employeeId } as any,
        location: { id: locationId } as any,
        leave_type: { id: leaveTypeId } as any,
        balance,
        last_synced_at: new Date(),
      });
      await this.leaveBalanceRepository.save(newBalance);
    }
  }

  async syncRealtime(employeeId: number, locationId: number, leaveTypeId: number): Promise<SyncLog> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/balance/${employeeId}/${locationId}/${leaveTypeId}`;
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceResponse>(url, { headers: this.hcmHeaders }),
      );

      await this.upsertLeaveBalance(employeeId, locationId, leaveTypeId, response.data.balance);

      this.logger.log(
        `Realtime sync success: employee=${employeeId}, location=${locationId}, leaveType=${leaveTypeId}, balance=${response.data.balance}`,
      );

      return this.createLog(
        SyncType.REALTIME,
        SyncStatus.SUCCESS,
        JSON.stringify({ employeeId, locationId, leaveTypeId, balance: response.data.balance }),
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const message = e?.response?.data?.message || e?.message || 'Unknown error';
      this.logger.error(`Realtime sync failed: ${message}`);
      return this.createLog(
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
        await this.upsertLeaveBalance(item.employeeId, item.locationId, item.leaveTypeId, item.balance);
        synced++;
      }

      this.logger.log(`Batch sync success: ${synced} balances updated`);

      return this.createLog(
        SyncType.BATCH,
        SyncStatus.SUCCESS,
        JSON.stringify({ totalSynced: synced, timestamp: new Date().toISOString() }),
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const message = e?.response?.data?.message || e?.message || 'Unknown error';
      this.logger.error(`Batch sync failed: ${message}`);
      return this.createLog(
        SyncType.BATCH,
        SyncStatus.FAILED,
        JSON.stringify({ error: message }),
      );
    }
  }
}
