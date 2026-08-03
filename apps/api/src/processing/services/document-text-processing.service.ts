import { Injectable } from '@nestjs/common';
import { ProcessorKey } from '@workspace/validation';
import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { FilesService } from '../../files/services/files.service';
import { FileProcessorResultsRepository } from '../repositories/file-processor-results.repository';
import { ProcessingJobsRepository } from '../repositories/processing-jobs.repository';

const execFileAsync = promisify(execFile);

@Injectable()
export class DocumentTextProcessingService {
  constructor(
    private readonly files: FilesService,
    private readonly results: FileProcessorResultsRepository,
    private readonly jobs: ProcessingJobsRepository,
  ) {}

  async process(input: {
    fileId: string;
    orgId: string;
    jobId?: string;
    settings?: { maxChars?: number };
  }) {
    const file = await this.files.findById(input.fileId, input.orgId);
    const provider = await this.files.getFileProvider(input.fileId);
    const buffer = await provider.download(file.key);
    const maxChars = Math.max(1, Math.floor(input.settings?.maxChars ?? 524_288));
    let text = '';
    let pageCount: number | null = null;
    let engine = 'utf8';

    if (file.mimeType.startsWith('text/')) {
      text = buffer.toString('utf8');
    } else if (file.mimeType === 'application/pdf') {
      const parsed = await this.parsePdf(buffer);
      if (!parsed) {
        return this.skip(input, 'Neither pdf-parse nor pdftotext is available');
      }
      text = parsed.text;
      pageCount = parsed.pageCount;
      engine = parsed.engine;
    } else {
      return this.skip(
        input,
        `Unsupported document MIME type: ${file.mimeType}`,
      );
    }

    const truncated = text.length > maxChars;
    const stored = truncated ? text.slice(0, maxChars) : text;
    const data = {
      text: stored,
      charCount: text.length,
      pageCount,
      truncated,
      engine,
    };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DOCUMENT_TEXT,
      status: 'completed',
      data,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
    });
    if (input.jobId) {
      await this.jobs.appendLog(
        input.jobId,
        'info',
        `Extracted ${stored.length} characters using ${engine}`,
      );
      await this.jobs.setOutput(input.jobId, {
        charCount: data.charCount,
        pageCount,
        truncated,
        engine,
      });
    }
    return { skipped: false, data };
  }

  private async parsePdf(buffer: Buffer): Promise<{
    text: string;
    pageCount: number | null;
    engine: string;
  } | null> {
    try {
      const module = await import('pdf-parse');
      if (module.PDFParse) {
        const parser = new module.PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          return {
            text: result.text,
            pageCount: result.total ?? null,
            engine: 'pdf-parse',
          };
        } finally {
          await parser.destroy();
        }
      }
    } catch {
      // Fall through to CLI
    }

    const dir = await mkdtemp(join(tmpdir(), 'document-text-'));
    const path = join(dir, 'input.pdf');
    try {
      await writeFile(path, buffer);
      try {
        const { stdout } = await execFileAsync('pdftotext', [path, '-'], {
          maxBuffer: 16 * 1024 * 1024,
        });
        return { text: stdout, pageCount: null, engine: 'pdftotext' };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async skip(
    input: { fileId: string; orgId: string; jobId?: string },
    error: string,
  ) {
    const data = {
      text: '',
      charCount: 0,
      pageCount: null,
      truncated: false,
    };
    await this.results.upsert({
      orgId: input.orgId,
      fileId: input.fileId,
      processorKey: ProcessorKey.DOCUMENT_TEXT,
      status: 'skipped',
      data,
      error,
      jobId: input.jobId ?? null,
      processedAt: new Date(),
    });
    if (input.jobId) await this.jobs.appendLog(input.jobId, 'warn', error);
    return { skipped: true, data, error };
  }
}
