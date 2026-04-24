import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateLeaveBalanceDto {
  @ApiPropertyOptional({ example: 12.5, description: 'Updated leave balance in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  balance?: number;

  @ApiPropertyOptional({ description: 'Last synced timestamp from HCM' })
  @IsOptional()
  last_synced_at?: Date;
}
