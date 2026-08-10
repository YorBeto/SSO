import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { OtpService } from '../../otp/otp.service.js';
import { TokenService } from './token.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { ActivateAccountDto } from '../dto/activate-account.dto.js';
import { ResendCodeDto } from '../dto/resend-code.dto.js';
import { OtpRequestDto } from '../dto/otp-request.dto.js';
import { OtpVerifyDto } from '../dto/otp-verify.dto.js';
import { MailService } from '../../mail/mail.service.js'; // Ajusta la ruta relativa según el archivo

@Injectable()
export class AccountActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService, // <-- Inyectar AuditService
  ) {}

  async activateAccount(dto: ActivateAccountDto) {
    const { email, code } = dto;

    const user = await this.prisma.users.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException({
        code: 'AUTH-012',
        message: 'No se encontró un usuario con el correo proporcionado.',
        error: 'Not Found',
      });
    }

    if (user.is_active) {
      return { message: 'La cuenta ya se encuentra activa.' };
    }

    try {
      const otpId = await this.otpService.validateOtp(user.id, code);

      await this.prisma.$transaction([
        this.prisma.users.update({
          where: { id: user.id },
          data: { is_active: true },
        }),
        this.otpService.markAsUsed(otpId),
      ]);

      await this.auditService.logEvent('OTP_VALIDATED', {
        userId: user.id,
        email: user.email,
        details: 'Cuenta activada correctamente por primera vez',
      });

      return {
        success: true,
        message: 'Cuenta activada exitosamente. Ya puedes iniciar sesión.',
      };
    } catch (error: any) {
      await this.auditService.logEvent('OTP_FAILED', {
        userId: user.id,
        email: user.email,
        details: 'Código de activación incorrecto o expirado',
      });

      if (error?.response?.remaining_attempts === 0) {
        const blockDuration = new Date();
        blockDuration.setMinutes(blockDuration.getMinutes() + 15);

        await this.prisma.users.update({
          where: { id: user.id },
          data: { blocked_until: blockDuration },
        });

        await this.auditService.logEvent('LOCKED', {
          userId: user.id,
          email: user.email,
          details: 'Cuenta bloqueada 15 minutos por fallos en activación',
        });

        throw new BadRequestException({
          code: 'AUTH-018',
          message: 'Código incorrecto. Has alcanzado el límite de 3 intentos. Tu cuenta ha sido bloqueada por 15 minutos.',
          error: 'Bad Request',
          remaining_attempts: 0,
        });
      }

      throw error;
    }
  }

  async resendActivationCode(dto: ResendCodeDto) {
    const { email } = dto;

    const user = await this.prisma.users.findUnique({
      where: { email },
      include: { persons: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'AUTH-012',
        message: 'No se encontró un usuario con el correo proporcionado.',
        error: 'Not Found',
      });
    }

    if (user.is_active) {
      throw new BadRequestException({
        code: 'AUTH-019',
        message: 'La cuenta ya se encuentra activa.',
        error: 'Bad Request',
      });
    }

    if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.blocked_until).getTime() - new Date().getTime()) / 60000,
      );
      throw new ForbiddenException({
        code: 'AUTH-004',
        message: `Cuenta bloqueada temporalmente por demasiados intentos. Intenta de nuevo en ${minutesLeft} minuto(s).`,
        error: 'Forbidden',
      });
    }

    const otpCode = await this.otpService.generateOtp(user.id);
    await this.prisma.users.update({
      where: { id: user.id },
      data: { blocked_until: null, failed_attempts: 0 },
    });

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Nuevo Código de Activación - Vital ID',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hola, ${user.persons?.first_name || 'Usuario'} </h2>
          <p>Has solicitado un nuevo código para activar tu cuenta en Vital ID:</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
          </div>
          <p>Este código expira en 24 horas.</p>
        </div>
      `,
    });

    await this.auditService.logEvent('OTP_REQUESTED', {
      userId: user.id,
      email: user.email,
      details: 'Nuevo código de activación de cuenta solicitado',
    });

    return {
      success: true,
      message: 'Se ha enviado un nuevo código de activación a tu correo electrónico.',
    };
  }

  async request2faOtp(dto: OtpRequestDto) {
    const { email } = dto;

    const user = await this.prisma.users.findUnique({
      where: { email },
      include: { persons: true },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'AUTH-012',
        message: 'No se encontró un usuario con el correo electrónico proporcionado',
        error: 'Bad Request',
      });
    }

    if (!user.two_factor_method) {
      throw new BadRequestException({
        code: 'AUTH-013',
        message: 'El usuario no tiene habilitada la autenticación de dos factores',
        error: 'Bad Request',
      });
    }

    const otpCode = await this.otpService.generateOtp(user.id);

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Código de Verificación (2FA) - Vital ID',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hola, ${user.persons?.first_name || 'Usuario'}</h2>
          <p>Tu código de verificación para completar inicio de sesión es:</p>
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
      details: 'Código OTP 2FA reenviado',
    });

    return {
      success: true,
      message: 'Código OTP enviado a tu correo electrónico',
      expires_in: 180,
      attempts_remaining: 3,
    };
  }

  async verify2faOtp(dto: OtpVerifyDto) {
    const { email, code } = dto;

    const user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'AUTH-012',
        message: 'No se encontró un usuario con el correo electrónico proporcionado',
        error: 'Bad Request',
      });
    }

    try {
      const otpId = await this.otpService.validateOtp(user.id, code);
      await this.otpService.markAsUsed(otpId);

      const { accessToken, refreshToken } =
        await this.tokenService.createAndStoreTokens(
          user.id,
          user.email,
          user.person_id,
          'Navegador Web (2FA)',
        );

      await this.auditService.logEvent('OTP_VERIFIED', {
        userId: user.id,
        email: user.email,
        details: 'Verificación 2FA exitosa, emisión de tokens',
      });

      await this.auditService.logEvent('LOGIN_SUCCESS', {
        userId: user.id,
        email: user.email,
        details: 'Inicio de sesión completado con 2FA',
      });

      return {
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900,
      };
    } catch (error) {
      await this.auditService.logEvent('OTP_FAILED', {
        userId: user.id,
        email: user.email,
        details: 'Fallo al verificar código OTP de 2FA',
      });
      throw error;
    }
  }
}