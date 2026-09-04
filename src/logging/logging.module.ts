import { Global, Module } from '@nestjs/common';
import { LogFileService } from './log-file.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';

@Global()
@Module({
  providers: [LogFileService, RequestLoggingMiddleware],
  exports: [LogFileService, RequestLoggingMiddleware],
})
export class LoggingModule {}
