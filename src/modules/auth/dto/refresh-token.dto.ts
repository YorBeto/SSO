import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token otorgado durante el login o último refresh',
  })
  @IsString()
  @IsNotEmpty({ message: 'El refresh_token es obligatorio.' })
  refresh_token!: string;
}
