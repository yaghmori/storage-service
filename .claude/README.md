# Claude Project Guidelines

> Complete guide for building NestJS microservices following storage-service patterns

## 📚 Documentation Files

This directory contains comprehensive guidelines for building production-ready NestJS microservices:

### 1. [project-rules.md](./project-rules.md)
**Complete development guidelines covering:**
- Architecture principles (Clean Architecture, Layered approach)
- Technology stack requirements
- Project structure templates
- Database design patterns (Drizzle ORM)
- Queue system setup (BullMQ)
- API design conventions
- Code quality standards
- Testing strategies

**Use this when:** Starting a new service or setting up project structure

---

### 2. [claude-instructions.md](./claude-instructions.md)
**Quick reference for AI assistants with:**
- Technology stack requirements
- File structure templates
- Code templates (Repository, Service, Controller, Queue, Processor)
- Critical DO's and DON'Ts
- Common patterns
- Debugging checklist

**Use this when:** Building features or troubleshooting issues with Claude

---

### 3. [commands.md](./commands.md)
**Command reference covering:**
- Development commands (dev, build, test)
- Database operations (migrations, seeds)
- Docker commands (up, down, logs)
- Redis CLI commands
- PostgreSQL commands
- Debugging procedures
- Common issues & solutions

**Use this when:** Running daily development tasks

---

### 4. [architecture-decisions.md](./architecture-decisions.md)
**Architecture Decision Records (ADR) documenting:**
- Why Drizzle ORM over TypeORM/Prisma
- Why @nestjs/bullmq over @nestjs/bull
- Hybrid queue + database tracking strategy
- UUID vs Serial primary keys
- Soft delete implementation
- Image optimization strategy
- File deduplication approach
- Naming conventions

**Use this when:** Understanding design choices or making architectural decisions

---

## 🚀 Quick Start for New Service

### 1. Clone This Pattern
```bash
# Create new service directory
mkdir ../email-service
cd ../email-service

# Copy .claude directory
cp -r ../storage-service/.claude ./.claude

# Initialize NestJS project
npx @nestjs/cli new .
```

### 2. Install Core Dependencies
```bash
# Framework
pnpm add @nestjs/common @nestjs/core @nestjs/config @nestjs/platform-express

# Database (Drizzle + PostgreSQL)
pnpm add drizzle-orm postgres pg
pnpm add -D drizzle-kit @types/pg

# Queue (BullMQ)
pnpm add @nestjs/bullmq bullmq ioredis
pnpm add -D @types/ioredis

# Validation
pnpm add class-validator class-transformer

# Utilities
pnpm add uuid
pnpm add -D @types/uuid
```

### 3. Set Up Structure
Follow the structure in [project-rules.md](./project-rules.md):
```
src/
├── config/
├── database/
├── common/
├── health/
└── [your-features]/
```

### 4. Configure Database
1. Create `database.config.ts` using template in project-rules.md
2. Set up Drizzle schema in `database/schema/schema.ts`
3. Configure migrations: `drizzle.config.ts`

### 5. Set Up Queues
1. Create `queues/` module
2. Configure BullMQ using @nestjs/bullmq template
3. Add processors for background jobs

### 6. Add Health Checks
```typescript
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

---

## 📋 Development Checklist

When building a new feature:

- [ ] Create feature module
- [ ] Define database schema (Drizzle)
- [ ] Create migration
- [ ] Write repository (data access)
- [ ] Write service (business logic)
- [ ] Write controller (API endpoints)
- [ ] Add DTOs with validation
- [ ] Add queue jobs if needed
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Document API endpoints
- [ ] Add logging
- [ ] Handle errors properly

---

## 🎯 Key Principles

### 1. **Separation of Concerns**
```
Controller → Service → Repository → Database
```
Never skip layers!

### 2. **Type Safety First**
- Use TypeScript strict mode
- Define explicit types
- Never use `any`
- Leverage Drizzle's type inference

### 3. **Async Operations via Queues**
- Image processing → Queue
- Email sending → Queue
- Report generation → Queue
- File uploads → Direct (then queue for processing)

### 4. **Database Best Practices**
- UUID primary keys
- Timestamps on all tables
- Soft deletes for important data
- Indexes on queried fields
- Check constraints for data integrity

### 5. **Queue Best Practices**
- Use @nestjs/bullmq (NOT @nestjs/bull)
- Set retry attempts and backoff
- Track jobs in database (hybrid approach)
- Monitor with Bull Board
- Log all failures with context

---

## 🔍 Common Patterns

### Pattern 1: CRUD Repository
```typescript
class EntityRepository {
  async create(data) { ... }
  async findById(id) { ... }
  async update(id, data) { ... }
  async softDelete(id) { ... }
}
```

### Pattern 2: Background Job Processing
```typescript
// Service
await queue.add('send-email', { to, subject, body });

// Processor
@Processor('email-queue')
class EmailProcessor extends WorkerHost {
  async process(job) { ... }
}
```

### Pattern 3: Soft Delete Queries
```typescript
.where(and(
  eq(table.id, id),
  isNull(table.deletedAt)
))
```

### Pattern 4: Hybrid Job Tracking
```typescript
// Add job
const bullmqJob = await queue.add(...);
await jobsRepo.create({ bullmqJobId: bullmqJob.id, ... });

// Process
await jobsRepo.updateStatus(job.id, 'processing');
await jobsRepo.updateStatus(job.id, 'completed');
```

---

## 🛠️ Tech Stack Summary

| Category | Technology | Version | Why? |
|----------|-----------|---------|------|
| Framework | NestJS | 11.x | Industry standard, great DX |
| Language | TypeScript | 5.9+ | Type safety, modern features |
| Database | PostgreSQL | 16.x | Reliable, feature-rich |
| ORM | Drizzle | 0.45+ | Type-safe, performant |
| Queue | BullMQ | 5.x | Modern, reliable |
| Queue Integration | @nestjs/bullmq | 11.x | Official NestJS support |
| Cache/Queue Backend | Redis | 7.x | Fast, proven |
| Validation | class-validator | 0.14+ | Decorator-based validation |

---

## 📖 Learning Resources

### Official Documentation
- [NestJS Docs](https://docs.nestjs.com/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [BullMQ Guide](https://docs.bullmq.io/)

### Internal Guides
- [Full Project Rules](./project-rules.md)
- [Claude Instructions](./claude-instructions.md)
- [Command Reference](./commands.md)
- [Architecture Decisions](./architecture-decisions.md)

---

## 🤝 Contributing to Guidelines

When you discover a new pattern or best practice:

1. Document it in appropriate file
2. Add example code
3. Explain rationale
4. Update this README if needed

---

## 📝 Version History

- **v1.0** (2025-12-14): Initial guidelines based on storage-service
  - Architecture patterns
  - Tech stack decisions
  - Common patterns documented

---

## 💡 Tips for Claude

When assisting with development:

1. **Always check these guidelines first**
2. **Follow the templates exactly**
3. **Don't deviate from tech stack** (e.g., use Drizzle, not TypeORM)
4. **Reference specific ADRs** when explaining decisions
5. **Use patterns from storage-service** as examples

---

**Questions?** Check the guides above or refer to storage-service implementation.

**Building new service?** Follow the Quick Start section and checklist.

**Debugging issue?** Check commands.md and common issues section.
