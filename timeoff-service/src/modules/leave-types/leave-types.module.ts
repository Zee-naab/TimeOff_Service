import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveType } from './leave-type.entity';
import { LeaveTypesService } from './leave-types.service';
import { LeaveTypesController } from './leave-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType])],
  providers: [LeaveTypesService],
  controllers: [LeaveTypesController],
  exports: [LeaveTypesService],
})
export class LeaveTypesModule {}
