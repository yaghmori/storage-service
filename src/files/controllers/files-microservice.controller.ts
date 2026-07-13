import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BATCH_OPERATION_TYPES, MESSAGE_PATTERNS } from '@platform/messaging-contracts';
import type {
  BatchOperationsRequest,
  BatchOperationsResponse,
  DeleteFileRequest,
  FileResponse,
  GetFileInfoRequest,
  SignedUrlRequest,
  SignedUrlResponse,
} from '@platform/messaging-contracts';
import { success, type ApiResponse } from '@platform/messaging-contracts';
import { FilesService } from '../services/files.service';
import { SignedUrlService } from '../../serving/services/signed-url.service';

/**
 * Files Microservice Controller
 *
 * VALIDATION STRATEGY:
 * - Input validation happens at the API Gateway using Zod schemas from @platform/messaging-contracts
 * - This controller trusts that data is already validated
 * - Focuses on business logic and domain-specific error handling
 */
@Controller()
export class FilesMicroserviceController {
  constructor(
    private readonly filesService: FilesService,
    private readonly signedUrlService: SignedUrlService,
  ) {}

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_FILE_INFO)
  async getFileInfo(@Payload() data: GetFileInfoRequest & { requestId?: string }): Promise<ApiResponse<FileResponse>> {
    // Validation happens at Gateway - trust the data
    try {
      const result = await this.filesService.findById(data.id);
      return success(result, { requestId: data.requestId });
    } catch (error) {
      // Let MicroserviceExceptionFilter handle service errors (including NotFoundException)
      throw error;
    }
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.DELETE_FILE)
  async deleteFile(@Payload() data: DeleteFileRequest & { requestId?: string }): Promise<ApiResponse<FileResponse>> {
    // Validation happens at Gateway - trust the data
    try {
      const result = await this.filesService.deleteFile(data.id, data.hardDelete || false);
      return success(result, { requestId: data.requestId });
    } catch (error) {
      // Let MicroserviceExceptionFilter handle service errors (including NotFoundException)
      throw error;
    }
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.BATCH_OPERATIONS)
  async batchOperations(@Payload() data: BatchOperationsRequest & { requestId?: string }): Promise<ApiResponse<BatchOperationsResponse>> {
    // Validation happens at Gateway - trust the data
    // Process each operation and collect results
    const results = [];

    for (const op of data.operations) {
      try {
        if (op.type === BATCH_OPERATION_TYPES.DELETE) {
          try {
            const file = await this.filesService.findById(op.id);
            if (!file) {
              results.push({
                error: `File with ID ${op.id} not found`,
              });
            } else {
              const deleted = await this.filesService.deleteFile(op.id, op.hardDelete || false);
              results.push(deleted);
            }
          } catch (error) {
            results.push({
              error: error instanceof Error ? error.message : `File with ID ${op.id} not found`,
            });
          }
        } else if (op.type === BATCH_OPERATION_TYPES.GET) {
          try {
            const file = await this.filesService.findById(op.id);
            results.push(file);
          } catch (error) {
            results.push({
              error: error instanceof Error ? error.message : `File with ID ${op.id} not found`,
            });
          }
        } else {
          results.push({
            error: `Unknown operation type: ${op.type}`,
          });
        }
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return success({ results }, { requestId: data.requestId });
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_SIGNED_URL)
  async getSignedUrl(@Payload() data: SignedUrlRequest & { requestId?: string }): Promise<ApiResponse<SignedUrlResponse>> {
    // Validation happens at Gateway - trust the data
    try {
      const expiresIn = data.expiresIn || 3600;
      const url = await this.signedUrlService.generateSignedUrl(
        data.fileId,
        undefined, // variantType - not in SignedUrlRequest schema, can be extended later
        expiresIn,
      );

      // Calculate expiresAt timestamp
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const result: SignedUrlResponse = {
        url,
        expiresAt,
        expiresIn,
      };

      return success(result, { requestId: data.requestId });
    } catch (error) {
      // Let MicroserviceExceptionFilter handle service errors (including NotFoundException)
      throw error;
    }
  }
}
