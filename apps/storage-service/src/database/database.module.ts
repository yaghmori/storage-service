import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigModule } from '../config/config.module';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseService } from './database.service';
import * as schema from './schema/schema';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'DRIZZLE_DB',
      useFactory: (config: DatabaseConfig) => {
        const connectionString = config.connectionString;
        const client = postgres(connectionString, { max: 10 });
        return drizzle(client, { schema });
      },
      inject: [DatabaseConfig],
    },
    DatabaseService,
  ],
  exports: ['DRIZZLE_DB', DatabaseService],
})
export class DatabaseModule {}

