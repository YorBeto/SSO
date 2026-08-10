import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH-005',
        message: 'Token de acceso no proporcionado. Por favor inicia sesión',
        error: 'Unauthorized',
      });
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'SecretKey',
      });
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH-006',
        message: 'El token de acceso es inválido o ha expirado. Inicia sesión nuevamente',
        error: 'Unauthorized',
      });
    }

    // ── Verificar que la sesión sigue activa en la BD ──
    // Si el jti fue revocado (sesión cerrada remotamente), rechazar aunque el JWT sea válido
    if (payload.jti) {
      const session = await this.prisma.active_sessions.findFirst({
        where: {
          access_token_jti: payload.jti,
          expires_at: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException({
          code: 'AUTH-007',
          message: 'La sesión ha sido cerrada. Por favor inicia sesión nuevamente',
          error: 'Unauthorized',
        });
      }
    }

    // Asignar el payload decodificado a request['user']
    request['user'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
