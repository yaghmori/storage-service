import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MESSAGE_PATTERNS } from '@platform/messaging-contracts';
import { HealthCheckRequest, HealthCheckResponse } from '@platform/messaging-contracts';
import { HealthService } from './health.service';

/**
 * Health Microservice Controller
 *
 * VALIDATION STRATEGY:
 * - Health checks don't require validation (no input parameters)
 * - Returns standardized health check response
 */
@Controller()
export class HealthMicroserviceController {
  constructor(private readonly healthService: HealthService) {}

  @MessagePattern(MESSAGE_PATTERNS.HEALTH.CHECK)
  async check(@Payload() data?: HealthCheckRequest): Promise<HealthCheckResponse> {
    // No validation needed - health checks have no parameters
    return await this.healthService.getOverallHealth() as HealthCheckResponse;
  }
}
