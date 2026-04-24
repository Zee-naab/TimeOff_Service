import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from '../entities/time-off-request.entity';

const RELATIONS = ['employee', 'location', 'leave_type', 'manager'];

@Injectable()
export class TimeOffRequestRepository {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly repo: Repository<TimeOffRequest>,
  ) {}

  findAll(): Promise<TimeOffRequest[]> {
    return this.repo.find({ relations: RELATIONS, order: { created_at: 'DESC' } });
  }

  findOne(id: number): Promise<TimeOffRequest | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  findByEmployee(employeeId: number): Promise<TimeOffRequest[]> {
    return this.repo.find({
      where: { employee: { id: employeeId } },
      relations: RELATIONS,
      order: { created_at: 'DESC' },
    });
  }

  create(data: Partial<TimeOffRequest>): TimeOffRequest {
    return this.repo.create(data);
  }

  save(request: TimeOffRequest): Promise<TimeOffRequest> {
    return this.repo.save(request);
  }

  remove(request: TimeOffRequest): Promise<TimeOffRequest> {
    return this.repo.remove(request);
  }
}
