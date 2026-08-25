import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Protege endpoints de uso exclusivo entre servicios (ej. VitalGuard API
 * consultando datos básicos de un usuario). No es un usuario final: se
 * autentica con una clave compartida en vez de un JWT de sesión.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-internal-api-key'];
    const expected = process.env.INTERNAL_SERVICE_KEY;

    if (!expected || key !== expected) {
      throw new UnauthorizedException({
        code: 'AUTH-032',
        message: 'Acceso de servicio no autorizado',
        error: 'Unauthorized',
      });
    }

    return true;
  }
}
