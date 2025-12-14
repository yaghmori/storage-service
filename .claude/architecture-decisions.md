# Architecture Decision Records (ADR)

> Documenting key architectural decisions and their rationale

## ADR-001: Use Drizzle ORM instead of TypeORM

**Status:** Accepted
**Date:** 2025-12-14

### Context
Need a type-safe ORM for PostgreSQL with good TypeScript support.

### Options Considered
1. **TypeORM** - Most popular NestJS ORM
2. **Prisma** - Modern ORM with good DX
3. **Drizzle ORM** - Lightweight, SQL-first ORM

### Decision
Use **Drizzle ORM**

### Rationale
- ✅ True TypeScript type safety (better than TypeORM)
- ✅ SQL-first approach - closer to raw SQL
- ✅ Zero runtime overhead
- ✅ Excellent performance (faster than TypeORM/Prisma)
- ✅ Schema-first with migrations
- ✅ Better tree-shaking
- ❌ Smaller community than TypeORM

### Consequences
- Team needs to learn Drizzle syntax
- Fewer ready-made examples online
- More manual migration management
- Better performance and type safety

---

## ADR-002: Use @nestjs/bullmq instead of @nestjs/bull

**Status:** Accepted
**Date:** 2025-12-14

### Context
Need background job processing for async operations (image processing, emails, etc.).

### Options Considered
1. **@nestjs/bull** (old Bull library)
2. **@nestjs/bullmq** (new BullMQ library)

### Decision
Use **@nestjs/bullmq**

### Rationale
- ✅ BullMQ is the modern successor to Bull
- ✅ Better performance and features
- ✅ Official NestJS integration available
- ✅ Active development and maintenance
- ✅ Better TypeScript support
- ✅ More reliable Redis connection handling
- ❌ @nestjs/bull v10 has compatibility issues with BullMQ v5

### Consequences
- Must use `@Processor` and `WorkerHost` pattern
- Cannot use old `@Process` decorator
- Better reliability and performance
- More consistent with modern practices

---

## ADR-003: Hybrid Queue + Database Job Tracking

**Status:** Accepted
**Date:** 2025-12-14

### Context
Need to track job execution status for audit, analytics, and debugging.

### Options Considered
1. **Redis only** - Store all job data in Redis
2. **Database only** - Implement custom queue in Postgres
3. **Hybrid** - Redis for execution, Postgres for history

### Decision
Use **Hybrid approach**

### Rationale
- ✅ Redis: Fast, handles retries, real-time state
- ✅ Postgres: Permanent history, complex queries, analytics
- ✅ Best of both worlds
- ✅ Redis can clean up old jobs without losing history
- ✅ Can query job history with joins to other tables
- ❌ Slight complexity - two sources of truth

### Implementation
```typescript
// When creating job
const bullmqJob = await queue.add('process', data);
await jobsRepository.create({
  entityId: data.id,
  bullmqJobId: bullmqJob.id,
  status: 'pending',
});

// In processor
await jobsRepository.updateStatus(job.id, 'processing');
await jobsRepository.updateStatus(job.id, 'completed');
```

### Consequences
- Database records for every job (storage cost)
- Can generate reports on job success rates
- Historical debugging capabilities
- Compliance and audit trail

---

## ADR-004: UUID Primary Keys

**Status:** Accepted
**Date:** 2025-12-14

### Context
Choose primary key strategy for distributed system.

### Options Considered
1. **Serial/Auto-increment** - Traditional sequential IDs
2. **UUID** - Universally unique identifiers
3. **ULID** - Lexicographically sortable UUIDs

### Decision
Use **UUID v4 (random)**

### Rationale
- ✅ No collisions in distributed systems
- ✅ No information leakage (count/sequence)
- ✅ Can generate client-side
- ✅ Merge databases without conflicts
- ✅ PostgreSQL has native UUID support
- ❌ Larger than bigint (16 bytes vs 8 bytes)
- ❌ Not sortable by creation time

### Implementation
```typescript
id: uuid('id').defaultRandom().primaryKey()
```

### Consequences
- Better security (can't enumerate)
- Easier sharding/replication
- Slightly larger indexes
- URL-safe identifiers

---

## ADR-005: Soft Deletes for Important Data

**Status:** Accepted
**Date:** 2025-12-14

### Context
How to handle data deletion while maintaining audit trail.

### Options Considered
1. **Hard delete** - Permanently remove data
2. **Soft delete** - Mark as deleted with timestamp
3. **Archive table** - Move to separate archive table

### Decision
Use **Soft deletes** with `deletedAt` column

### Rationale
- ✅ Maintain audit trail
- ✅ Easy recovery from accidental deletion
- ✅ Compliance requirements
- ✅ Simple queries with `isNull(deletedAt)` filter
- ❌ Queries slightly more complex
- ❌ Storage not immediately freed

### Implementation
```typescript
deletedAt: timestamp('deleted_at'),

// Queries
.where(and(
  eq(table.id, id),
  isNull(table.deletedAt)
))
```

### Consequences
- Must remember to filter deleted records
- Can implement cleanup jobs for old data
- Better debugging and recovery
- Supports GDPR right to be forgotten (hard delete after retention period)

---

## ADR-006: Optimize Image Variants (2 files instead of 8)

**Status:** Accepted
**Date:** 2025-12-14

### Context
Original implementation created too many image variants.

### Before
- 4 sizes: 100px, 200px, 500px, 1000px
- 2 formats: WebP, AVIF
- Total: 8 files per image

### Decision
Reduce to **2 essential variants**
- 2 sizes: 200px (thumbnail), 800px (medium)
- 1 format: WebP only
- Total: 2 files per image

### Rationale
- ✅ 75% reduction in storage
- ✅ Faster processing
- ✅ WebP has 96%+ browser support
- ✅ Still covers all use cases:
  - 200px: Lists, grids, thumbnails
  - 800px: Detail views, responsive images
  - Original: Downloads, full-size display
- ❌ No AVIF (only 85% browser support, slower encoding)
- ❌ No ultra-large variants (can use original)

### Implementation
```typescript
sizes: [200, 800],
formats: ['webp'],
quality: 85
```

### Consequences
- Significant cost savings
- Faster job completion
- Simpler variant management
- May need to add sizes later if use cases emerge

---

## ADR-007: File Deduplication Strategy

**Status:** Accepted
**Date:** 2025-12-14

### Context
Handle duplicate file uploads efficiently.

### Strategy
1. **Detection**: SHA-256 hash before upload
2. **Storage**: Reuse original file's storage key
3. **Tracking**: Separate `fileDuplicates` table
4. **References**: Each upload gets unique file ID

### Rationale
- ✅ Saves storage (no duplicate uploads)
- ✅ Maintains referential integrity
- ✅ Each user/upload gets unique ID for tracking
- ✅ Can identify duplicates later
- ✅ Analytics on duplicate rates

### Implementation
```typescript
// files table: New record with same storageKey
INSERT INTO files (id, storage_key, file_hash, ...)

// file_duplicates table: Link duplicate to original
INSERT INTO file_duplicates (original_file_id, duplicate_file_id, detection_method)
```

### Consequences
- Storage optimization (only store once)
- Slightly more complex queries
- Better analytics capabilities
- Reference counting for cleanup

---

## ADR-008: WebP Quality 85%

**Status:** Accepted
**Date:** 2025-12-14

### Context
Balance between image quality and file size.

### Options Considered
- Quality 100: Maximum quality, large files
- Quality 90: High quality, medium files
- Quality 85: Good quality, small files
- Quality 80: Noticeable compression, very small files

### Decision
Use **Quality 85**

### Rationale
- ✅ Sweet spot for quality/size ratio
- ✅ ~30-40% smaller than quality 90
- ✅ Imperceptible quality loss for most images
- ✅ Industry standard (Google, Facebook use 80-85)
- ✅ Better bandwidth/storage costs

### Consequences
- Excellent compression
- Rare edge cases with visible artifacts
- Can adjust per use case if needed

---

## ADR-009: Proper File Extensions for Variants

**Status:** Accepted
**Date:** 2025-12-14

### Context
File variant naming convention.

### Before
```
uuid.png_thumb_200        ❌ Wrong extension
uuid.png_webp_200         ❌ Confusing
```

### After
```
uuid_200.webp             ✅ Clear and correct
uuid_800.webp             ✅ Proper extension
```

### Rationale
- ✅ Correct MIME type detection
- ✅ Works with CDNs and browsers
- ✅ Clear naming convention
- ✅ Easy to parse programmatically

---

## ADR-010: Bull Board for Queue Monitoring

**Status:** Accepted
**Date:** 2025-12-14

### Context
Need UI to monitor queue health and retry failed jobs.

### Decision
Use **Bull Board** at `/api/admin/queues`

### Rationale
- ✅ Official Bull/BullMQ dashboard
- ✅ Real-time queue monitoring
- ✅ Retry failed jobs manually
- ✅ Clean old jobs
- ✅ View job details and errors
- ⚠️ Should be behind authentication in production

### Security Note
Add authentication middleware for production:
```typescript
@Controller('admin/queues')
@UseGuards(AdminAuthGuard) // Add this!
export class BullBoardController {}
```

---

## Summary

These decisions prioritize:
1. **Performance** - Drizzle ORM, BullMQ, optimized images
2. **Type Safety** - TypeScript everywhere, Drizzle types
3. **Reliability** - Hybrid job tracking, soft deletes
4. **Cost Efficiency** - Deduplication, fewer variants
5. **Developer Experience** - Good tooling, clear patterns
6. **Maintainability** - Standard patterns, documentation

When creating email-service or other microservices, follow these same principles for consistency.
