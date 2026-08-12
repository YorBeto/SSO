import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { gender_type } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan', description: 'Nombre(s) del usuario' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Za-z\u00E1-\u00FC\s'-]+$/, {
    message: 'El nombre solo debe contener letras.',
  })
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido paterno' })
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  @Matches(/^[A-Za-z\u00E1-\u00FC\s'-]+$/, {
    message: 'El apellido paterno solo debe contener letras.',
  })
  @IsNotEmpty()
  paternal_last_name!: string;

  @ApiPropertyOptional({ example: 'García', description: 'Apellido materno' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  @Matches(/^[A-Za-z\u00E1-\u00FC\s'-]*$/)
  maternal_last_name?: string;

  @ApiProperty({ example: 'juan.perez@email.com' })
  @IsEmail()
  @MinLength(5)
  @MaxLength(60)
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description:
      'Mínimo 12 caracteres con mayúscula, minúscula, número y especial',
  })
  @IsString()
  @MinLength(12, {
    message: 'AUTH-008: La contraseña debe tener al menos 12 caracteres',
  })
  @MaxLength(255)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'AUTH-008: La contraseña debe incluir mayúscula, minúscula, número y carácter especial',
  })
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: '1990-05-15', description: 'YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe cumplir con el formato YYYY-MM-DD',
  })
  @IsNotEmpty()
  birth_date!: string;

  @ApiProperty({ enum: ['M', 'F', 'Otro'], example: 'M' })
  @IsEnum(gender_type, { message: 'El género debe ser M, F u Otro' })
  @IsNotEmpty()
  gender!: gender_type;

  @ApiPropertyOptional({ example: 'Calle Principal #123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9\u00E1-\u00FC\s'\-\.,#]*$/)
  address?: string;

  @ApiPropertyOptional({
    example: '+525541234567',
    description: 'Formato internacional',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'El teléfono debe cumplir el formato E.164 (Ejemplo: +528711234567)',
  })
  phone!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  two_factor_enabled?: boolean;
}
