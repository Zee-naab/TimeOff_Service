import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Location } from '../locations/location.entity';
import { LeaveType } from '../leave-types/leave-type.entity';

export enum TimeOffRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('time_off_requests')
export class TimeOffRequest {
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

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Employee;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  days_requested: number;

  @Column({
    type: 'varchar',
    enum: TimeOffRequestStatus,
    default: TimeOffRequestStatus.PENDING,
  })
  status: TimeOffRequestStatus;

  @Column({ default: false })
  hcm_synced: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
