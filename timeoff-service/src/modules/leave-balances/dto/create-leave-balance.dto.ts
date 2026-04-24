import { IsNumber, IsPositive, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLeaveBalanceDto {
  @ApiProperty({ example: 1, description: 'Employee ID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  employee_id: number;

  @ApiProperty({ example: 1, description: 'Location ID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  location_id: number;

  @ApiProperty({ example: 1, description: 'Leave Type ID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  leave_type_id: number;

  @ApiProperty({ example: 15.5, description: 'Leave balance in days' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  balance: number;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00.000Z', description: 'Last synced timestamp from HCM' })
  @IsOptional()
  last_synced_at?: Date;
}
