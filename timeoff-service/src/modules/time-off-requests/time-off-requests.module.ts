import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    LeaveBalancesModule,
  ],
  providers: [TimeOffRequestsService],
  controllers: [TimeOffRequestsController],
  exports: [TimeOffRequestsService],
})
export class TimeOffRequestsModule {}
