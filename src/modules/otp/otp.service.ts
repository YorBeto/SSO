import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OtpService {
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un nuevo código OTP de 6 dígitos e invalida los anteriores.
   */
  async generateOtp(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 1. Invalida/Quema automáticamente los códigos anteriores pendientes de este usuario
    await this.prisma.otp_codes.updateMany({
      where: {
        user_id: userId,
        is_used: false,
      },
      data: {
        is_used: true,
      },
    });

    // 2. Registra el nuevo código activo con 0 intentos
    await this.prisma.otp_codes.create({
      data: {
        user_id: userId,
        code: code,
        expires_at: expiresAt,
        is_used: false,
        attempts: 0,
      },
    });

    return code;
  }

  /**
   * Valida un código OTP enviado por el usuario y gestiona contadores/expiración.
   */
  async validateOtp(userId: string, code: string): Promise<string> {
    // Buscar el OTP activo más reciente para este usuario
    const otpRecord = await this.prisma.otp_codes.findFirst({
      where: {
        user_id: userId,
        is_used: false,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException({
        code: 'AUTH-015',
        message: 'No hay ningún código de activación pendiente o válido.',
        error: 'Bad Request',
      });
    }

    const currentAttempts = otpRecord.attempts ?? 0;

    // Validar si superó el número de intentos permitidos
    if (currentAttempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'AUTH-018',
        message:
          'Has superado el número máximo de intentos permitidos (3/3). Solicita un nuevo código.',
        error: 'Bad Request',
      });
    }

    // Validar expiración del código
    if (new Date() > new Date(otpRecord.expires_at)) {
      throw new BadRequestException({
        code: 'AUTH-016',
        message: 'El código de activación ha expirado. Solicita uno nuevo.',
        error: 'Bad Request',
      });
    }

    // Validar coincidencia del código
    if (otpRecord.code !== code) {
      const updatedAttempts = currentAttempts + 1;
      const remainingAttempts = this.MAX_ATTEMPTS - updatedAttempts;

      // Incrementar intentos en la BD
      await this.prisma.otp_codes.update({
        where: { id: otpRecord.id },
        data: { attempts: updatedAttempts },
      });

      if (remainingAttempts <= 0) {
        throw new BadRequestException({
          code: 'AUTH-018',
          message: 'Código incorrecto. Has alcanzado el límite de 3 intentos.',
          error: 'Bad Request',
          remaining_attempts: 0,
        });
      }

      throw new BadRequestException({
        code: 'AUTH-015',
        message: `El código de activación ingresado no es válido. Te quedan ${remainingAttempts} intento(s).`,
        error: 'Bad Request',
        remaining_attempts: remainingAttempts,
      });
    }

    return otpRecord.id;
  }

  /**
   * Retorna la promesa para marcar el OTP como usado en la transacción.
   */
  markAsUsed(otpId: string) {
    return this.prisma.otp_codes.update({
      where: { id: otpId },
      data: { is_used: true },
    });
  }
}
