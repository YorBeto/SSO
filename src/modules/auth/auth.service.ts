import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginDto } from './dto/logint.dto.js';
import * as bcrypt from 'bcrypt';
import { TokenService } from './services/token.service.js';
import { OtpService } from '../otp/otp.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../../modules/mail/mail.service.js'; // Ajusta la ruta relativa según el archivo@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,

    private readonly mailService: MailService,
    private readonly auditService: AuditService, // <-- Inyectar AuditService
  ) {}

  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.prisma.users.findUnique({
      where: { email },
      include: { persons: true },
    });

    if (!user) {
      await this.auditService.logEvent('LOGIN_FAILED', {
        email,
        details: 'Usuario no encontrado',
      });

      throw new UnauthorizedException({
        code: 'AUTH-001',
        message: 'El correo electrónico o la contraseña son incorrectos',
        error: 'Unauthorized',
      });
    }

    if (!user.is_active) {
      await this.auditService.logEvent('LOGIN_FAILED', {
        userId: user.id,
        email: user.email,
        details: 'Intento de login con cuenta inactiva',
      });

      throw new UnauthorizedException({
        code: 'AUTH-003',
        message: 'Esta cuenta se encuentra desactivada. Contacta al soporte técnico',
        error: 'Unauthorized',
      });
    }

    if (user.blocked_until && new Date() < new Date(user.blocked_until)) {
      await this.auditService.logEvent('LOCKED', {
        userId: user.id,
        email: user.email,
        details: 'Intento de login con cuenta bloqueada temporalmente',
      });

      throw new HttpException(
        {
          code: 'AUTH-010',
          message: 'Tu cuenta ha sido bloqueada temporalmente por demasiados intentos fallidos. Intenta nuevamente más tarde',
          error: 'Locked',
        },
        HttpStatus.LOCKED,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await this.prisma.users.update({
        where: { id: user.id },
        data: { failed_attempts: (user.failed_attempts || 0) + 1 },
      });

      await this.auditService.logEvent('LOGIN_FAILED', {
        userId: user.id,
        email: user.email,
        details: 'Contraseña incorrecta',
      });

      throw new UnauthorizedException({
        code: 'AUTH-001',
        message: 'El correo electrónico o la contraseña son incorrectos',
        error: 'Unauthorized',
      });
    }

    await this.prisma.users.update({
      where: { id: user.id },
      data: { failed_attempts: 0, last_login_at: new Date() },
    });

    // 2FA Requerido
    if (user.two_factor_method) {
      const otpCode = await this.otpService.generateOtp(user.id);

      await this.mailService.sendMail({
        to: user.email,
        subject: 'Código de Verificación (2FA) - Vital ID',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Hola, ${user.persons?.first_name || 'Usuario'}</h2>
            <p>Se ha detectado un inicio de sesión. Tu código de verificación 2FA es:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
            </div>
            <p>Este código expira en 3 minutos.</p>
          </div>
        `,
      });

      await this.auditService.logEvent('OTP_REQUESTED', {
        userId: user.id,
        email: user.email,
        details: 'OTP generado para reto 2FA en inicio de sesión',
      });

      throw new HttpException(
        {
          requires_2fa: true,
          session_id: user.id,
          message: 'Se requiere autenticación de dos factores. Código OTP enviado a tu correo.',
        },
        HttpStatus.ACCEPTED,
      );
    }

    // Login Exitoso (sin 2FA)
    await this.auditService.logEvent('LOGIN_SUCCESS', {
      userId: user.id,
      email: user.email,
      details: 'Inicio de sesión exitoso',
    });

    const { accessToken, refreshToken } =
      await this.tokenService.createAndStoreTokens(
        user.id,
        user.email,
        user.persons,
      );

    const userPerson = user as typeof user & { persons: any };

    return {
      requires_2fa: false,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: userPerson.persons.id,
        first_name: userPerson.persons.first_name,
        paternal_last_name: userPerson.persons.paternal_last_name,
        maternal_last_name: userPerson.persons.maternal_last_name,
        birth_date: userPerson.persons.birth_date,
        gender: userPerson.persons.gender,
        address: userPerson.persons.address,
        email: userPerson.email,
        phone: userPerson.phone,
        two_factor_enabled: userPerson.two_factor_method,
        is_active: userPerson.is_active,
        last_login_at: userPerson.last_login_at,
        created_at: userPerson.created_at,
        updated_at: userPerson.updated_at,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { persons: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.persons.id,
      first_name: user.persons.first_name,
      paternal_last_name: user.persons.paternal_last_name,
      maternal_last_name: user.persons.maternal_last_name,
      birth_date: user.persons.birth_date,
      gender: user.persons.gender,
      address: user.persons.address,
      email: user.email,
      phone: user.phone,
      two_factor_enabled: user.two_factor_method,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    await this.tokenService.revokeTokens(userId, refreshToken);

    await this.auditService.logEvent('LOGOUT', {
      userId,
      details: 'Cierre de sesión realizado',
    });

    return {
      success: true,
      message: 'Sesión cerrada exitosamente.',
    };
  }
}