import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveBalance])],
  providers: [LeaveBalancesService],
  controllers: [LeaveBalancesController],
  exports: [LeaveBalancesService],
})
export class LeaveBalancesModule {}
