import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JobStatus } from '../job-status.enum';

export class SearchJobsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
