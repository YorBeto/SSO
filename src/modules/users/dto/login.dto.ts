import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'juan.perez@email.com',
    description: 'Correo electrónico registrado',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  password!: string;
}
