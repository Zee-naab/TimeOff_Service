import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto';

@Injectable()
export class LeaveBalancesService {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
  ) {}

  findAll(): Promise<LeaveBalance[]> {
    return this.leaveBalanceRepository.find({
      relations: ['employee', 'location', 'leave_type'],
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<LeaveBalance> {
    const balance = await this.leaveBalanceRepository.findOne({
      where: { id },
      relations: ['employee', 'location', 'leave_type'],
    });
    if (!balance) {
      throw new NotFoundException(`LeaveBalance with ID ${id} not found`);
    }
    return balance;
  }

  findByEmployee(employeeId: number): Promise<LeaveBalance[]> {
    return this.leaveBalanceRepository.find({
      where: { employee: { id: employeeId } },
      relations: ['employee', 'location', 'leave_type'],
    });
  }

  async findByEmployeeLocationLeaveType(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
  ): Promise<LeaveBalance | null> {
    return this.leaveBalanceRepository.findOne({
      where: {
        employee: { id: employeeId },
        location: { id: locationId },
        leave_type: { id: leaveTypeId },
      },
      relations: ['employee', 'location', 'leave_type'],
    });
  }

  async create(dto: CreateLeaveBalanceDto): Promise<LeaveBalance> {
    const existing = await this.findByEmployeeLocationLeaveType(
      dto.employee_id,
      dto.location_id,
      dto.leave_type_id,
    );
    if (existing) {
      throw new BadRequestException(
        `LeaveBalance for employee ${dto.employee_id}, location ${dto.location_id}, leave type ${dto.leave_type_id} already exists`,
      );
    }
    const leaveBalance = this.leaveBalanceRepository.create({
      employee: { id: dto.employee_id } as any,
      location: { id: dto.location_id } as any,
      leave_type: { id: dto.leave_type_id } as any,
      balance: dto.balance,
      last_synced_at: dto.last_synced_at,
    });
    return this.leaveBalanceRepository.save(leaveBalance);
  }

  async update(id: number, dto: UpdateLeaveBalanceDto): Promise<LeaveBalance> {
    const leaveBalance = await this.findOne(id);
    Object.assign(leaveBalance, dto);
    return this.leaveBalanceRepository.save(leaveBalance);
  }

  async upsert(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    balance: number,
  ): Promise<LeaveBalance> {
    let leaveBalance = await this.findByEmployeeLocationLeaveType(employeeId, locationId, leaveTypeId);
    if (leaveBalance) {
      leaveBalance.balance = balance;
      leaveBalance.last_synced_at = new Date();
    } else {
      leaveBalance = this.leaveBalanceRepository.create({
        employee: { id: employeeId } as any,
        location: { id: locationId } as any,
        leave_type: { id: leaveTypeId } as any,
        balance,
        last_synced_at: new Date(),
      });
    }
    return this.leaveBalanceRepository.save(leaveBalance);
  }

  async deductBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    amount: number,
  ): Promise<LeaveBalance> {
    const leaveBalance = await this.findByEmployeeLocationLeaveType(employeeId, locationId, leaveTypeId);
    if (!leaveBalance) {
      throw new NotFoundException(`No leave balance found for this employee/location/leave-type combination`);
    }
    if (leaveBalance.balance < amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${leaveBalance.balance}, Requested: ${amount}`,
      );
    }
    leaveBalance.balance = Number(leaveBalance.balance) - amount;
    return this.leaveBalanceRepository.save(leaveBalance);
  }

  async restoreBalance(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
    amount: number,
  ): Promise<LeaveBalance> {
    const leaveBalance = await this.findByEmployeeLocationLeaveType(employeeId, locationId, leaveTypeId);
    if (!leaveBalance) {
      throw new NotFoundException(`No leave balance found for this employee/location/leave-type combination`);
    }
    leaveBalance.balance = Number(leaveBalance.balance) + amount;
    return this.leaveBalanceRepository.save(leaveBalance);
  }

  async remove(id: number): Promise<void> {
    const leaveBalance = await this.findOne(id);
    await this.leaveBalanceRepository.remove(leaveBalance);
  }
}
