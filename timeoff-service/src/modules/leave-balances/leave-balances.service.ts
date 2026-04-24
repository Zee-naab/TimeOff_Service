import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LedgerEntry, LedgerEntryType } from '../../database/entities/ledger-entry.entity';
import { LedgerEntryRepository } from '../../database/repositories/ledger-entry.repository';
import { BalanceSummary } from '../../database/types/balance.types';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';

@Injectable()
export class LeaveBalancesService {
  constructor(private readonly ledgerEntryRepository: LedgerEntryRepository) {}

  findAll(): Promise<BalanceSummary[]> {
    return this.ledgerEntryRepository.findAllSummaries();
  }

  findByEmployee(employeeId: number): Promise<BalanceSummary[]> {
    return this.ledgerEntryRepository.findSummariesByEmployee(employeeId);
  }

  async findOne(id: number): Promise<LedgerEntry> {
    const entry = await this.ledgerEntryRepository.findEntry(id);
    if (!entry) throw new NotFoundException(`LedgerEntry with ID ${id} not found`);
    return entry;
  }

  async findByEmployeeLocationLeaveType(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
  ): Promise<BalanceSummary | null> {
    const exists = await this.ledgerEntryRepository.hasCombination(employeeId, locationId, leaveTypeId);
    if (!exists) return null;
    const balance = await this.ledgerEntryRepository.computeBalance(employeeId, locationId, leaveTypeId);
    const last_synced_at = await this.ledgerEntryRepository.getLastSyncedAt(employeeId, locationId, leaveTypeId);
    return { employee_id: employeeId, location_id: locationId, leave_type_id: leaveTypeId, balance, last_synced_at };
  }

  async create(dto: CreateLeaveBalanceDto): Promise<LedgerEntry> {
    const exists = await this.ledgerEntryRepository.hasCombination(
      dto.employee_id, dto.location_id, dto.leave_type_id,
    );
    if (exists) {
      throw new BadRequestException(
        `LeaveBalance for employee ${dto.employee_id}, location ${dto.location_id}, leave type ${dto.leave_type_id} already exists`,
      );
    }
    return this.ledgerEntryRepository.addEntry(
      dto.employee_id, dto.location_id, dto.leave_type_id,
      dto.balance, LedgerEntryType.SYNC,
    );
  }

  async update(id: number, dto: UpdateLeaveBalanceDto): Promise<LedgerEntry> {
    const entry = await this.findOne(id);
    if (dto.balance !== undefined) entry.amount = dto.balance;
    return this.ledgerEntryRepository.saveEntry(entry);
  }

  async upsert(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    hcmBalance: number,
  ): Promise<LedgerEntry> {
    const currentBalance = await this.ledgerEntryRepository.computeBalance(employeeId, locationId, leaveTypeId);
    const delta = hcmBalance - currentBalance;
    return this.ledgerEntryRepository.addEntry(employeeId, locationId, leaveTypeId, delta, LedgerEntryType.SYNC);
  }

  async deductBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    amount: number,
  ): Promise<LedgerEntry> {
    const exists = await this.ledgerEntryRepository.hasCombination(employeeId, locationId, leaveTypeId);
    if (!exists) throw new NotFoundException(`No leave balance found for this employee/location/leave-type combination`);
    const currentBalance = await this.ledgerEntryRepository.computeBalance(employeeId, locationId, leaveTypeId);
    if (currentBalance < amount) {
      throw new BadRequestException(`Insufficient balance. Available: ${currentBalance}, Requested: ${amount}`);
    }
    return this.ledgerEntryRepository.addEntry(employeeId, locationId, leaveTypeId, -amount, LedgerEntryType.DEDUCTION);
  }

  async restoreBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    amount: number,
  ): Promise<LedgerEntry> {
    const exists = await this.ledgerEntryRepository.hasCombination(employeeId, locationId, leaveTypeId);
    if (!exists) throw new NotFoundException(`No leave balance found for this employee/location/leave-type combination`);
    return this.ledgerEntryRepository.addEntry(employeeId, locationId, leaveTypeId, amount, LedgerEntryType.RESTORATION);
  }

  async remove(id: number): Promise<void> {
    const entry = await this.findOne(id);
    await this.ledgerEntryRepository.removeEntry(entry);
  }
}
