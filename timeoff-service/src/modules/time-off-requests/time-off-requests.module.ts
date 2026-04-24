import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [DatabaseModule, LeaveBalancesModule],
  providers: [TimeOffRequestsService],
  controllers: [TimeOffRequestsController],
  exports: [TimeOffRequestsService],
})
export class TimeOffRequestsModule {}
