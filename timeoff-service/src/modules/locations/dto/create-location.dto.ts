import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ example: 'New York', description: 'Name of the office location' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}
