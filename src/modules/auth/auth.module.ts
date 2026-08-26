import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersModule } from '../users/users.module.js';
import { JwtModule } from '@nestjs/jwt';
import { OtpModule } from '../otp/otp.module.js';
import { TokenService } from './services/token.service.js';
import { AccountActivationService } from './services/account-activation.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionsService } from './services/sessions.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    UsersModule,
    OtpModule,
    AuditModule,
    MailModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '2h') as any },
    }),
  ],
  providers: [
    AuthService,
    TokenService,
    AccountActivationService,
    PasswordService,
    SessionsService,
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenService, PasswordService, SessionsService],
})
export class AuthModule {}
