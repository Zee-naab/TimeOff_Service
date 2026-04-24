import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveType } from '../entities/leave-type.entity';

@Injectable()
export class LeaveTypeRepository {
  constructor(
    @InjectRepository(LeaveType)
    private readonly repo: Repository<LeaveType>,
  ) {}

  findAll(): Promise<LeaveType[]> {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  findOne(id: number): Promise<LeaveType | null> {
    return this.repo.findOneBy({ id });
  }

  create(data: Partial<LeaveType>): LeaveType {
    return this.repo.create(data);
  }

  save(leaveType: LeaveType): Promise<LeaveType> {
    return this.repo.save(leaveType);
  }

  remove(leaveType: LeaveType): Promise<LeaveType> {
    return this.repo.remove(leaveType);
  }
}
