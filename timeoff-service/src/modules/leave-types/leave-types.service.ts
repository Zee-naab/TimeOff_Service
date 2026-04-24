import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveType } from './leave-type.entity';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
  ) {}

  findAll(): Promise<LeaveType[]> {
    return this.leaveTypeRepository.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepository.findOneBy({ id });
    if (!leaveType) {
      throw new NotFoundException(`LeaveType with ID ${id} not found`);
    }
    return leaveType;
  }

  async create(dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const existing = await this.leaveTypeRepository.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException(`LeaveType with name "${dto.name}" already exists`);
    }
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
