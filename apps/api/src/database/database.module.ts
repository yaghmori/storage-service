import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigModule } from '../config/config.module';
import { DatabaseConfig } from '../config/database.config';
import { DatabaseService } from './database.service';
import { ensureDatabaseExists } from './ensure-database';
import { runMigrations } from './run-migrations';
import * as schema from './drizzle/schema';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'DRIZZLE_DB',
      useFactory: async (config: DatabaseConfig) => {
        const connectionString = config.connectionString;
        await ensureDatabaseExists(connectionString, (message) => {
          // Nest logger is not available in this factory yet.
          console.log(message);
        });

        // Optional first-deploy / ops flag — default off so replicas do not race DDL.
        if (process.env.RUN_MIGRATIONS === 'true') {
          await runMigrations({
            connectionString,
            log: (message) => console.log(message),
          });
        }

        const client = postgres(connectionString, {
          max: 10,
          ssl: false, // Disable SSL for local development
        });
        return drizzle(client, { schema });
      },
      inject: [DatabaseConfig],
    },
    DatabaseService,
  ],
  exports: ['DRIZZLE_DB', DatabaseService],
})
export class DatabaseModule {}
