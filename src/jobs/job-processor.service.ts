import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { JobExecutor } from './job.executor';
import { JobStatus } from './job-status.enum';
import { Job } from './job.model';
import { JobsRepository } from './jobs.repository';
import { LogFileService } from '../logging/log-file.service';

const PROCESS_INTERVAL_MS = 60_000;
const PROCESS_BATCH_SIZE = 5;

@Injectable()
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name);
  private isRunning = false;

  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly jobExecutor: JobExecutor,
    private readonly logFileService: LogFileService,
  ) {}

  @Interval('job-processor', PROCESS_INTERVAL_MS)
  async processPendingJobs(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        '이전 스케줄 실행이 끝나지 않아 이번 실행을 건너뜁니다.',
      );
      await this.logFileService.write('scheduler_skipped', {
        reason: 'previous_execution_in_progress',
      });
      return;
    }

    this.isRunning = true;

    try {
      const claimedJobs =
        await this.jobsRepository.claimPending(PROCESS_BATCH_SIZE);

      if (claimedJobs.length > 0) {
        await this.logFileService.write('jobs_claimed', {
          count: claimedJobs.length,
          jobIds: claimedJobs.map((job) => job.id),
        });
      }

      for (const job of claimedJobs) {
        await this.processJob(job);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '알 수 없는 오류';
      this.logger.error(`스케줄러 실행 실패: ${message}`);
      await this.logFileService.write('scheduler_failed', { message });
    } finally {
      this.isRunning = false;
    }
  }

  private async processJob(job: Job): Promise<void> {
    try {
      await this.jobExecutor.execute(job);
      const now = new Date().toISOString();

      await this.jobsRepository.updateById(job.id, (currentJob) => ({
        ...currentJob,
        status: JobStatus.COMPLETED,
        finishedAt: now,
        updatedAt: now,
      }));

      this.logger.log(`작업 처리 완료: ${job.id}`);
      await this.logFileService.write('job_completed', { jobId: job.id });
    } catch (error) {
      const now = new Date().toISOString();
      const failureReason =
        error instanceof Error ? error.message : '알 수 없는 오류';

      await this.jobsRepository.updateById(job.id, (currentJob) => ({
        ...currentJob,
        status: JobStatus.FAILED,
        failureReason,
        finishedAt: now,
        updatedAt: now,
      }));

      this.logger.error(`작업 처리 실패: ${job.id} - ${failureReason}`);
      await this.logFileService.write('job_failed', {
        jobId: job.id,
        failureReason,
      });
    }
  }
}
