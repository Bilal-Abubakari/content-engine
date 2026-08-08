import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Consistent JSON error envelope returned for every unhandled failure. */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
}

/**
 * Catches everything thrown in the request pipeline and renders a uniform
 * JSON body. Known {@link HttpException}s keep their status and message;
 * anything else becomes a 500 with a generic message so internal details
 * (stack traces, driver errors) never leak to clients. Full details are
 * logged server-side.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.describe(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  /** Extract a safe client-facing message + error label for the status. */
  private describe(
    exception: unknown,
    status: number,
  ): { message: string; error: string } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { message: res, error: exception.name };
      }
      const record = res as Record<string, unknown>;
      const rawMessage = record['message'];
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : String(rawMessage ?? exception.message);
      const error = String(record['error'] ?? exception.name);
      return { message, error };
    }
    // Unknown/unexpected error: never expose internals.
    return { message: 'Internal server error', error: 'InternalServerError' };
  }
}
