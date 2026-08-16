import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendCodeDto {
  @ApiProperty({
    example: 'morales25072005@gmail.com',
    description: 'Correo del usuario',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty()
  email!: string;
}
