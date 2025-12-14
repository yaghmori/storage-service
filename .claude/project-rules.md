# Project Development Rules & Guidelines

> Based on storage-service architecture - Reusable template for microservices

## Table of Contents
- [Architecture Principles](#architecture-principles)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Guidelines](#database-guidelines)
- [Queue & Background Jobs](#queue--background-jobs)
- [API Design](#api-design)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Architecture Principles

### 1. **Layered Architecture (Clean Architecture)**
```
┌─────────────────────────────────────┐
│  Controllers (API Layer)            │  ← HTTP/TCP endpoints
├─────────────────────────────────────┤
│  Services (Business Logic)          │  ← Core functionality
├─────────────────────────────────────┤
│  Repositories (Data Access)         │  ← Database operations
├─────────────────────────────────────┤
│  Database/External Services         │  ← Infrastructure
└─────────────────────────────────────┘
```

**Rules:**
- ✅ Controllers only handle HTTP/validation
- ✅ Services contain ALL business logic
- ✅ Repositories are the ONLY layer that touches the database
- ✅ Never put business logic in controllers or repositories
- ❌ Never access database directly from services - always use repositories

### 2. **Module Organization**
```typescript
src/
├── app.module.ts              // Root module
├── config/                    // Configuration
│   ├── config.module.ts
│   ├── config.service.ts
│   ├── database.config.ts
│   └── redis.config.ts
├── database/                  // Database layer
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── migrations/
│   ├── schema/
│   └── seed/
├── [feature]/                 // Feature modules
│   ├── [feature].module.ts
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── dtos/
│   └── types/
├── common/                    // Shared utilities
│   ├── filters/
│   ├── interceptors/
│   └── decorators/
└── health/                    // Health checks
```

**Rules:**
- ✅ One feature per module
- ✅ Each module is self-contained
- ✅ Use `forwardRef()` for circular dependencies
- ✅ Export only what's needed by other modules

---

## Technology Stack

### **Required Dependencies**

#### Core Framework
```json
{
  "@nestjs/common": "^11.0.0",
  "@nestjs/core": "^11.0.0",
  "@nestjs/config": "^3.1.1",
  "@nestjs/platform-express": "^11.0.0"
}
```

#### Database (PostgreSQL + Drizzle ORM)
```json
{
  "drizzle-orm": "^0.45.1",
  "postgres": "^3.4.7",
  "pg": "^8.11.3"
}
```

**Why Drizzle ORM?**
- ✅ Type-safe SQL queries
- ✅ Zero-cost abstractions
- ✅ Better performance than TypeORM
- ✅ Schema-first approach
- ✅ Excellent TypeScript support

#### Queue System (BullMQ)
```json
{
  "@nestjs/bullmq": "^11.0.4",
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.2"
}
```

**Why BullMQ?**
- ✅ Modern, actively maintained
- ✅ Better performance than old Bull
- ✅ Built-in retry & backoff strategies
- ✅ Job prioritization
- ✅ Official NestJS integration

#### Validation
```json
{
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1"
}
```

---

## Project Structure

### **Feature Module Template**

```typescript
// [feature]/[feature].module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { [Feature]Controller } from './controllers/[feature].controller';
import { [Feature]Service } from './services/[feature].service';
import { [Feature]Repository } from './repositories/[feature].repository';

@Module({
  imports: [DatabaseModule],
  controllers: [[Feature]Controller],
  providers: [[Feature]Service, [Feature]Repository],
  exports: [[Feature]Service], // Export services, not repositories
})
export class [Feature]Module {}
```

### **Controller Template**

```typescript
// controllers/[feature].controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { [Feature]Service } from '../services/[feature].service';
import { Create[Feature]Dto } from '../dtos/create-[feature].dto';

@Controller('[feature]')
export class [Feature]Controller {
  constructor(private readonly [feature]Service: [Feature]Service) {}

  @Post()
  create(@Body() dto: Create[Feature]Dto) {
    return this.[feature]Service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.[feature]Service.findById(id);
  }
}
```

### **Service Template**

```typescript
// services/[feature].service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { [Feature]Repository } from '../repositories/[feature].repository';

@Injectable()
export class [Feature]Service {
  constructor(private readonly repository: [Feature]Repository) {}

  async create(data: Create[Feature]Dto) {
    // Business logic here
    return this.repository.create(data);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`[Feature] with ID ${id} not found`);
    }
    return entity;
  }
}
```

### **Repository Template**

```typescript
// repositories/[feature].repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/schema';

@Injectable()
export class [Feature]Repository {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: Create[Feature]Data) {
    const result = await this.db
      .insert(schema.[table])
      .values(data)
      .returning();
    return result[0];
  }

  async findById(id: string) {
    const result = await this.db
      .select()
      .from(schema.[table])
      .where(eq(schema.[table].id, id))
      .limit(1);
    return result[0] || null;
  }
}
```

---

## Database Guidelines

### **Schema Design Principles**

#### 1. **Use UUIDs for Primary Keys**
```typescript
// ✅ Good - UUID for distributed systems
id: uuid('id').defaultRandom().primaryKey(),

// ❌ Avoid - Serial IDs leak information
id: serial('id').primaryKey(),
```

#### 2. **Always Include Timestamps**
```typescript
createdAt: timestamp('created_at').notNull().defaultNow(),
updatedAt: timestamp('updated_at').notNull().defaultNow(),
```

#### 3. **Soft Deletes for Important Data**
```typescript
deletedAt: timestamp('deleted_at'),

// Query pattern
.where(and(
  eq(table.id, id),
  isNull(table.deletedAt) // Only active records
))
```

#### 4. **Use Enums for Fixed Values**
```typescript
export const statusEnum = pgEnum('status', ['pending', 'completed', 'failed']);

// In table
status: statusEnum('status').notNull().default('pending'),
```

#### 5. **Add Indexes for Query Performance**
```typescript
}, (table) => ({
  // Single column indexes
  emailIdx: index('users_email_idx').on(table.email),

  // Composite indexes for common queries
  userStatusIdx: index('users_user_status_idx').on(table.userId, table.status),

  // Unique constraints
  emailUnique: unique('users_email_unique').on(table.email),
}));
```

#### 6. **Use Check Constraints for Data Integrity**
```typescript
// Check constraints
referenceCountCheck: check('files_reference_count_check',
  sql`${table.referenceCount} >= 0`),
progressCheck: check('jobs_progress_check',
  sql`${table.progress} IS NULL OR (${table.progress} >= 0 AND ${table.progress} <= 100)`),
```

### **Migration Strategy**

```bash
# Generate migration
pnpm nx run [service]:migrate:generate

# Apply migration
pnpm nx run [service]:migrate

# Always commit migrations to git
git add src/database/migrations/
git commit -m "feat: add [feature] table migration"
```

---

## Queue & Background Jobs

### **Queue Setup (BullMQ + @nestjs/bullmq)**

#### 1. **Queue Module Configuration**
```typescript
// queues/queues.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (redisConfig: RedisConfig) => ({
        connection: redisConfig.connectionOptions,
      }),
      inject: [RedisConfig],
    }),
    BullModule.registerQueue(
      {
        name: 'email-sending',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      },
    ),
  ],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
```

#### 2. **Queue Service**
```typescript
// queues/queues.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue('email-sending')
    private readonly emailQueue: Queue,
  ) {}

  async addEmailJob(data: EmailJobData) {
    return this.emailQueue.add('send-email', data, {
      priority: data.priority || 1,
    });
  }
}
```

#### 3. **Processor (Worker)**
```typescript
// processing/processors/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('email-sending', { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    this.logger.log(`Processing email job ${job.id}`);

    try {
      await this.emailService.send(job.data);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error; // BullMQ will retry based on config
    }
  }
}
```

### **Queue Best Practices**

✅ **DO:**
- Use queues for async operations (emails, file processing, reports)
- Set appropriate retry attempts and backoff strategies
- Log job failures with context
- Keep job data small (store large data in DB, pass ID)
- Use priority for urgent jobs
- Monitor queue health with Bull Board

❌ **DON'T:**
- Use queues for real-time operations (use WebSockets instead)
- Store large binary data in job payload
- Forget to handle job failures
- Set unlimited retries

### **Database Job Tracking (Hybrid Approach)**

**Pattern: Redis for execution, Postgres for audit trail**

```typescript
// When adding job
const bullmqJob = await queue.add('process', data);
await jobsRepository.create({
  entityId: data.id,
  jobType: 'processing',
  status: 'pending',
  bullmqJobId: bullmqJob.id,
});

// When processing
await jobsRepository.updateStatus(jobId, 'processing');

// When complete
await jobsRepository.updateStatus(jobId, 'completed');
```

**Why?**
- ✅ Redis: Fast, handles retries, manages execution
- ✅ Postgres: Permanent audit trail, analytics, complex queries
- ✅ Best of both worlds

---

## API Design

### **RESTful Conventions**

```typescript
// ✅ Good - RESTful routes
GET    /users              // List all
GET    /users/:id          // Get one
POST   /users              // Create
PATCH  /users/:id          // Partial update
PUT    /users/:id          // Full update
DELETE /users/:id          // Delete

// ✅ Good - Nested resources
GET    /users/:userId/posts
POST   /users/:userId/posts

// ❌ Avoid - Non-RESTful verbs
POST   /users/create       // Use POST /users
GET    /users/get/:id      // Use GET /users/:id
```

### **DTOs (Data Transfer Objects)**

```typescript
// dtos/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}
```

### **Response Format**

```typescript
// ✅ Good - Consistent response structure
{
  "data": { ... },           // Single entity
  "data": [ ... ],           // List
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}

// ✅ Good - Error response
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## Code Quality

### **TypeScript Rules**

```typescript
// ✅ Good - Explicit types
async findById(id: string): Promise<User | null> {
  // ...
}

// ❌ Avoid - Any types
async findById(id: any): Promise<any> {
  // ...
}
```

### **Error Handling**

```typescript
// ✅ Good - Specific exceptions
if (!user) {
  throw new NotFoundException(`User with ID ${id} not found`);
}

// ✅ Good - Try-catch for external calls
try {
  await externalAPI.call();
} catch (error) {
  this.logger.error('External API failed', error.stack);
  throw new ServiceUnavailableException('Email service unavailable');
}
```

### **Logging**

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  async process() {
    this.logger.log('Processing started');        // Info
    this.logger.error('Failed', error.stack);     // Error
    this.logger.warn('Deprecated method used');   // Warning
    this.logger.debug('Debug info', data);        // Debug
  }
}
```

### **Environment Variables**

```typescript
// config/config.service.ts
@Injectable()
export class ConfigService {
  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL') || 'postgres://localhost/db';
  }

  get isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }
}
```

---

## Testing

### **Unit Tests**

```typescript
// *.service.spec.ts
describe('UserService', () => {
  let service: UserService;
  let repository: MockRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should create user', async () => {
    const dto = { email: 'test@example.com', name: 'Test' };
    const result = await service.create(dto);
    expect(result).toBeDefined();
  });
});
```

### **Integration Tests**

```typescript
// *.e2e-spec.ts
describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', name: 'Test' })
      .expect(201);
  });
});
```

---

## Documentation

### **Code Comments**

```typescript
/**
 * Schedule processing jobs based on file type
 * This runs asynchronously and doesn't block the upload response
 *
 * @param fileId - The unique file identifier
 * @param mimetype - MIME type to determine processing type
 */
private async scheduleProcessingJobs(fileId: string, mimetype: string): Promise<void> {
  // ...
}
```

### **README Structure**

```markdown
# [Service Name]

Brief description of what this service does.

## Features

- Feature 1
- Feature 2

## Tech Stack

- NestJS 11
- PostgreSQL 16
- Redis 7
- BullMQ 5

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker & Docker Compose

### Installation
\`\`\`bash
pnpm install
\`\`\`

### Configuration
Copy `.env.example` to `.env` and configure:
\`\`\`env
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379
\`\`\`

### Running
\`\`\`bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
\`\`\`

## API Documentation

See [API.md](./docs/API.md)

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
```

---

## Quick Start Checklist

When starting a new service:

- [ ] Initialize NestJS project
- [ ] Set up database (Drizzle ORM)
- [ ] Configure Redis & BullMQ
- [ ] Create base modules (config, database, health)
- [ ] Set up Docker Compose for development
- [ ] Configure environment variables
- [ ] Add logging and error handling
- [ ] Set up Bull Board for queue monitoring
- [ ] Write initial migrations
- [ ] Create README with setup instructions
- [ ] Configure CI/CD pipeline

---

## Common Patterns from storage-service

### Pattern: Duplicate Detection & Deduplication
- Hash-based detection (SHA-256)
- Separate tracking table (`fileDuplicates`)
- Reference counting
- Storage reuse for duplicates

### Pattern: File Variants
- Generate multiple sizes/formats
- Proper naming conventions
- Quality optimization
- Lazy generation (on-demand)

### Pattern: Job Processing
- Queue → Database tracking (hybrid)
- Retry with exponential backoff
- Progress tracking
- Error logging

### Pattern: Soft Deletes
- `deletedAt` timestamp
- Filter in queries
- Cleanup jobs for old records

---

**Version:** 1.0
**Last Updated:** 2025-12-14
**Based on:** storage-service architecture
