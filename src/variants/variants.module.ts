import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { StorageProvidersModule } from '../storage-providers/storage-providers.module';
import { VariantsRepository } from './repositories/variants.repository';
import { VariantsService } from './services/variants.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => FilesModule), StorageProvidersModule],
  providers: [VariantsService, VariantsRepository],
  exports: [VariantsService, VariantsRepository],
})
export class VariantsModule {}

