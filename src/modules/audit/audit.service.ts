import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';
import { audit_event_type } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el historial de eventos de auditoría paginado y filtrado.
   */
  async getAuditLogs(query: AuditQueryDto) {
    const { page = 1, limit = 20, user_id, event, from_date, to_date } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (user_id) {
      where.user_id = user_id;
    }

    if (event) {
      where.event = event as audit_event_type;
    }

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) {
        where.created_at.gte = new Date(from_date);
      }
      if (to_date) {
        where.created_at.lte = new Date(to_date);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auth_audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.auth_audit_logs.count({ where }),
    ]);

    const total_pages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages,
      },
    };
  }

  /**
   * Método auxiliar para registrar eventos de auditoría en la BD.
   */
  async logEvent(
    event: audit_event_type | string,
    params: {
      userId?: string;
      email?: string;
      phone?: string;
      ipAddress?: string;
      userAgent?: string;
      details?: string;
    },
  ) {
    try {
      // Concatenar el contexto (email/phone/IP/UserAgent) dentro de details
      const contextInfo = [
        params.email ? `Email: ${params.email}` : null,
        params.phone ? `Phone: ${params.phone}` : null,
        params.ipAddress ? `IP: ${params.ipAddress}` : null,
        params.userAgent ? `Agent: ${params.userAgent}` : null,
        params.details,
      ]
        .filter(Boolean)
        .join(' | ');

      // Construcción del objeto compatible con el tipo que espera Prisma
      const dataToCreate: any = {
        event: event as audit_event_type,
        details: contextInfo || null,
      };

      if (params.userId) {
        dataToCreate.user_id = params.userId;
      }

      await this.prisma.auth_audit_logs.create({
        data: dataToCreate,
      });
    } catch (error) {
      console.error('Error guardando audit log:', error);
    }
  }
}