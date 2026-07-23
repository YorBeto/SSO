import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum AuditEventEnum {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  OTP_REQUESTED = 'OTP_REQUESTED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',
  LOGOUT = 'LOGOUT',
  LOCKED = 'LOCKED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
}

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1, description: 'Número de página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Registros por página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por UUID de usuario' })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ enum: AuditEventEnum, description: 'Tipo de evento' })
  @IsOptional()
  @IsEnum(AuditEventEnum)
  event?: AuditEventEnum;

  @ApiPropertyOptional({ description: 'Fecha de inicio (ISO String)' })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (ISO String)' })
  @IsOptional()
  @IsString()
  to_date?: string;
}