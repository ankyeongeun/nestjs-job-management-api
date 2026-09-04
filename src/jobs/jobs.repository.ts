import { Injectable, OnModuleInit } from '@nestjs/common';
import { Mutex } from 'async-mutex';
import { join } from 'node:path';
import { Config, JsonDB } from 'node-json-db';
import { JobStatus } from './job-status.enum';
import { Job } from './job.model';

type JobUpdater = (job: Job) => Job;

@Injectable()
export class JobsRepository implements OnModuleInit {
  private readonly mutex = new Mutex();
  private readonly database: JsonDB;

  constructor() {
    const databasePath =
      process.env.JOBS_DB_PATH ?? join(process.cwd(), 'jobs.json');

    this.database = new JsonDB(new Config(databasePath, true, true, '/', true));
  }

  async onModuleInit(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.database.load();

      if (!(await this.database.exists('/jobs'))) {
        await this.database.push('/jobs', [], true);
      }
    });
  }

  async findAll(): Promise<Job[]> {
    return this.mutex.runExclusive(async () => {
      const jobs = await this.readJobs();
      return this.cloneJobs(jobs);
    });
  }

  async append(job: Job): Promise<Job> {
    return this.mutex.runExclusive(async () => {
      const jobs = await this.readJobs();
      jobs.push(job);
      await this.writeJobs(jobs);

      return { ...job };
    });
  }

  async updateById(id: string, updater: JobUpdater): Promise<Job | undefined> {
    return this.mutex.runExclusive(async () => {
      const jobs = await this.readJobs();
      const jobIndex = jobs.findIndex((job) => job.id === id);

      if (jobIndex === -1) {
        return undefined;
      }

      const updatedJob = updater({ ...jobs[jobIndex] });
      jobs[jobIndex] = updatedJob;
      await this.writeJobs(jobs);

      return { ...updatedJob };
    });
  }

  async claimPending(limit: number): Promise<Job[]> {
    return this.mutex.runExclusive(async () => {
      const jobs = await this.readJobs();
      const now = new Date().toISOString();
      const claimedJobs: Job[] = [];

      for (const job of jobs) {
        if (job.status !== JobStatus.PENDING || claimedJobs.length >= limit) {
          continue;
        }

        job.status = JobStatus.PROCESSING;
        job.processingStartedAt = now;
        job.updatedAt = now;
        claimedJobs.push({ ...job });
      }

      if (claimedJobs.length > 0) {
        await this.writeJobs(jobs);
      }

      return claimedJobs;
    });
  }

  private async readJobs(): Promise<Job[]> {
    return this.database.getObjectDefault<Job[]>('/jobs', []);
  }

  private async writeJobs(jobs: Job[]): Promise<void> {
    await this.database.push('/jobs', jobs, true);
  }

  private cloneJobs(jobs: Job[]): Job[] {
    return jobs.map((job) => ({ ...job }));
  }
}
