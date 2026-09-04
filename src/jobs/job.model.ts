import { JobStatus } from './job-status.enum';

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: string;
  finishedAt?: string;
  failureReason?: string;
}
