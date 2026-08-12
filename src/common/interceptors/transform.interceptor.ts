import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: any;
}

const OAUTH_RAW_PATHS = ['/oauth/token', '/oauth/userinfo'];

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    // Las rutas OAuth deben responder en formato RFC 6749 (JSON plano),
    // sin envolver en "data" para que Amazon/la skill lo interprete.
    const path =
      request?.route?.path || request?.originalUrl || request?.url || '';
    if (OAUTH_RAW_PATHS.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((result) => {
        // Si la respuesta ya incluye 'data' o 'meta' (como la paginación de auditoría), preservamos esa estructura
        if (
          result &&
          typeof result === 'object' &&
          ('data' in result || 'meta' in result)
        ) {
          return {
            data: result.data ?? result,
            ...(result.meta ? { meta: result.meta } : {}),
          };
        }

        // Para cualquier otro resultado estándar, lo envolvemos dentro de "data"
        return {
          data: result,
        };
      }),
    );
  }
}
