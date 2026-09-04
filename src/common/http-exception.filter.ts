import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface HttpExceptionBody {
  message?: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      code: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message: this.getMessage(exception),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private getMessage(exception: unknown): string | string[] {
    if (!(exception instanceof HttpException)) {
      return '서버 내부 오류가 발생했습니다.';
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const body = exceptionResponse as HttpExceptionBody;
    return body.message ?? exception.message;
  }
}
