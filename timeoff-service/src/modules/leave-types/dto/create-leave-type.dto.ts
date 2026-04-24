import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Vacation', description: 'Name of the leave type (e.g. Vacation, Sick, Personal)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}
