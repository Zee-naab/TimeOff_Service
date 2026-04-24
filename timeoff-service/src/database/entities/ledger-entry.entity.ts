import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Location } from './location.entity';
import { LeaveType } from './leave-type.entity';
import { TimeOffRequest } from './time-off-request.entity';

export enum LedgerEntryType {
  SYNC = 'SYNC',
  DEDUCTION = 'DEDUCTION',
  RESTORATION = 'RESTORATION',
}

/**
 * Append-only ledger of all balance changes per (employee, location, leave_type).
 * Current balance = SUM(amount) for a given combination.
 * SYNC entries record the delta from current balance to the HCM-reported value.
 * DEDUCTION entries store a negative amount (days taken).
 * RESTORATION entries store a positive amount (days returned on rejection/cancellation).
 */
@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Location)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leave_type: LeaveType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar' })
  entry_type: LedgerEntryType;

  @ManyToOne(() => TimeOffRequest, { nullable: true })
  @JoinColumn({ name: 'time_off_request_id' })
  time_off_request: TimeOffRequest | null;

  @CreateDateColumn()
  created_at: Date;
}
