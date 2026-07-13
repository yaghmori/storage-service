import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { HealthMicroserviceController } from './health-microservice.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [HealthController, HealthMicroserviceController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
