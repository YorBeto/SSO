import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { OtpModule } from '../otp/otp.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [OtpModule, MailModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
