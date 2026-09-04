import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStatus } from './job-status.enum';
import { Job } from './job.model';
import { JobsRepository } from './jobs.repository';

describe('JobsRepository', () => {
  let repository: JobsRepository;
  let testDirectory: string;

  beforeEach(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'jobs-repository-'));
    process.env.JOBS_DB_PATH = join(testDirectory, 'jobs.json');
    repository = new JobsRepository();
    await repository.onModuleInit();
  });

  afterEach(async () => {
    delete process.env.JOBS_DB_PATH;
    await rm(testDirectory, { recursive: true, force: true });
  });

  it('동시에 생성해도 작업이 유실되지 않는다', async () => {
    const jobs = Array.from({ length: 30 }, (_, index) =>
      createPendingJob(`동시 작업 ${index}`),
    );

    await Promise.all(jobs.map((job) => repository.append(job)));

    const savedJobs = await repository.findAll();
    expect(savedJobs).toHaveLength(30);
    expect(new Set(savedJobs.map((job) => job.id)).size).toBe(30);
  });

  it('여러 실행 주체가 동시에 선점해도 같은 작업을 중복 선점하지 않는다', async () => {
    const jobs = Array.from({ length: 10 }, (_, index) =>
      createPendingJob(`선점 작업 ${index}`),
    );
    await Promise.all(jobs.map((job) => repository.append(job)));

    const [firstClaim, secondClaim] = await Promise.all([
      repository.claimPending(5),
      repository.claimPending(5),
    ]);

    const claimedJobs = [...firstClaim, ...secondClaim];
    expect(claimedJobs).toHaveLength(10);
    expect(new Set(claimedJobs.map((job) => job.id)).size).toBe(10);
    expect(
      claimedJobs.every((job) => job.status === JobStatus.PROCESSING),
    ).toBe(true);
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
