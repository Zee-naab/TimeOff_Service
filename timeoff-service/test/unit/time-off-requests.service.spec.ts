import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TimeOffRequestsService } from '../../src/modules/time-off-requests/time-off-requests.service';
import { TimeOffRequest, TimeOffRequestStatus } from '../../src/database/entities/time-off-request.entity';
import { TimeOffRequestRepository } from '../../src/database/repositories/time-off-request.repository';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { CreateTimeOffRequestDto } from '../../src/modules/time-off-requests/dto/create-time-off-request.dto';
import { UpdateTimeOffRequestStatusDto } from '../../src/modules/time-off-requests/dto/update-time-off-request-status.dto';

const stubEmployee = () => ({ id: 1, name: 'Jane', email: 'jane@example.com', created_at: new Date() });
const stubLocation = () => ({ id: 1, name: 'New York', created_at: new Date() });
const stubLeaveType = () => ({ id: 1, name: 'Vacation', created_at: new Date() });

const stubRequest = (overrides: Partial<TimeOffRequest> = {}): TimeOffRequest =>
  ({
    id: 1,
    employee: stubEmployee(),
    location: stubLocation(),
    leave_type: stubLeaveType(),
    manager: null,
    start_date: '2024-06-01',
    end_date: '2024-06-05',
    days_requested: 5,
    status: TimeOffRequestStatus.PENDING,
    hcm_synced: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as TimeOffRequest);

const mockRepo = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEmployee: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const mockLeaveBalancesService = () => ({
  findByEmployeeLocationLeaveType: jest.fn(),
  deductBalance: jest.fn(),
  restoreBalance: jest.fn(),
});

describe('TimeOffRequestsService', () => {
  let service: TimeOffRequestsService;
  let repo: ReturnType<typeof mockRepo>;
  let lbService: ReturnType<typeof mockLeaveBalancesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffRequestsService,
        { provide: TimeOffRequestRepository, useFactory: mockRepo },
        { provide: LeaveBalancesService, useFactory: mockLeaveBalancesService },
      ],
    }).compile();

    service = module.get<TimeOffRequestsService>(TimeOffRequestsService);
    repo = module.get(TimeOffRequestRepository);
    lbService = module.get(LeaveBalancesService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto: CreateTimeOffRequestDto = {
      employee_id: 1,
      location_id: 1,
      leave_type_id: 1,
      start_date: '2024-06-01',
      end_date: '2024-06-05',
      days_requested: 5,
    };

    it('creates a request when balance is sufficient', async () => {
      lbService.findByEmployeeLocationLeaveType.mockResolvedValue({ balance: 10 });
      const req = stubRequest();
      repo.create.mockReturnValue(req);
      repo.save.mockResolvedValue(req);

      const result = await service.create(validDto);

      expect(result).toEqual(req);
      expect(lbService.findByEmployeeLocationLeaveType).toHaveBeenCalledWith(1, 1, 1);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      lbService.findByEmployeeLocationLeaveType.mockResolvedValue({ balance: 3 });
      await expect(service.create({ ...validDto, days_requested: 5 })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when start_date is after end_date', async () => {
      await expect(
        service.create({ ...validDto, start_date: '2024-06-10', end_date: '2024-06-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no balance record exists for the combination', async () => {
      lbService.findByEmployeeLocationLeaveType.mockResolvedValue(null);
      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when request does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('deducts balance when PENDING request is APPROVED', async () => {
      const req = stubRequest({ status: TimeOffRequestStatus.PENDING });
      repo.findOne.mockResolvedValue(req);
      lbService.deductBalance.mockResolvedValue({ balance: 5 });
      repo.save.mockResolvedValue({ ...req, status: TimeOffRequestStatus.APPROVED });

      const dto: UpdateTimeOffRequestStatusDto = { status: TimeOffRequestStatus.APPROVED };
      await service.updateStatus(1, dto);

      expect(lbService.deductBalance).toHaveBeenCalledWith(
        req.employee.id, req.location.id, req.leave_type.id, Number(req.days_requested),
      );
    });

    it('restores balance when APPROVED request is REJECTED', async () => {
      const req = stubRequest({ status: TimeOffRequestStatus.APPROVED });
      repo.findOne.mockResolvedValue(req);
      lbService.restoreBalance.mockResolvedValue({ balance: 10 });
      repo.save.mockResolvedValue({ ...req, status: TimeOffRequestStatus.REJECTED });

      const dto: UpdateTimeOffRequestStatusDto = { status: TimeOffRequestStatus.REJECTED };
      await service.updateStatus(1, dto);

      expect(lbService.restoreBalance).toHaveBeenCalledWith(
        req.employee.id, req.location.id, req.leave_type.id, Number(req.days_requested),
      );
    });

    it('restores balance when APPROVED request is CANCELLED', async () => {
      const req = stubRequest({ status: TimeOffRequestStatus.APPROVED });
      repo.findOne.mockResolvedValue(req);
      lbService.restoreBalance.mockResolvedValue({ balance: 10 });
      repo.save.mockResolvedValue({ ...req, status: TimeOffRequestStatus.CANCELLED });

      const dto: UpdateTimeOffRequestStatusDto = { status: TimeOffRequestStatus.CANCELLED };
      await service.updateStatus(1, dto);

      expect(lbService.restoreBalance).toHaveBeenCalledWith(
        req.employee.id, req.location.id, req.leave_type.id, Number(req.days_requested),
      );
    });

    it('throws ConflictException when trying to change a CANCELLED request', async () => {
      const req = stubRequest({ status: TimeOffRequestStatus.CANCELLED });
      repo.findOne.mockResolvedValue(req);

      await expect(
        service.updateStatus(1, { status: TimeOffRequestStatus.APPROVED }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
