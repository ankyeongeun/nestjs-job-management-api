import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';
import { LoggingModule } from './logging/logging.module';
import { RequestLoggingMiddleware } from './logging/request-logging.middleware';

@Module({
  imports: [ScheduleModule.forRoot(), LoggingModule, JobsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
