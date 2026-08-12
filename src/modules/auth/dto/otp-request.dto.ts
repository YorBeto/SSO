import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({
    example: 'juan.perez@email.com',
    description: 'Correo electrónico',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email!: string;
}
