import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaveType } from '../../database/entities/leave-type.entity';
import { LeaveTypeRepository } from '../../database/repositories/leave-type.repository';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(private readonly leaveTypeRepository: LeaveTypeRepository) {}

  findAll(): Promise<LeaveType[]> {
    return this.leaveTypeRepository.findAll();
  }

  async findOne(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepository.findOne(id);
    if (!leaveType) throw new NotFoundException(`LeaveType with ID ${id} not found`);
    return leaveType;
  }

  async create(dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const leaveType = this.leaveTypeRepository.create(dto);
    return this.leaveTypeRepository.save(leaveType);
  }

  async update(id: number, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
    const leaveType = await this.findOne(id);
    Object.assign(leaveType, dto);
    return this.leaveTypeRepository.save(leaveType);
  }

  async remove(id: number): Promise<void> {
    const leaveType = await this.findOne(id);
    await this.leaveTypeRepository.remove(leaveType);
  }
}
