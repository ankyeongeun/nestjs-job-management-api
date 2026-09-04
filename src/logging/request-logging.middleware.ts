import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LogFileService } from './log-file.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logFileService: LogFileService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();

    response.once('finish', () => {
      void this.logFileService.write('http_request', {
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  }
}
