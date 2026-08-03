// Run: pnpm db:seed
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    SeedModule,
    {
      logger: ['log', 'error', 'warn'],
    },
  );

  const seedService = app.get(SeedService);
  await seedService.seed();

  await app.close();
}

bootstrap()
  .then(() => {
    console.log('Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });

