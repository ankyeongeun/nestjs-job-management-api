import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { SearchJobsQueryDto } from './dto/search-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './job.model';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() createJobDto: CreateJobDto): Promise<Job> {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  findAll(): Promise<Job[]> {
    return this.jobsService.findAll();
  }

  @Get('search')
  search(@Query() query: SearchJobsQueryDto): Promise<Job[]> {
    return this.jobsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Job> {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    return this.jobsService.update(id, updateJobDto);
  }
}
