import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Location } from '../locations/location.entity';
import { LeaveType } from '../leave-types/leave-type.entity';

@Entity('leave_balances')
@Unique(['employee', 'location', 'leave_type'])
export class LeaveBalance {
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
  balance: number;

  @Column({ type: 'datetime', nullable: true })
  last_synced_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
