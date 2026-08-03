import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MESSAGE_PATTERNS, success, type ApiResponse } from '../../lib/contracts';
import { FileInsightsService } from '../services/file-insights.service';

@Controller()
export class FilesMicroserviceInsightsController {
  constructor(private readonly insights: FileInsightsService) {}

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.LIST_PROCESSOR_RESULTS)
  async listProcessorResults(
    @Payload()
    data: { id: string; orgId: string; requestId?: string },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.insights.listProcessorResults(data.id, data.orgId);
    return success(result, { requestId: data.requestId });
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_PROCESSOR_RESULT)
  async getProcessorResult(
    @Payload()
    data: {
      id: string;
      orgId: string;
      processorKey: string;
      requestId?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.insights.getProcessorResult(
      data.id,
      data.orgId,
      data.processorKey,
    );
    return success(result, { requestId: data.requestId });
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.GET_FILE_METADATA)
  async getMetadata(
    @Payload() data: { id: string; orgId: string; requestId?: string },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.insights.getMetadata(data.id, data.orgId);
    return success(result, { requestId: data.requestId });
  }

  @MessagePattern(MESSAGE_PATTERNS.STORAGE.LIST_VARIANTS)
  async listVariants(
    @Payload() data: { id: string; orgId: string; requestId?: string },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.insights.listVariants(data.id, data.orgId);
    return success(result, { requestId: data.requestId });
  }
}
