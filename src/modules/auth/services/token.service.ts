import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createAndStoreTokens(userId: string, email: string, person: any, deviceName?: string) {
    const jti = randomUUID();
    const payload = {
      sub: userId,
      email,
      jti,
      person_id: person?.id || person, // Soporta recibir la entidad o solo la cadena de ID
      firstName: person?.first_name || '',
      paternalLastName: person?.paternal_last_name || '',
      maternalLastName: person?.maternal_last_name || '',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'SecretKey',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'RefreshSecretKey',
      expiresIn: '7d',
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 1. Guardar refresh_token
    const createdRefreshToken = await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // 2. Guardar sesión activa en active_sessions
    await this.prisma.active_sessions.create({
      data: {
        user_id: userId,
        access_token_jti: jti,
        refresh_token_id: createdRefreshToken.id,
        device_name: deviceName || 'Navegador Web (Chrome/Edge)',
        last_activity_at: new Date(),
        expires_at: expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string, deviceName?: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'RefreshSecretKey',
      });
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH-006',
        message: 'El token de refresco es inválido o ha expirado.',
        error: 'Unauthorized',
      });
    }

    const activeTokens = await this.prisma.refresh_tokens.findMany({
      where: {
        user_id: payload.sub,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    let matchedTokenRecord: typeof activeTokens[number] | null = null;

    for (const record of activeTokens) {
      const isValid = await bcrypt.compare(refreshToken, record.token_hash);
      if (isValid) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException({
        code: 'AUTH-006',
        message: 'El token de refresco no es válido o ya fue revocado.',
        error: 'Unauthorized',
      });
    }

    // ── Verificar que la sesión activa asociada al refresh token aún existe.
    // Si fue revocada remotamente (delete de active_sessions), rechazar el refresh
    // en lugar de crear una sesión nueva duplicada.
    const existingSession = await this.prisma.active_sessions.findFirst({
      where: { refresh_token_id: matchedTokenRecord.id },
    });

    if (!existingSession) {
      // La sesión fue revocada remotamente. Revocar el refresh token también por seguridad.
      await this.prisma.refresh_tokens.update({
        where: { id: matchedTokenRecord.id },
        data: { revoked_at: new Date() },
      });
      throw new UnauthorizedException({
        code: 'AUTH-007',
        message: 'La sesión ha sido revocada. Por favor inicia sesión nuevamente.',
        error: 'Unauthorized',
      });
    }

    // 💡 Traemos al usuario incluyendo la relación de 'persons' para regenerar el token completo
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      include: { persons: true },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException({
        code: 'AUTH-003',
        message: 'Usuario no encontrado o cuenta inactiva.',
        error: 'Unauthorized',
      });
    }

    // Revocar el refresh token anterior
    await this.prisma.refresh_tokens.update({
      where: { id: matchedTokenRecord.id },
      data: { revoked_at: new Date() },
    });

    const jti = randomUUID();
    const newPayload = {
      sub: user.id,
      email: user.email,
      jti,
      person_id: user.persons?.id || user.id,
      firstName: user.persons?.first_name || '',
      paternalLastName: user.persons?.paternal_last_name || '',
      maternalLastName: user.persons?.maternal_last_name || '',
    };

    const accessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_SECRET || 'SecretKey',
      expiresIn: '15m',
    });

    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_REFRESH_SECRET || 'RefreshSecretKey',
      expiresIn: '7d',
    });

    const tokenHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const createdRefreshToken = await this.prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // Actualizar la sesión activa existente conservando el nombre del dispositivo original.
    // Si se pasa un deviceName desde el header, se actualiza también.
    await this.prisma.active_sessions.update({
      where: { id: existingSession.id },
      data: {
        access_token_jti: jti,
        refresh_token_id: createdRefreshToken.id,
        last_activity_at: new Date(),
        expires_at: expiresAt,
        ...(deviceName ? { device_name: deviceName } : {}),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async revokeTokens(userId: string, jti?: string, refreshToken?: string) {
    // 1. Si tenemos jti (identificador del access_token de la sesión actual), revocarla directamente
    if (jti) {
      const session = await this.prisma.active_sessions.findFirst({
        where: { user_id: userId, access_token_jti: jti },
      });

      if (session) {
        await this.prisma.refresh_tokens.update({
          where: { id: session.refresh_token_id },
          data: { revoked_at: new Date() },
        });

        await this.prisma.active_sessions.delete({
          where: { id: session.id },
        });
        return;
      }
    }

    // 2. Si se proporciona refreshToken explícito, revocar por hash
    if (refreshToken) {
      const activeTokens = await this.prisma.refresh_tokens.findMany({
        where: { user_id: userId, revoked_at: null },
      });

      for (const record of activeTokens) {
        const isValid = await bcrypt.compare(refreshToken, record.token_hash);
        if (isValid) {
          await this.prisma.refresh_tokens.update({
            where: { id: record.id },
            data: { revoked_at: new Date() },
          });

          await this.prisma.active_sessions.deleteMany({
            where: { refresh_token_id: record.id },
          });
          return;
        }
      }
    }

    // 3. Fallback: Revocar todas las sesiones del usuario si no se especifica jti ni refreshToken
    await this.prisma.refresh_tokens.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    await this.prisma.active_sessions.deleteMany({
      where: { user_id: userId },
    });
  }
}