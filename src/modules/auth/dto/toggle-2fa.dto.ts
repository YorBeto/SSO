import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class Toggle2FADto {
  @ApiProperty({
    example: true,
    description: 'true para activar 2FA, false para desactivarlo',
  })
  @IsBoolean()
  enabled!: boolean;
}
