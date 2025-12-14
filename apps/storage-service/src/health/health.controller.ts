import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async check() {
    if (!this.healthService) {
      throw new Error('HealthService is not available - dependency injection failed');
    }
    return await this.healthService.getOverallHealth();
  }
}
