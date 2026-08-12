import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isOAuthPath =
      request.url.includes('/oauth/token') ||
      request.url.includes('/oauth/userinfo') ||
      request.url.includes('/oauth/revoke');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SYS-001';
    let message: string | string[] = 'Internal Server Error';
    let errorCategory = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;

      errorCategory = res.error || exception.name;
      message = res.message || exception.message;
      code = res.code || this.getCategoryCode(status);

      // OAuth: si el servicio lanzó con oauth_error, respetarlo (RFC 6749)
      if (res.oauth_error) {
        errorCategory = res.oauth_error;
      }
    }

    // ── Rutas OAuth: responder en formato RFC 6749 (JSON plano) ──
    if (isOAuthPath) {
      return response.status(status).json({
        error: errorCategory,
        error_description: Array.isArray(message)
          ? message.join(', ')
          : message,
      });
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      error: errorCategory,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getCategoryCode(status: number): string {
    switch (status) {
      case 400:
        return 'AUTH-007';
      case 401:
        return 'AUTH-001';
      case 403:
        return 'AUTH-005';
      case 409:
        return 'AUTH-009';
      case 423:
        return 'AUTH-010';
      case 429:
        return 'AUTH-014';
      default:
        return 'SYS-001';
    }
  }
}
