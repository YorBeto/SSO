import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({ example: 'morales25072005@gmail.com', description: 'Correo del usuario' })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Código de activación recibido por correo' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'El código debe ser de 6 dígitos numéricos.' })
  @IsNotEmpty()
  code!: string;
}