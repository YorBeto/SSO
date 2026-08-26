import { IsEmail, IsNotEmpty, IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class RegisterAdminDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  first_name: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  paternal_last_name: string;

  @IsString()
  @IsOptional()
  maternal_last_name?: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @Matches(/^[0-9]{10}$/, { message: 'El teléfono debe tener exactamente 10 dígitos numéricos' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  birth_date: string;

  @IsString()
  @IsNotEmpty({ message: 'El género es obligatorio' })
  gender: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  two_factor_enabled?: boolean;
}
