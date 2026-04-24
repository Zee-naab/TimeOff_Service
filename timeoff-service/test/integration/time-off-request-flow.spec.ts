import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EmployeesModule } from '../../src/modules/employees/employees.module';
import { LocationsModule } from '../../src/modules/locations/locations.module';
import { LeaveTypesModule } from '../../src/modules/leave-types/leave-types.module';
import { LeaveBalancesModule } from '../../src/modules/leave-balances/leave-balances.module';
import { TimeOffRequestsModule } from '../../src/modules/time-off-requests/time-off-requests.module';

import { Employee } from '../../src/modules/employees/employee.entity';
import { Location } from '../../src/modules/locations/location.entity';
import { LeaveType } from '../../src/modules/leave-types/leave-type.entity';
import { LeaveBalance } from '../../src/modules/leave-balances/leave-balance.entity';
import { TimeOffRequest, TimeOffRequestStatus } from '../../src/modules/time-off-requests/time-off-request.entity';
import { SyncLog } from '../../src/modules/sync/sync-log.entity';

import { EmployeesService } from '../../src/modules/employees/employees.service';
import { LocationsService } from '../../src/modules/locations/locations.service';
import { LeaveTypesService } from '../../src/modules/leave-types/leave-types.service';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { TimeOffRequestsService } from '../../src/modules/time-off-requests/time-off-requests.service';

jest.setTimeout(30000);

describe('Time Off Request Flow (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let employeesService: EmployeesService;
  let locationsService: LocationsService;
  let leaveTypesService: LeaveTypesService;
  let leaveBalancesService: LeaveBalancesService;
  let timeOffRequestsService: TimeOffRequestsService;

  // Shared test context
  let employee: Employee;
  let location: Location;
  let leaveType: LeaveType;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Employee, Location, LeaveType, LeaveBalance, TimeOffRequest, SyncLog],
          synchronize: true,
        }),
        EmployeesModule,
        LocationsModule,
        LeaveTypesModule,
        LeaveBalancesModule,
        TimeOffRequestsModule,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    employeesService = module.get<EmployeesService>(EmployeesService);
    locationsService = module.get<LocationsService>(LocationsService);
    leaveTypesService = module.get<LeaveTypesService>(LeaveTypesService);
    leaveBalancesService = module.get<LeaveBalancesService>(LeaveBalancesService);
    timeOffRequestsService = module.get<TimeOffRequestsService>(TimeOffRequestsService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM time_off_requests');
    await dataSource.query('DELETE FROM leave_balances');
    await dataSource.query('DELETE FROM employees');
    await dataSource.query('DELETE FROM locations');
    await dataSource.query('DELETE FROM leave_types');

    // Fresh test data every test
    employee = await employeesService.create({ name: 'Bob', email: `bob+${Date.now()}@test.com` });
    location = await locationsService.create({ name: `Office-${Date.now()}` });
    leaveType = await leaveTypesService.create({ name: `Vacation-${Date.now()}` });

    await leaveBalancesService.create({
      employee_id: employee.id,
      location_id: location.id,
      leave_type_id: leaveType.id,
      balance: 10,
    });
  });

  function makeDto(days = 5) {
    return {
      employee_id: employee.id,
      location_id: location.id,
      leave_type_id: leaveType.id,
      start_date: '2024-07-01',
      end_date: '2024-07-05',
      days_requested: days,
    };
  }

  // ─── Tests ───────────────────────────────────────────────────────────────────

  it('creates a request then approves it → balance is deducted', async () => {
    const req = await timeOffRequestsService.create(makeDto(5));
    expect(req.status).toBe(TimeOffRequestStatus.PENDING);

    await timeOffRequestsService.updateStatus(req.id, { status: TimeOffRequestStatus.APPROVED });

    const balance = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(balance?.balance)).toBe(5); // 10 - 5 = 5
  });

  it('creates a request, approves, then rejects it → balance is fully restored', async () => {
    const req = await timeOffRequestsService.create(makeDto(5));
    await timeOffRequestsService.updateStatus(req.id, { status: TimeOffRequestStatus.APPROVED });

    await timeOffRequestsService.updateStatus(req.id, { status: TimeOffRequestStatus.REJECTED });

    const balance = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(balance?.balance)).toBe(10); // restored to original
  });

  it('creates a request, approves, then cancels it → balance is fully restored', async () => {
    const req = await timeOffRequestsService.create(makeDto(5));
    await timeOffRequestsService.updateStatus(req.id, { status: TimeOffRequestStatus.APPROVED });

    await timeOffRequestsService.updateStatus(req.id, { status: TimeOffRequestStatus.CANCELLED });

    const balance = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(balance?.balance)).toBe(10);
  });

  it('throws BadRequestException when trying to create a request exceeding available balance', async () => {
    await expect(timeOffRequestsService.create(makeDto(15))).rejects.toThrow(BadRequestException);
  });

  it('prevents over-deduction: second approval fails after first depletes balance', async () => {
    // Both requests are for 8 days. Balance is 10 so both can be created (pending).
    // After the first is approved (balance = 2), the second approval must fail.
    const req1 = await timeOffRequestsService.create(makeDto(8));
    const req2 = await timeOffRequestsService.create(makeDto(8));

    await timeOffRequestsService.updateStatus(req1.id, { status: TimeOffRequestStatus.APPROVED });

    const balanceAfterFirst = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(balanceAfterFirst?.balance)).toBe(2);

    await expect(
      timeOffRequestsService.updateStatus(req2.id, { status: TimeOffRequestStatus.APPROVED }),
    ).rejects.toThrow(BadRequestException);

    const balanceUnchanged = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(balanceUnchanged?.balance)).toBe(2); // still 2, not over-deducted
  });
});
