import { Module } from '@nestjs/common';
import { PersonsModule } from './modules/persons/persons.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OtpModule } from './modules/otp/otp.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { PrismaModule } from './prisma/prisma.module.js';


@Module({
  imports: [PersonsModule, UsersModule, AuthModule, OtpModule, AuditModule, PrismaModule],
})
export class AppModule {}
