import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createAndStoreTokens(userId: string, email: string, personId: string) {
    const payload = { sub: userId, email, person_id: personId };

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

    await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string) {
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

    await this.prisma.refresh_tokens.update({
      where: { id: matchedTokenRecord.id },
      data: { revoked_at: new Date() },
    });

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException({
        code: 'AUTH-003',
        message: 'Usuario no encontrado o cuenta inactiva.',
        error: 'Unauthorized',
      });
    }

    const tokens = await this.createAndStoreTokens(user.id, user.email, user.person_id);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async revokeTokens(userId: string, refreshToken?: string) {
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
          break;
        }
      }
    } else {
      await this.prisma.refresh_tokens.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
  }
}