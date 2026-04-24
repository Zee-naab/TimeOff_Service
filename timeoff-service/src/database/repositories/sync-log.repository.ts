import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLog, SyncType, SyncStatus } from '../entities/sync-log.entity';

@Injectable()
export class SyncLogRepository {
  constructor(
    @InjectRepository(SyncLog)
    private readonly repo: Repository<SyncLog>,
  ) {}

  findAll(): Promise<SyncLog[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  createLog(type: SyncType, status: SyncStatus, details?: string): Promise<SyncLog> {
    const log = this.repo.create({ type, status, details });
    return this.repo.save(log);
  }
}
