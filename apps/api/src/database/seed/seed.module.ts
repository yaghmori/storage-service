import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigModule as AppConfigModule } from '../../config/config.module';
import { OrgProcessorsService } from '../../processing/services/org-processors.service';
import { DatabaseModule } from '../database.module';
import { SeedBootstrapService } from './seed-bootstrap.service';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppConfigModule,
    DatabaseModule,
  ],
  providers: [SeedService, SeedBootstrapService, OrgProcessorsService],
  exports: [SeedService],
})
export class SeedModule {}
