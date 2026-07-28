import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from '../errors/domain.exception.js';

type RequestWithId = Request & { id?: string };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : undefined;

    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Beklenmeyen bir hata oluştu.';
    let details: unknown;

    if (exception instanceof DomainException) {
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (isHttp) {
      code = status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'VALIDATION_ERROR';
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const objectPayload = payload as { message?: string | string[]; error?: string };
        message = Array.isArray(objectPayload.message)
          ? objectPayload.message.join('; ')
          : (objectPayload.message ?? objectPayload.error ?? message);
        details = objectPayload.message;
      }
    } else {
      this.logger.error(
        'Unhandled request error',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId: request.id ?? response.getHeader('x-request-id') ?? null,
    });
  }
}
