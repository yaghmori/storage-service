import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HealthService } from './health.service';

@Controller()
export class HealthMicroserviceController {
  constructor(private readonly healthService: HealthService) {}

  @MessagePattern('health.check')
  async check(@Payload() data?: any) {
    return await this.healthService.getOverallHealth();
  }
}
