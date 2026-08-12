import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { OtpService } from '../../otp/otp.service.js';
import { AuditService } from '../../audit/audit.service.js';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../dto/reset-password.dto.js';
import { MailService } from '../../mail/mail.service.js'; // Ajusta la ruta relativa según el archivo

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly otpService: OtpService,
    private readonly auditService: AuditService, // <-- Inyectar AuditService
  ) {}

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { current_password, new_password } = dto;

    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: 'AUTH-012',
        message: 'Usuario no encontrado',
        error: 'Not Found',
      });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'AUTH-001',
        message: 'La contraseña actual es incorrecta',
        error: 'Bad Request',
      });
    }

    const isSamePassword = await bcrypt.compare(
      new_password,
      user.password_hash,
    );
    if (isSamePassword) {
      throw new BadRequestException({
        code: 'AUTH-019',
        message: 'La nueva contraseña debe ser diferente a la actual',
        error: 'Bad Request',
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    await this.auditService.logEvent('PASSWORD_CHANGE', {
      userId: user.id,
      email: user.email,
      details: 'Cambio de contraseña realizado desde perfil',
    });

    return {
      success: true,
      message: 'Contraseña cambiada exitosamente',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.prisma.users.findUnique({
      where: { email },
      include: { persons: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'AUTH-012',
        message:
          'No se encontró un usuario con el correo electrónico proporcionado',
        error: 'Not Found',
      });
    }

    const otpCode = await this.otpService.generateOtp(user.id);

    try {
      await this.mailService.sendMail({
        to: user.email,
        subject: 'Restablecimiento de Contraseña - Vital ID',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Hola, ${user.persons?.first_name || 'Usuario'} </h2>
            <p>Has solicitado restablecer tu contraseña en Vital ID. Tu token de verificación es:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
            </div>
            <p>Este token expira en 24 horas.</p>
          </div>
        `,
      });

      await this.auditService.logEvent('OTP_REQUESTED', {
        userId: user.id,
        email: user.email,
        details: 'Token de restablecimiento de contraseña solicitado',
      });
    } catch (mailError) {
      throw new BadRequestException({
        code: 'AUTH-022',
        message:
          'No se pudo enviar el correo electrónico. Verifica tu conexión e intenta nuevamente',
        error: 'Bad Request',
      });
    }

    return {
      success: true,
      message: 'Correo de restablecimiento enviado exitosamente',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, token, new_password } = dto;

    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException({
        code: 'AUTH-012',
        message:
          'No se encontró un usuario con el correo electrónico proporcionado',
        error: 'Not Found',
      });
    }

    let otpId: string;
    try {
      otpId = await this.otpService.validateOtp(user.id, token);
    } catch (error: any) {
      await this.auditService.logEvent('OTP_FAILED', {
        userId: user.id,
        email: user.email,
        details:
          'Intento fallido de restablecimiento de contraseña por token inválido/expirado',
      });

      const errorCode = error?.response?.code;
      if (errorCode === 'AUTH-016') {
        throw new BadRequestException({
          code: 'AUTH-021',
          message:
            'El token de restablecimiento ha expirado. Solicita uno nuevo',
          error: 'Bad Request',
        });
      }

      throw new BadRequestException({
        code: 'AUTH-020',
        message: 'El token de restablecimiento no es válido',
        error: 'Bad Request',
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: user.id },
        data: {
          password_hash: newHash,
          blocked_until: null,
          failed_attempts: 0,
        },
      }),
      this.otpService.markAsUsed(otpId),
    ]);

    await this.auditService.logEvent('PASSWORD_CHANGE', {
      userId: user.id,
      email: user.email,
      details: 'Contraseña restablecida exitosamente mediante token',
    });

    return {
      success: true,
      message: 'Contraseña restablecida exitosamente',
    };
  }
}
