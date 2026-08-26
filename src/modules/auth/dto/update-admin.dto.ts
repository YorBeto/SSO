import { IsEmail, IsString, IsOptional, Matches, IsBoolean } from 'class-validator';
import { Expose } from 'class-transformer';

export class UpdateAdminDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @Expose({ name: 'firstName' }) first_name?: string;
  @IsOptional() @Expose({ name: 'paternalLastName' }) paternal_last_name?: string;
  @IsOptional() @Expose({ name: 'maternalLastName' }) maternal_last_name?: string;
  @IsOptional() @Matches(/^[0-9]{10}$/) phone?: string;
  @IsOptional() @Expose({ name: 'birthDate' }) birth_date?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Expose({ name: 'isActive' }) is_active?: boolean;
}