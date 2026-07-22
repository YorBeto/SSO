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

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
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