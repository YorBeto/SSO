import { Controller, Get, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';

@ApiTags('Admin')
@Controller('auth/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar auditoría de eventos de autenticación' })
  @ApiResponse({ status: 200, description: 'Auditoría obtenida exitosamente' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async getAuditLogs(@Query() query: AuditQueryDto) {
    return this.auditService.getAuditLogs(query);
  }
}