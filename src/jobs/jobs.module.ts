import { Module } from '@nestjs/common';
import { JobExecutor } from './job.executor';
import { JobProcessorService } from './job-processor.service';
import { JobsController } from './jobs.controller';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, JobExecutor, JobProcessorService],
})
export class JobsModule {}
