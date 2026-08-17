import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BATCH_OPERATION_TYPES, MESSAGE_PATTERNS } from '../../lib/contracts';
import type {
  BatchOperationsRequest,
  BatchOperationsResponse,
  DeleteFileRequest,
  FileResponse,
  GetFileInfoRequest,
  SignedUrlRequest,
  SignedUrlResponse,
} from '../../lib/contracts';
import { success, type ApiResponse } from '../../lib/contracts';
import { looksLikeUuid } from '../../common/guards/auth.guard';
import { OrganizationService } from '../../organizations/organization.service';
import { FilesService } from '../services/files.service';
import { SignedUrlService } from '../../serving/services/signed-url.service';

type TcpOrgPayload = {
  orgId?: string;
  orgSlug?: string;
  tenantId?: string;
};

/**
 * Files Microservice Controller
 *
 * VALIDATION STRATEGY:
 * - Input validation happens at the API Gateway using Zod schemas from
 * - This controller trusts that data is already validated
 * - Focuses on business logic and domain-specific error handling
 *
 * Org isolation: get / sign / delete / batch require orgId or orgSlug (fail closed).
 */
@Controller()
export class FilesMicroserviceController {
  constructor(
    private readonly filesService: FilesService,
    private readonly signedUrlService: SignedUrlService,
    private readonly organizations: OrganizationService,
  ) {}

  private async requireTcpOrgId(data: TcpOrgPayload): Promise<string> {
    const rawId = data.orgId?.trim();
    const rawSlug = (data.orgSlug || data.tenantId)?.trim();

    if (rawId && looksLikeUuid(rawId)) {
      const resolved = await this.organizations.resolveOrgRef({ orgId: rawId });
      if (resolved) return resolved;
    }

    const slug = rawSlug || (rawId && !looksLikeUuid(rawId) ? rawId : undefined);
    if (slug) {
      const resolved = await this.organizations.resolveOrgRef({ orgSlug: slug });
      if (resolved) return resolved;
    }

    throw new Error(
      'TCP file operations require orgId (UUID) or orgSlug/tenantId in payload',
    );
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_FILE_INFO)
  async getFileInfo(
    @Payload() data: GetFileInfoRequest & TcpOrgPayload & { requestId?: string },
  ): Promise<ApiResponse<FileResponse>> {
    try {
      const orgId = await this.requireTcpOrgId(data);
      const result = await this.filesService.findById(data.id, orgId);
      return success(result, { requestId: data.requestId });
    } catch (error) {
      throw error;
    }
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.DELETE_FILE)
  async deleteFile(
    @Payload() data: DeleteFileRequest & TcpOrgPayload & { requestId?: string },
  ): Promise<ApiResponse<FileResponse>> {
    try {
      const orgId = await this.requireTcpOrgId(data);
      await this.filesService.findById(data.id, orgId);
      const result = await this.filesService.deleteFile(
        data.id,
        data.hardDelete || false,
      );
      return success(result, { requestId: data.requestId });
    } catch (error) {
      throw error;
    }
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.BATCH_OPERATIONS)
  async batchOperations(
    @Payload()
    data: BatchOperationsRequest & TcpOrgPayload & { requestId?: string },
  ): Promise<ApiResponse<BatchOperationsResponse>> {
    const orgId = await this.requireTcpOrgId(data);
    const results = [];

    for (const op of data.operations) {
      try {
        if (op.type === BATCH_OPERATION_TYPES.DELETE) {
          try {
            const file = await this.filesService.findById(op.id, orgId);
            if (!file) {
              results.push({
                error: `File with ID ${op.id} not found`,
              });
            } else {
              const deleted = await this.filesService.deleteFile(
                op.id,
                op.hardDelete || false,
              );
              results.push(deleted);
            }
          } catch (error) {
            results.push({
              error:
                error instanceof Error
                  ? error.message
                  : `File with ID ${op.id} not found`,
            });
          }
        } else if (op.type === BATCH_OPERATION_TYPES.GET) {
          try {
            const file = await this.filesService.findById(op.id, orgId);
            results.push(file);
          } catch (error) {
            results.push({
              error:
                error instanceof Error
                  ? error.message
                  : `File with ID ${op.id} not found`,
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
  async getSignedUrl(
    @Payload() data: SignedUrlRequest & TcpOrgPayload & { requestId?: string },
  ): Promise<ApiResponse<SignedUrlResponse>> {
    try {
      const orgId = await this.requireTcpOrgId(data);
      const requested =
        typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn)
          ? data.expiresIn
          : undefined;
      const signed = await this.signedUrlService.generateSignedUrl(
        data.fileId,
        undefined,
        requested,
        orgId,
      );

      const expiresAt = new Date(
        Date.now() + signed.expiresIn * 1000,
      ).toISOString();

      const result: SignedUrlResponse = {
        url: signed.url,
        expiresAt,
        expiresIn: signed.expiresIn,
      };

      return success(result, { requestId: data.requestId });
    } catch (error) {
      throw error;
    }
  }
}
