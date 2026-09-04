import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Mutex } from 'async-mutex';

@Injectable()
export class LogFileService implements OnModuleInit {
  private readonly logger = new Logger(LogFileService.name);
  private readonly mutex = new Mutex();
  private readonly logFilePath =
    process.env.LOG_FILE_PATH ?? join(process.cwd(), 'logs.txt');

  async onModuleInit(): Promise<void> {
    await appendFile(this.logFilePath, '', 'utf8');
  }

  async write(
    event: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    const logLine = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...details,
    })}\n`;

    try {
      await this.mutex.runExclusive(() =>
        appendFile(this.logFilePath, logLine, 'utf8'),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '알 수 없는 오류';
      this.logger.error(`로그 파일 기록 실패: ${message}`);
    }
  }
}
