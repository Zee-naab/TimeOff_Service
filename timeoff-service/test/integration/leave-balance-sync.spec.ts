import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../src/database/database.module';
import { EmployeesModule } from '../../src/modules/employees/employees.module';
import { LocationsModule } from '../../src/modules/locations/locations.module';
import { LeaveTypesModule } from '../../src/modules/leave-types/leave-types.module';
import { LeaveBalancesModule } from '../../src/modules/leave-balances/leave-balances.module';
import { SyncModule } from '../../src/modules/sync/sync.module';

import { Employee } from '../../src/database/entities/employee.entity';
import { Location } from '../../src/database/entities/location.entity';
import { LeaveType } from '../../src/database/entities/leave-type.entity';
import { LedgerEntry } from '../../src/database/entities/ledger-entry.entity';
import { TimeOffRequest } from '../../src/database/entities/time-off-request.entity';
import { SyncLog, SyncStatus } from '../../src/database/entities/sync-log.entity';

import { EmployeesService } from '../../src/modules/employees/employees.service';
import { LocationsService } from '../../src/modules/locations/locations.service';
import { LeaveTypesService } from '../../src/modules/leave-types/leave-types.service';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { SyncService } from '../../src/modules/sync/sync.service';

jest.setTimeout(30000);

describe('Leave Balance Sync (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let httpService: HttpService;

  let employeesService: EmployeesService;
  let locationsService: LocationsService;
  let leaveTypesService: LeaveTypesService;
  let leaveBalancesService: LeaveBalancesService;
  let syncService: SyncService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ HCM_BASE_URL: 'http://localhost:4000', HCM_API_KEY: 'mock-hcm-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Employee, Location, LeaveType, LedgerEntry, TimeOffRequest, SyncLog],
          synchronize: true,
        }),
        DatabaseModule,
        EmployeesModule,
        LocationsModule,
        LeaveTypesModule,
        LeaveBalancesModule,
        SyncModule,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    httpService = module.get<HttpService>(HttpService);

    employeesService = module.get<EmployeesService>(EmployeesService);
    locationsService = module.get<LocationsService>(LocationsService);
    leaveTypesService = module.get<LeaveTypesService>(LeaveTypesService);
    leaveBalancesService = module.get<LeaveBalancesService>(LeaveBalancesService);
    syncService = module.get<SyncService>(SyncService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM sync_logs');
    await dataSource.query('DELETE FROM ledger_entries');
    await dataSource.query('DELETE FROM time_off_requests');
    await dataSource.query('DELETE FROM employees');
    await dataSource.query('DELETE FROM locations');
    await dataSource.query('DELETE FROM leave_types');
  });

  async function createTestData() {
    const employee = await employeesService.create({ name: 'Alice', email: 'alice@test.com' });
    const location = await locationsService.create({ name: 'Berlin' });
    const leaveType = await leaveTypesService.create({ name: 'Vacation' });
    return { employee, location, leaveType };
  }

  it('syncs a realtime balance from HCM and updates the local ledger', async () => {
    const { employee, location, leaveType } = await createTestData();
    await leaveBalancesService.create({
      employee_id: employee.id,
      location_id: location.id,
      leave_type_id: leaveType.id,
      balance: 10,
    });

    jest.spyOn(httpService, 'get').mockReturnValue(
      of({ data: { success: true, employeeId: employee.id, locationId: location.id, leaveTypeId: leaveType.id, balance: 15 } } as any),
    );

    const log = await syncService.syncRealtime(employee.id, location.id, leaveType.id);
    expect(log.status).toBe(SyncStatus.SUCCESS);

    const updated = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(updated?.balance)).toBe(15);
  });

  it('syncs all balances via batch and updates every local ledger record', async () => {
    const { employee, location, leaveType } = await createTestData();
    const leaveType2 = await leaveTypesService.create({ name: 'Sick' });

    await leaveBalancesService.create({ employee_id: employee.id, location_id: location.id, leave_type_id: leaveType.id, balance: 5 });
    await leaveBalancesService.create({ employee_id: employee.id, location_id: location.id, leave_type_id: leaveType2.id, balance: 3 });

    jest.spyOn(httpService, 'post').mockReturnValue(
      of({
        data: {
          success: true,
          balances: [
            { employeeId: employee.id, locationId: location.id, leaveTypeId: leaveType.id, balance: 20 },
            { employeeId: employee.id, locationId: location.id, leaveTypeId: leaveType2.id, balance: 10 },
          ],
        },
      } as any),
    );

    const log = await syncService.syncBatch();
    expect(log.status).toBe(SyncStatus.SUCCESS);

    const b1 = await leaveBalancesService.findByEmployeeLocationLeaveType(employee.id, location.id, leaveType.id);
    const b2 = await leaveBalancesService.findByEmployeeLocationLeaveType(employee.id, location.id, leaveType2.id);

    expect(Number(b1?.balance)).toBe(20);
    expect(Number(b2?.balance)).toBe(10);
  });

  it('reflects a work anniversary bonus after a realtime sync from HCM', async () => {
    const { employee, location, leaveType } = await createTestData();
    await leaveBalancesService.create({
      employee_id: employee.id,
      location_id: location.id,
      leave_type_id: leaveType.id,
      balance: 10,
    });

    jest.spyOn(httpService, 'get').mockReturnValue(
      of({ data: { success: true, employeeId: employee.id, locationId: location.id, leaveTypeId: leaveType.id, balance: 15 } } as any),
    );

    await syncService.syncRealtime(employee.id, location.id, leaveType.id);

    const after = await leaveBalancesService.findByEmployeeLocationLeaveType(
      employee.id, location.id, leaveType.id,
    );
    expect(Number(after?.balance)).toBe(15);
    expect(Number(after?.balance)).toBeGreaterThan(10);
  });
});
