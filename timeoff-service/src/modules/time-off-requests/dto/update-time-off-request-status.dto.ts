import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TimeOffRequestStatus } from '../time-off-request.entity';

export class UpdateTimeOffRequestStatusDto {
  @ApiProperty({
    enum: TimeOffRequestStatus,
    example: TimeOffRequestStatus.APPROVED,
    description: 'New status for the time off request',
  })
  @IsEnum(TimeOffRequestStatus)
  @IsNotEmpty()
  status: TimeOffRequestStatus;
}
