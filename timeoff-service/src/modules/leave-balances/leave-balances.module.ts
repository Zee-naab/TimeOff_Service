import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';

@Module({
  imports: [DatabaseModule],
  providers: [LeaveBalancesService],
  controllers: [LeaveBalancesController],
  exports: [LeaveBalancesService],
})
export class LeaveBalancesModule {}
