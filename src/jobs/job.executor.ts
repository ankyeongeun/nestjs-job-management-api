import { Injectable } from '@nestjs/common';
import { Job } from './job.model';

@Injectable()
export class JobExecutor {
  async execute(_job: Job): Promise<void> {
    // 실제 작업 로직이 정해지지 않았으므로, 현재는 성공으로 처리한다.
    await Promise.resolve();
  }
}
