import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';

export enum GenderType {
  M = 'M',
  F = 'F',
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Nombre(s)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ example: 'García', description: 'Apellido paterno' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  paternal_last_name?: string;

  @ApiPropertyOptional({ example: 'López', description: 'Apellido materno' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  maternal_last_name?: string;

  @ApiPropertyOptional({
    example: '2000-01-15',
    description: 'Fecha de nacimiento (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @ApiPropertyOptional({ enum: GenderType, description: 'Género' })
  @IsOptional()
  @IsEnum(GenderType)
  gender?: GenderType;

  @ApiPropertyOptional({
    example: 'Calle Reforma 123, CDMX',
    description: 'Dirección',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  address?: string;

  @ApiPropertyOptional({
    example: '5512345678',
    description: 'Teléfono (10 dígitos)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  phone?: string;
}
