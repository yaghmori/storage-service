import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SeedService } from './seed.service';

/**
 * Optional first-boot seed when RUN_SEED=true.
 * Only creates org + providers if the organizations table is empty.
 * Seeded orgs remain fully deletable.
 */
@Injectable()
export class SeedBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SeedBootstrapService.name);

  constructor(private readonly seedService: SeedService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RUN_SEED !== 'true' && process.env.RUN_SEED !== '1') {
      return;
    }
    try {
      await this.seedService.seed({ onlyIfEmpty: true });
    } catch (error) {
      this.logger.error(
        `Boot seed failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
