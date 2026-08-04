import { Injectable, Logger } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { createConnection, type Socket } from 'net';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from '../../files/services/files.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';
import { ProcessorBackendsService } from './processor-backends.service';

type ClamavConfig = {
  host: string;
  port: number;
  timeoutMs: number;
};

@Injectable()
export class VirusScanProcessingService {
  private readonly logger = new Logger(VirusScanProcessingService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
    private readonly backends: ProcessorBackendsService,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    backendId?: string | null;
  }) {
    const file = await this.filesService.findById(input.fileId, input.orgId);
    const clamav = await this.resolveClamav(input.orgId, input.backendId);
    if (!clamav) {
      const data = {
        scanned: false,
        skipped: true,
        reason: 'No ClamAV backend configured',
      };
      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.SECURITY_VIRUS_SCAN,
        status: 'skipped',
        data,
        error: null,
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      if (input.jobId) await this.jobs.setOutput(input.jobId, data);
      await this.log(input.jobId, 'warn', 'No ClamAV backend — skipped');
      return data;
    }

    await this.log(
      input.jobId,
      'info',
      `Scanning via clamd ${clamav.host}:${clamav.port}`,
    );

    const provider = await this.filesService.getFileProvider(input.fileId);
    const tempPath = join(tmpdir(), `virus_${input.fileId}_${Date.now()}`);
    try {
      await this.log(input.jobId, 'info', 'Downloading object for scan…');
      await provider.downloadToFile(file.key, tempPath);
      await this.log(
        input.jobId,
        'info',
        `Connected object downloaded; streaming to clamd (timeout ${clamav.timeoutMs}ms)…`,
      );
      const scan = await this.scanFile(tempPath, clamav);
      const infected = scan.infected;
      const data = {
        scanned: true,
        infected,
        signature: scan.signature,
        host: clamav.host,
        scannedAt: new Date().toISOString(),
      };

      await this.results.upsert({
        orgId: input.orgId,
        fileId: input.fileId,
        processorKey: ProcessorKey.SECURITY_VIRUS_SCAN,
        status: infected ? 'failed' : 'completed',
        data,
        error: infected
          ? `Virus detected: ${scan.signature || 'unknown'}`
          : null,
        jobId: input.jobId ?? null,
        processedAt: new Date(),
      });
      if (input.jobId) await this.jobs.setOutput(input.jobId, data);

      if (infected) {
        await this.log(
          input.jobId,
          'error',
          `Infected: ${scan.signature || 'unknown'} — quarantining`,
        );
        await this.filesService.quarantineFile(
          input.fileId,
          `Virus detected: ${scan.signature || 'unknown'}`,
        );
        throw new Error(`Virus detected: ${scan.signature || 'unknown'}`);
      }

      await this.log(input.jobId, 'info', 'Clean');
      return data;
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  private async resolveClamav(
    orgId: string,
    backendId?: string | null,
  ): Promise<ClamavConfig | null> {
    const resolved = await this.backends.resolveClamav(orgId, backendId);
    if (resolved) return resolved;

    const host = process.env.CLAMAV_HOST?.trim();
    if (!host) return null;
    return {
      host,
      port: parseInt(process.env.CLAMAV_PORT || '3310', 10) || 3310,
      timeoutMs: parseInt(process.env.CLAMAV_TIMEOUT_MS || '120000', 10) || 120_000,
    };
  }

  /**
   * ClamAV INSTREAM protocol over TCP.
   * clamd replies with a null-terminated result and often keeps the socket open,
   * so we must resolve on the reply — not wait for TCP `end`.
   * @see https://linux.die.net/man/8/clamd
   */
  private scanFile(filePath: string, cfg: ClamavConfig): Promise<{
    infected: boolean;
    signature?: string;
  }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let response = '';

      const finish = (err?: Error, result?: { infected: boolean; signature?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (err) reject(err);
        else resolve(result!);
      };

      const parseAndFinish = (raw: string) => {
        const text = raw.replace(/\0/g, '').trim();
        if (!text) {
          finish(new Error('Empty response from clamd'));
          return;
        }
        if (/OK$/i.test(text) || text.endsWith('OK')) {
          finish(undefined, { infected: false });
          return;
        }
        const found = text.match(/:\s*(.+)\s+FOUND/i);
        finish(undefined, {
          infected: true,
          signature: found?.[1]?.trim() || text,
        });
      };

      const socket: Socket = createConnection(
        { host: cfg.host, port: cfg.port },
        () => {
          socket.write('zINSTREAM\0');
          const stream = createReadStream(filePath);
          stream.on('data', (chunk: Buffer) => {
            if (settled) return;
            const len = Buffer.alloc(4);
            len.writeUInt32BE(chunk.length, 0);
            socket.write(Buffer.concat([len, chunk]));
          });
          stream.on('end', () => {
            if (settled) return;
            const end = Buffer.alloc(4);
            end.writeUInt32BE(0, 0);
            socket.write(end);
          });
          stream.on('error', (err) => finish(err));
        },
      );

      const timer = setTimeout(() => {
        finish(
          new Error(`ClamAV scan timed out after ${cfg.timeoutMs}ms`),
        );
      }, cfg.timeoutMs);

      socket.on('data', (data) => {
        response += data.toString('utf8');
        // zINSTREAM replies are null-terminated; also accept bare OK/FOUND.
        if (response.includes('\0') || /\b(OK|FOUND)\b/i.test(response)) {
          parseAndFinish(response);
        }
      });
      socket.on('end', () => {
        if (!settled && response.trim()) parseAndFinish(response);
        else if (!settled) {
          finish(new Error('clamd closed connection without a scan result'));
        }
      });
      socket.on('error', (err) => finish(err));
    });
  }

  private async log(
    jobId: string | undefined,
    level: 'info' | 'warn' | 'error',
    message: string,
  ) {
    if (!jobId) return;
    await this.jobs.appendLog(jobId, level, message).catch((error) => {
      this.logger.warn(`log failed: ${error}`);
    });
  }
}
