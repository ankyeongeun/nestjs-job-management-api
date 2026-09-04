import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LogFileService } from '../logging/log-file.service';
import { JobProcessorService } from './job-processor.service';
import { JobStatus } from './job-status.enum';
import { JobExecutor } from './job.executor';
import { Job } from './job.model';
import { JobsRepository } from './jobs.repository';

describe('JobProcessorService', () => {
  let repository: JobsRepository;
  let processor: JobProcessorService;
  let executeMock: jest.Mock;
  let testDirectory: string;

  beforeEach(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'job-processor-'));
    process.env.JOBS_DB_PATH = join(testDirectory, 'jobs.json');

    repository = new JobsRepository();
    await repository.onModuleInit();

    executeMock = jest.fn().mockResolvedValue(undefined);
    const executor = { execute: executeMock } as unknown as JobExecutor;
    const logFileService = {
      write: jest.fn().mockResolvedValue(undefined),
    } as unknown as LogFileService;

    processor = new JobProcessorService(repository, executor, logFileService);
  });

  afterEach(async () => {
    delete process.env.JOBS_DB_PATH;
    await rm(testDirectory, { recursive: true, force: true });
  });

  it('대기 작업을 처리 완료 상태로 변경한다', async () => {
    const job = createPendingJob('성공 작업');
    await repository.append(job);

    await processor.processPendingJobs();

    const savedJob = (await repository.findAll())[0];
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id }),
    );
    expect(savedJob.status).toBe(JobStatus.COMPLETED);
    expect(savedJob.processingStartedAt).toBeDefined();
    expect(savedJob.finishedAt).toBeDefined();
  });

  it('작업 실행 중 오류가 발생하면 실패 상태와 원인을 저장한다', async () => {
    const job = createPendingJob('실패 작업');
    await repository.append(job);
    executeMock.mockRejectedValueOnce(new Error('외부 서비스 오류'));

    await processor.processPendingJobs();

    const savedJob = (await repository.findAll())[0];
    expect(savedJob.status).toBe(JobStatus.FAILED);
    expect(savedJob.failureReason).toBe('외부 서비스 오류');
    expect(savedJob.finishedAt).toBeDefined();
  });

  it('한 번 실행할 때 설정된 배치 크기까지만 처리한다', async () => {
    const jobs = Array.from({ length: 6 }, (_, index) =>
      createPendingJob(`배치 작업 ${index}`),
    );
    await Promise.all(jobs.map((job) => repository.append(job)));

    await processor.processPendingJobs();

    const savedJobs = await repository.findAll();
    expect(
      savedJobs.filter((job) => job.status === JobStatus.COMPLETED),
    ).toHaveLength(5);
    expect(
      savedJobs.filter((job) => job.status === JobStatus.PENDING),
    ).toHaveLength(1);
  });
});

function createPendingJob(title: string): Job {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    title,
    description: `${title} 설명`,
    status: JobStatus.PENDING,
    createdAt: now,
    updatedAt: now,
  };
}
