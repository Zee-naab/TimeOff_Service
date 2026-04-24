import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncRealtimeDto } from './dto/sync-realtime.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get all sync logs' })
  @ApiResponse({ status: 200, description: 'List of all sync log entries ordered by date descending' })
  findAllLogs() {
    return this.syncService.findAllLogs();
  }

  @Post('realtime')
  @ApiOperation({ summary: 'Trigger a realtime sync for a specific employee/location/leave-type from HCM' })
  @ApiResponse({ status: 201, description: 'Sync completed, returns sync log entry' })
  syncRealtime(@Body() dto: SyncRealtimeDto) {
    return this.syncService.syncRealtime(dto.employee_id, dto.location_id, dto.leave_type_id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Trigger a full batch sync of all balances from HCM' })
  @ApiResponse({ status: 201, description: 'Batch sync completed, returns sync log entry' })
  syncBatch() {
    return this.syncService.syncBatch();
  }
}
