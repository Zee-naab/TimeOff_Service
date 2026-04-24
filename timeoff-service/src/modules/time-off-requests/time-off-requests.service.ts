import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, TimeOffRequestStatus } from './time-off-request.entity';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateTimeOffRequestStatusDto } from './dto/update-time-off-request-status.dto';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';

@Injectable()
export class TimeOffRequestsService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly timeOffRequestRepository: Repository<TimeOffRequest>,
    private readonly leaveBalancesService: LeaveBalancesService,
  ) {}

  findAll(): Promise<TimeOffRequest[]> {
    return this.timeOffRequestRepository.find({
      relations: ['employee', 'location', 'leave_type', 'manager'],
      order: { created_at: 'DESC' },
    });
  }

  findByEmployee(employeeId: number): Promise<TimeOffRequest[]> {
    return this.timeOffRequestRepository.find({
      where: { employee: { id: employeeId } },
      relations: ['employee', 'location', 'leave_type', 'manager'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<TimeOffRequest> {
    const request = await this.timeOffRequestRepository.findOne({
      where: { id },
      relations: ['employee', 'location', 'leave_type', 'manager'],
    });
    if (!request) {
      throw new NotFoundException(`TimeOffRequest with ID ${id} not found`);
    }
    return request;
  }

  async create(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    if (new Date(dto.start_date) > new Date(dto.end_date)) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    const balance = await this.leaveBalancesService.findByEmployeeLocationLeaveType(
      dto.employee_id,
      dto.location_id,
      dto.leave_type_id,
    );

    if (!balance) {
      throw new BadRequestException(
        `No leave balance found for employee ${dto.employee_id} at this location/leave-type combination`,
      );
    }

    if (Number(balance.balance) < dto.days_requested) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance.balance}, Requested: ${dto.days_requested}`,
      );
    }

    const request = this.timeOffRequestRepository.create({
      employee: { id: dto.employee_id } as any,
      location: { id: dto.location_id } as any,
      leave_type: { id: dto.leave_type_id } as any,
      manager: dto.manager_id ? ({ id: dto.manager_id } as any) : null,
      start_date: dto.start_date,
      end_date: dto.end_date,
      days_requested: dto.days_requested,
      status: TimeOffRequestStatus.PENDING,
    });

    return this.timeOffRequestRepository.save(request);
  }

  async updateStatus(id: number, dto: UpdateTimeOffRequestStatusDto): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status === TimeOffRequestStatus.CANCELLED) {
      throw new ConflictException('Cannot change status of a cancelled request');
    }
    if (request.status === dto.status) {
      throw new ConflictException(`Request is already in ${dto.status} status`);
    }

    const prevStatus = request.status;

    if (dto.status === TimeOffRequestStatus.APPROVED && prevStatus === TimeOffRequestStatus.PENDING) {
      await this.leaveBalancesService.deductBalance(
        request.employee.id,
        request.location.id,
        request.leave_type.id,
        Number(request.days_requested),
      );
    }

    if (
      prevStatus === TimeOffRequestStatus.APPROVED &&
      (dto.status === TimeOffRequestStatus.REJECTED || dto.status === TimeOffRequestStatus.CANCELLED)
    ) {
      await this.leaveBalancesService.restoreBalance(
        request.employee.id,
        request.location.id,
        request.leave_type.id,
        Number(request.days_requested),
      );
    }

    request.status = dto.status;
    return this.timeOffRequestRepository.save(request);
  }

  async markHcmSynced(id: number): Promise<TimeOffRequest> {
    const request = await this.findOne(id);
    request.hcm_synced = true;
    return this.timeOffRequestRepository.save(request);
  }

  async remove(id: number): Promise<void> {
    const request = await this.findOne(id);
    if (request.status === TimeOffRequestStatus.APPROVED) {
      throw new BadRequestException('Cannot delete an approved request. Cancel it first.');
    }
    await this.timeOffRequestRepository.remove(request);
  }
}
