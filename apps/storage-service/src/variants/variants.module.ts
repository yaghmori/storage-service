import { Module } from '@nestjs/common';
import { VariantsService } from './services/variants.service';
import { VariantsRepository } from './repositories/variants.repository';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';

@Module({
  imports: [DatabaseModule, FilesModule, StorageProvidersModule],
  providers: [VariantsService, VariantsRepository],
  exports: [VariantsService],
})
export class VariantsModule {}

