import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SyncLog } from './sync-log.entity';
import { LeaveBalance } from '../leave-balances/leave-balance.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncLog, LeaveBalance]),
    HttpModule,
  ],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
