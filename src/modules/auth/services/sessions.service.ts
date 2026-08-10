import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todas las sesiones activas (no expiradas) del usuario.
   */
  async getSessions(userId: string, currentJti?: string) {
    const sessions = await this.prisma.active_sessions.findMany({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
      orderBy: { last_activity_at: 'desc' },
    });

    return {
      data: sessions.map((s, idx) => ({
        id: s.id,
        device_name: s.device_name ?? 'Dispositivo desconocido',
        is_current: currentJti ? s.access_token_jti === currentJti : idx === 0,
        last_activity_at: s.last_activity_at,
        expires_at: s.expires_at,
        created_at: s.created_at,
      })),
      total: sessions.length,
    };
  }

  /**
   * Revoca una sesión específica del usuario.
   * Verifica que la sesión le pertenezca antes de revocarla.
   */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.active_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException({
        code: 'AUTH-030',
        message: 'La sesión no fue encontrada',
        error: 'Not Found',
      });
    }

    if (session.user_id !== userId) {
      throw new ForbiddenException({
        code: 'AUTH-031',
        message: 'No tienes permiso para revocar esta sesión',
        error: 'Forbidden',
      });
    }

    // Revocar el refresh_token asociado
    await this.prisma.refresh_tokens.update({
      where: { id: session.refresh_token_id },
      data: { revoked_at: new Date() },
    });

    // Eliminar la sesión activa
    await this.prisma.active_sessions.delete({
      where: { id: sessionId },
    });

    return {
      success: true,
      message: 'Sesión cerrada exitosamente',
    };
  }

  /**
   * Revoca todas las sesiones activas del usuario.
   */
  async revokeAllSessions(userId: string) {
    const sessions = await this.prisma.active_sessions.findMany({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
    });

    const refreshTokenIds = sessions.map((s) => s.refresh_token_id);

    // Revocar todos los refresh tokens asociados
    if (refreshTokenIds.length > 0) {
      await this.prisma.refresh_tokens.updateMany({
        where: { id: { in: refreshTokenIds }, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }

    // Eliminar todas las sesiones activas
    await this.prisma.active_sessions.deleteMany({
      where: { user_id: userId },
    });

    return {
      success: true,
      message: `${sessions.length} sesión(es) cerrada(s) exitosamente`,
      closed_count: sessions.length,
    };
  }
}
