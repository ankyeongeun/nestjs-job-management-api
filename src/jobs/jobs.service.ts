import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateJobDto } from './dto/create-job.dto';
import { SearchJobsQueryDto } from './dto/search-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobStatus } from './job-status.enum';
import { Job } from './job.model';
import { JobsRepository } from './jobs.repository';

@Injectable()
export class JobsService {
  constructor(private readonly jobsRepository: JobsRepository) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      title: createJobDto.title.trim(),
      description: createJobDto.description.trim(),
      status: JobStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    return this.jobsRepository.append(job);
  }

  findAll(): Promise<Job[]> {
    return this.jobsRepository.findAll();
  }

  async search(query: SearchJobsQueryDto): Promise<Job[]> {
    const title = query.title?.trim().toLowerCase();

    if (!title && !query.status) {
      throw new BadRequestException(
        'title 또는 status 검색 조건이 하나 이상 필요합니다.',
      );
    }

    const jobs = await this.jobsRepository.findAll();

    return jobs.filter((job) => {
      const matchesTitle = title
        ? job.title.toLowerCase().includes(title)
        : true;
      const matchesStatus = query.status ? job.status === query.status : true;

      return matchesTitle && matchesStatus;
    });
  }

  async findOne(id: string): Promise<Job> {
    const jobs = await this.jobsRepository.findAll();
    const job = jobs.find((candidate) => candidate.id === id);

    if (!job) {
      throw new NotFoundException(`작업을 찾을 수 없습니다: ${id}`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
    if (
      updateJobDto.title === undefined &&
      updateJobDto.description === undefined
    ) {
      throw new BadRequestException('수정할 필드가 하나 이상 필요합니다.');
    }

    const updatedJob = await this.jobsRepository.updateById(
      id,
      (currentJob) => {
        if (currentJob.status !== JobStatus.PENDING) {
          throw new ConflictException('대기 중인 작업만 수정할 수 있습니다.');
        }

        return {
          ...currentJob,
          ...(updateJobDto.title !== undefined && {
            title: updateJobDto.title.trim(),
          }),
          ...(updateJobDto.description !== undefined && {
            description: updateJobDto.description.trim(),
          }),
          updatedAt: new Date().toISOString(),
        };
      },
    );

    if (!updatedJob) {
      throw new NotFoundException(`작업을 찾을 수 없습니다: ${id}`);
    }

    return updatedJob;
  }
}
