import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BATCH_OPERATION_TYPES, MESSAGE_PATTERNS } from '../constants';
import { FilesService } from '../services/files.service';

@Controller()
export class FilesMicroserviceController {
  constructor(private readonly filesService: FilesService) {}

  @MessagePattern(MESSAGE_PATTERNS.GET_FILE_INFO)
  async getFileInfo(@Payload() data: { id: string }) {
    return this.filesService.findById(data.id);
  }

  @MessagePattern(MESSAGE_PATTERNS.DELETE_FILE)
  async deleteFile(@Payload() data: { id: string; hardDelete?: boolean }) {
    return this.filesService.deleteFile(data.id, data.hardDelete || false);
  }

  @MessagePattern(MESSAGE_PATTERNS.BATCH_OPERATIONS)
  async batchOperations(
    @Payload()
    data: {
      operations: Array<{ type: string; id: string; hardDelete?: boolean }>;
    }
  ) {
    const results = [];
    for (const op of data.operations) {
      try {
        if (op.type === BATCH_OPERATION_TYPES.DELETE) {
          results.push(
            await this.filesService.deleteFile(op.id, op.hardDelete || false)
          );
        } else if (op.type === BATCH_OPERATION_TYPES.GET) {
          results.push(await this.filesService.findById(op.id));
        }
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}
