import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SyncRealtimeDto {
  @ApiProperty({ example: 1, description: 'Employee ID to sync' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  employee_id: number;

  @ApiProperty({ example: 1, description: 'Location ID to sync' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  location_id: number;

  @ApiProperty({ example: 1, description: 'Leave Type ID to sync' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  leave_type_id: number;
}
