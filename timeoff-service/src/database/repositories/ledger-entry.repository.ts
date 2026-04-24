import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';
import { BalanceSummary } from '../types/balance.types';

@Injectable()
export class LedgerEntryRepository {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
  ) {}

  async computeBalance(employeeId: number, locationId: number, leaveTypeId: number): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
       WHERE employee_id = ? AND location_id = ? AND leave_type_id = ?`,
      [employeeId, locationId, leaveTypeId],
    );
    return Number(row.total);
  }

  async hasCombination(employeeId: number, locationId: number, leaveTypeId: number): Promise<boolean> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*) AS cnt FROM ledger_entries
       WHERE employee_id = ? AND location_id = ? AND leave_type_id = ?`,
      [employeeId, locationId, leaveTypeId],
    );
    return Number(row.cnt) > 0;
  }

  async getLastSyncedAt(employeeId: number, locationId: number, leaveTypeId: number): Promise<Date | null> {
    const entry = await this.repo.findOne({
      where: {
        employee: { id: employeeId },
        location: { id: locationId },
        leave_type: { id: leaveTypeId },
        entry_type: LedgerEntryType.SYNC,
      },
      order: { created_at: 'DESC' },
    });
    return entry?.created_at ?? null;
  }

  async addEntry(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    amount: number,
    entryType: LedgerEntryType,
    timeOffRequestId?: number,
  ): Promise<LedgerEntry> {
    const entry = this.repo.create({
      employee: { id: employeeId } as any,
      location: { id: locationId } as any,
      leave_type: { id: leaveTypeId } as any,
      amount,
      entry_type: entryType,
      time_off_request: timeOffRequestId ? ({ id: timeOffRequestId } as any) : null,
    });
    return this.repo.save(entry);
  }

  findEntry(id: number): Promise<LedgerEntry | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['employee', 'location', 'leave_type', 'time_off_request'],
    });
  }

  findByEmployee(employeeId: number): Promise<LedgerEntry[]> {
    return this.repo.find({
      where: { employee: { id: employeeId } },
      relations: ['employee', 'location', 'leave_type'],
      order: { created_at: 'DESC' },
    });
  }

  async findAllSummaries(): Promise<BalanceSummary[]> {
    const rows: any[] = await this.repo.query(`
      SELECT
        e.employee_id,
        emp.name  AS employee_name,
        e.location_id,
        loc.name  AS location_name,
        e.leave_type_id,
        lt.name   AS leave_type_name,
        COALESCE(SUM(e.amount), 0) AS balance,
        MAX(CASE WHEN e.entry_type = 'SYNC' THEN e.created_at ELSE NULL END) AS last_synced_at
      FROM ledger_entries e
      LEFT JOIN employees  emp ON emp.id = e.employee_id
      LEFT JOIN locations  loc ON loc.id = e.location_id
      LEFT JOIN leave_types lt  ON lt.id  = e.leave_type_id
      GROUP BY e.employee_id, e.location_id, e.leave_type_id
      ORDER BY emp.name, loc.name, lt.name
    `);
    return rows.map((r) => ({
      employee_id: Number(r.employee_id),
      employee_name: r.employee_name,
      location_id: Number(r.location_id),
      location_name: r.location_name,
      leave_type_id: Number(r.leave_type_id),
      leave_type_name: r.leave_type_name,
      balance: Number(r.balance),
      last_synced_at: r.last_synced_at ?? null,
    }));
  }

  async findSummariesByEmployee(employeeId: number): Promise<BalanceSummary[]> {
    const rows: any[] = await this.repo.query(`
      SELECT
        e.employee_id,
        emp.name  AS employee_name,
        e.location_id,
        loc.name  AS location_name,
        e.leave_type_id,
        lt.name   AS leave_type_name,
        COALESCE(SUM(e.amount), 0) AS balance,
        MAX(CASE WHEN e.entry_type = 'SYNC' THEN e.created_at ELSE NULL END) AS last_synced_at
      FROM ledger_entries e
      LEFT JOIN employees  emp ON emp.id = e.employee_id
      LEFT JOIN locations  loc ON loc.id = e.location_id
      LEFT JOIN leave_types lt  ON lt.id  = e.leave_type_id
      WHERE e.employee_id = ?
      GROUP BY e.employee_id, e.location_id, e.leave_type_id
      ORDER BY loc.name, lt.name
    `, [employeeId]);
    return rows.map((r) => ({
      employee_id: Number(r.employee_id),
      employee_name: r.employee_name,
      location_id: Number(r.location_id),
      location_name: r.location_name,
      leave_type_id: Number(r.leave_type_id),
      leave_type_name: r.leave_type_name,
      balance: Number(r.balance),
      last_synced_at: r.last_synced_at ?? null,
    }));
  }

  async saveEntry(entry: LedgerEntry): Promise<LedgerEntry> {
    return this.repo.save(entry);
  }

  async removeEntry(entry: LedgerEntry): Promise<void> {
    await this.repo.remove(entry);
  }
}
