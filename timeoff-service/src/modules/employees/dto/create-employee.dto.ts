import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Full name of the employee' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'jane.doe@company.com', description: 'Unique email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
