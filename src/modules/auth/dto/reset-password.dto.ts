import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'usuario@vitalid.com',
    description: 'Correo registrado',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email!: string;

  @ApiProperty({ example: '123456', description: 'Código OTP de recuperación' })
  @IsString()
  @IsNotEmpty({ message: 'El código OTP es requerido' })
  token!: string;

  @ApiProperty({ example: 'NewPassword123!', description: 'Nueva contraseña' })
  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  new_password!: string;
}
