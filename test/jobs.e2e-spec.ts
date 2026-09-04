import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request = require('supertest');
import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { JobStatus } from '../src/jobs/job-status.enum';
import { Job } from '../src/jobs/job.model';
import { JobsRepository } from '../src/jobs/jobs.repository';

describe('Jobs API (e2e)', () => {
  let app: INestApplication;
  let repository: JobsRepository;
  let testDirectory: string;
  let logFilePath: string;

  beforeAll(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'jobs-api-'));
    process.env.JOBS_DB_PATH = join(testDirectory, 'jobs.json');
    logFilePath = join(testDirectory, 'logs.txt');
    process.env.LOG_FILE_PATH = logFilePath;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    repository = app.get(JobsRepository);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.JOBS_DB_PATH;
    delete process.env.LOG_FILE_PATH;
    await rm(testDirectory, { recursive: true, force: true });
  });

  it('작업을 생성하고 목록에서 조회한다', async () => {
    const createResponse = await createJob('  첫 번째 작업  ');

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        title: '첫 번째 작업',
        status: JobStatus.PENDING,
      }),
    );

    const listResponse = await request(app.getHttpServer()).get('/jobs');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: (createResponse.body as Job).id }),
      ]),
    );
  });

  it('제목과 상태를 함께 사용해 작업을 검색한다', async () => {
    const createResponse = await createJob('월간 금융 리포트 생성');
    const createdJob = createResponse.body as Job;

    const response = await request(app.getHttpServer())
      .get('/jobs/search')
      .query({ title: '금융', status: JobStatus.PENDING });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: createdJob.id }),
    ]);
  });

  it('대기 작업의 제목과 설명만 수정할 수 있다', async () => {
    const createResponse = await createJob('수정 전 작업');
    const createdJob = createResponse.body as Job;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/jobs/${createdJob.id}`)
      .send({ title: '수정 후 작업' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.title).toBe('수정 후 작업');

    const statusUpdateResponse = await request(app.getHttpServer())
      .patch(`/jobs/${createdJob.id}`)
      .send({ status: JobStatus.COMPLETED });

    expect(statusUpdateResponse.status).toBe(400);
  });

  it('스케줄러가 선점한 작업은 API에서 수정할 수 없다', async () => {
    const createResponse = await createJob('처리 예정 작업');
    const createdJob = createResponse.body as Job;
    await repository.updateById(createdJob.id, (job) => ({
      ...job,
      status: JobStatus.PROCESSING,
    }));

    const response = await request(app.getHttpServer())
      .patch(`/jobs/${createdJob.id}`)
      .send({ title: '수정 시도' });

    expect(response.status).toBe(409);
  });

  it('잘못된 조회 요청에 적절한 상태 코드를 반환한다', async () => {
    const searchResponse = await request(app.getHttpServer()).get(
      '/jobs/search',
    );
    const notFoundResponse = await request(app.getHttpServer()).get(
      '/jobs/not-existing-id',
    );

    expect(searchResponse.status).toBe(400);
    expect(searchResponse.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: 'BAD_REQUEST',
        path: '/jobs/search',
      }),
    );
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
        path: '/jobs/not-existing-id',
      }),
    );
  });

  it('HTTP 요청 결과를 로그 파일에 기록한다', async () => {
    await request(app.getHttpServer()).get('/jobs');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const logs = await readFile(logFilePath, 'utf8');
    expect(logs).toContain('"event":"http_request"');
    expect(logs).toContain('"method":"GET"');
    expect(logs).toContain('"path":"/jobs"');
    expect(logs).toContain('"statusCode":200');
  });

  function createJob(title: string): request.Test {
    return request(app.getHttpServer()).post('/jobs').send({
      title,
      description: '테스트 작업 설명',
    });
  }
});
