import { IsNumber, IsInt, IsPositive, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTimeOffRequestDto {
  @ApiProperty({ example: 1, description: 'Employee ID making the request' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  employee_id: number;

  @ApiProperty({ example: 1, description: 'Location ID for the request' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  location_id: number;

  @ApiProperty({ example: 1, description: 'Leave Type ID (e.g. 1=Vacation, 2=Sick)' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  leave_type_id: number;

  @ApiPropertyOptional({ example: 5, description: 'Manager Employee ID (optional)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  manager_id?: number;

  @ApiProperty({ example: '2024-06-01', description: 'Start date of the time off (YYYY-MM-DD)' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2024-06-05', description: 'End date of the time off (YYYY-MM-DD)' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ example: 5, description: 'Number of working days requested' })
  @IsNumber()
  @Min(0.5)
  @Type(() => Number)
  days_requested: number;
}
