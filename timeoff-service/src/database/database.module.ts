import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Employee } from './entities/employee.entity';
import { Location } from './entities/location.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { SyncLog } from './entities/sync-log.entity';

import { EmployeeRepository } from './repositories/employee.repository';
import { LocationRepository } from './repositories/location.repository';
import { LeaveTypeRepository } from './repositories/leave-type.repository';
import { LedgerEntryRepository } from './repositories/ledger-entry.repository';
import { TimeOffRequestRepository } from './repositories/time-off-request.repository';
import { SyncLogRepository } from './repositories/sync-log.repository';

const ENTITIES = [Employee, Location, LeaveType, LedgerEntry, TimeOffRequest, SyncLog];
const REPOSITORIES = [
  EmployeeRepository,
  LocationRepository,
  LeaveTypeRepository,
  LedgerEntryRepository,
  TimeOffRequestRepository,
  SyncLogRepository,
];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: REPOSITORIES,
  exports: REPOSITORIES,
})
export class DatabaseModule {}
