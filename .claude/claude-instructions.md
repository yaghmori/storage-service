# Instructions for Claude - Building NestJS Microservices

> Quick reference for AI assistant when building services similar to storage-service

## Core Principles

1. **Always follow NestJS best practices** - Use decorators, dependency injection, and module system
2. **Type safety first** - Explicit TypeScript types, no `any`
3. **Separation of concerns** - Controller → Service → Repository pattern
4. **Database via Drizzle ORM** - Type-safe queries, schema-first
5. **Queues via @nestjs/bullmq** - Background jobs with BullMQ (NOT old @nestjs/bull)

---

## Technology Stack (REQUIRED)

### Framework & Core
- **NestJS 11**: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
- **Node.js 20+**: Latest LTS
- **TypeScript 5.9+**: Strict mode enabled

### Database
- **PostgreSQL 16**: Primary database
- **Drizzle ORM 0.45+**: Type-safe ORM (NOT TypeORM, NOT Prisma)
- **postgres**: PostgreSQL client

### Queue System
- **BullMQ 5.0**: Modern queue system
- **@nestjs/bullmq 11.0**: Official NestJS integration (NOT @nestjs/bull)
- **ioredis 5.8**: Redis client
- **Redis 7**: Queue backend

### Validation
- **class-validator 0.14**: DTO validation
- **class-transformer 0.5**: Object transformation

---

## File Structure Template

```
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── config.module.ts
│   ├── config.service.ts
│   ├── database.config.ts
│   └── redis.config.ts
├── database/
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── migrations/
│   │   ├── meta/
│   │   └── 0000_*.sql
│   ├── schema/
│   │   └── schema.ts
│   └── seed/
│       └── seed.service.ts
├── [feature]/
│   ├── [feature].module.ts
│   ├── controllers/
│   │   └── [feature].controller.ts
│   ├── services/
│   │   └── [feature].service.ts
│   ├── repositories/
│   │   └── [feature].repository.ts
│   ├── dtos/
│   │   ├── create-[feature].dto.ts
│   │   └── update-[feature].dto.ts
│   └── types/
│       └── [feature].types.ts
├── queues/
│   ├── queues.module.ts
│   ├── queues.service.ts
│   ├── queue-names.ts
│   └── bull-board-setup.service.ts
├── processing/
│   ├── processing.module.ts
│   ├── processors/
│   │   └── [job].processor.ts
│   └── services/
│       └── [job].service.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   └── decorators/
└── health/
    ├── health.module.ts
    └── health.controller.ts
```

---

## Quick Templates

### 1. Database Schema (Drizzle)

```typescript
import { pgTable, uuid, varchar, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  emailUnique: unique('users_email_unique').on(table.email),
}));
```

### 2. Repository Pattern

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/schema';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: CreateUserData) {
    const result = await this.db
      .insert(schema.users)
      .values(data)
      .returning();
    return result[0];
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(and(
        eq(schema.users.id, id),
        isNull(schema.users.deletedAt) // Soft delete filter
      ))
      .limit(1);
    return result[0] || null;
  }
}
```

### 3. Queue Setup (@nestjs/bullmq)

```typescript
// queues.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (redisConfig: RedisConfig) => ({
        connection: redisConfig.connectionOptions,
      }),
      inject: [RedisConfig],
    }),
    BullModule.registerQueue({
      name: 'email-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    }),
  ],
})
export class QueuesModule {}

// queues.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue,
  ) {}

  async addEmailJob(data: EmailData) {
    return this.emailQueue.add('send-email', data);
  }
}
```

### 4. Processor (@nestjs/bullmq)

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('email-queue', { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailData>) {
    this.logger.log(`Processing job ${job.id}`);
    try {
      await this.emailService.send(job.data);
      return { success: true };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}
```

---

## Critical Rules

### ✅ DO:

1. **Use UUID for primary keys**
   ```typescript
   id: uuid('id').defaultRandom().primaryKey()
   ```

2. **Always add timestamps**
   ```typescript
   createdAt: timestamp('created_at').notNull().defaultNow(),
   updatedAt: timestamp('updated_at').notNull().defaultNow(),
   ```

3. **Implement soft deletes for important data**
   ```typescript
   deletedAt: timestamp('deleted_at'),
   ```

4. **Add indexes for queried fields**
   ```typescript
   }, (table) => ({
     emailIdx: index('users_email_idx').on(table.email),
   }));
   ```

5. **Use proper DTOs with validation**
   ```typescript
   export class CreateUserDto {
     @IsEmail()
     email: string;

     @IsString()
     @MinLength(3)
     name: string;
   }
   ```

6. **Export services, not repositories**
   ```typescript
   @Module({
     exports: [UsersService], // ✅ Service
   })
   ```

7. **Use @nestjs/bullmq (NOT @nestjs/bull)**
   ```typescript
   import { BullModule } from '@nestjs/bullmq'; // ✅ Correct
   import { Processor, WorkerHost } from '@nestjs/bullmq';
   ```

8. **Extend WorkerHost for processors**
   ```typescript
   @Processor('queue-name', { concurrency: 5 })
   export class MyProcessor extends WorkerHost {
     async process(job: Job) { ... }
   }
   ```

### ❌ DON'T:

1. **Never use any types**
   ```typescript
   // ❌ Bad
   async findById(id: any): Promise<any>

   // ✅ Good
   async findById(id: string): Promise<User | null>
   ```

2. **Never access database from controllers**
   ```typescript
   // ❌ Bad
   @Controller()
   export class UsersController {
     constructor(private db: Database) {}
   }

   // ✅ Good
   @Controller()
   export class UsersController {
     constructor(private usersService: UsersService) {}
   }
   ```

3. **Never use serial IDs for distributed systems**
   ```typescript
   // ❌ Bad - exposes count
   id: serial('id').primaryKey()

   // ✅ Good - UUID
   id: uuid('id').defaultRandom().primaryKey()
   ```

4. **Never forget to filter soft deletes**
   ```typescript
   // ❌ Bad
   .where(eq(table.id, id))

   // ✅ Good
   .where(and(
     eq(table.id, id),
     isNull(table.deletedAt)
   ))
   ```

5. **Never use old @nestjs/bull**
   ```typescript
   // ❌ Wrong package
   import { BullModule } from '@nestjs/bull';
   import { Process, Processor } from '@nestjs/bull';

   // ✅ Correct package
   import { BullModule } from '@nestjs/bullmq';
   import { Processor, WorkerHost } from '@nestjs/bullmq';
   ```

---

## Common Patterns

### Pattern 1: Hybrid Queue + Database Tracking

```typescript
// When adding job
const bullmqJob = await this.queue.add('process', data);
await this.jobsRepository.create({
  entityId: data.id,
  bullmqJobId: bullmqJob.id,
  status: 'pending',
});

// In processor
@Processor('queue-name')
export class MyProcessor extends WorkerHost {
  async process(job: Job) {
    // Update to processing
    await this.jobsRepository.updateStatus(job.id, 'processing');

    try {
      // Do work
      await this.service.process(job.data);

      // Update to completed
      await this.jobsRepository.updateStatus(job.id, 'completed');
    } catch (error) {
      // Update to failed
      await this.jobsRepository.updateStatus(job.id, 'failed', error.message);
      throw error;
    }
  }
}
```

### Pattern 2: Duplicate Detection

```typescript
// Check by hash before creating
const existing = await this.repository.findByHash(hash);
if (existing) {
  // Create duplicate relationship
  await this.duplicatesService.markAsDuplicate(newId, existing.id, 'sha256');
  return existing;
}
```

### Pattern 3: Optimistic Image Processing

```typescript
// Generate only essential variants
const sizes = [200, 800]; // thumbnail, medium
const formats = ['webp'];  // modern format only

for (const size of sizes) {
  for (const format of formats) {
    // Generate variant
    const variant = await sharp(buffer)
      .resize(size, size, { fit: 'inside' })
      .toFormat(format, { quality: 85 })
      .toBuffer();

    // Save with proper naming: base_200.webp
    const key = `${baseKey}_${size}.${format}`;
  }
}
```

---

## Environment Variables Template

```env
# App
NODE_ENV=development
PORT=3000
API_PREFIX=api

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Optional
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## Docker Compose Template

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: dbname
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Debugging Checklist

When something doesn't work:

1. **Module not found?**
   - Check imports in `.module.ts`
   - Verify exports in provider modules
   - Check for circular dependencies (use `forwardRef()`)

2. **Queue not processing?**
   - Verify Redis connection
   - Check processor is in module providers
   - Ensure `@Processor` decorator matches queue name
   - Check concurrency settings

3. **Database query failing?**
   - Verify table exists (check migrations)
   - Check column names match schema
   - Use `.returning()` for INSERT/UPDATE if you need the result
   - Remember to filter soft deletes

4. **TypeScript errors?**
   - Run `pnpm exec tsc --noEmit`
   - Check for missing types
   - Verify imports are correct

---

## Performance Tips

1. **Use indexes on frequently queried columns**
2. **Implement pagination for list endpoints**
3. **Use Redis caching for hot data**
4. **Set appropriate queue concurrency**
5. **Monitor queue lengths (use Bull Board)**
6. **Use database connection pooling**
7. **Optimize image processing (WebP, quality 85%)**

---

## Version Control

```bash
# Commit messages format
feat: add user authentication
fix: resolve queue connection issue
refactor: improve error handling
docs: update API documentation
test: add unit tests for UserService
```

---

**Remember:** This is based on production-tested patterns from storage-service. Follow these guidelines for consistency across all microservices.
