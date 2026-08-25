import {
  Controller,
  Get,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Admin')
@Controller('auth/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Consultar el historial de auditoría del usuario autenticado (no existe rol admin en este servicio: siempre se filtra por el propio usuario)',
  })
  @ApiResponse({ status: 200, description: 'Auditoría obtenida exitosamente' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async getAuditLogs(@Req() req: any, @Query() query: AuditQueryDto) {
    // No se permite consultar el log de otro usuario: se ignora cualquier
    // user_id recibido en el query y se fuerza al del usuario autenticado.
    return this.auditService.getAuditLogs({ ...query, user_id: req.user?.sub });
  }
}
