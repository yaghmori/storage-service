# Common Commands & Scripts

> Quick reference for development tasks

## Development

```bash
# Start development server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check (no compilation)
pnpm exec tsc --noEmit
```

## Database (Drizzle)

```bash
# Generate migration from schema changes
pnpm nx run storage-service:migrate:generate

# Apply pending migrations
pnpm nx run storage-service:migrate

# Push schema directly to database (development only)
pnpm nx run storage-service:migrate:push

# Check migration status
pnpm nx run storage-service:migrate:check

# Run seed data
pnpm nx run storage-service:seed
```

## Docker

```bash
# Start all services (Postgres + Redis)
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild services
docker-compose -f docker-compose.dev.yml up --build

# Clean volumes (reset database)
docker-compose -f docker-compose.dev.yml down -v
```

## Redis (Queue Management)

```bash
# Connect to Redis CLI
docker exec -it redis redis-cli

# Inside Redis CLI:
# List all keys
KEYS *

# Check queue length
LLEN bull:queue-name:wait

# Clear specific queue
DEL bull:queue-name:wait
DEL bull:queue-name:active
DEL bull:queue-name:completed
DEL bull:queue-name:failed

# Monitor Redis commands
MONITOR

# Get queue stats
HGETALL bull:queue-name:meta
```

## Database (PostgreSQL)

```bash
# Connect to database
docker exec -it postgres psql -U user -d dbname

# Inside PostgreSQL:
# List tables
\dt

# Describe table
\d table_name

# Run query
SELECT * FROM users LIMIT 10;

# Show all databases
\l

# Switch database
\c other_database

# Exit
\q
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Generate test coverage
pnpm test:cov
```

## Package Management

```bash
# Install dependencies
pnpm install

# Add new dependency
pnpm add package-name

# Add dev dependency
pnpm add -D package-name

# Remove dependency
pnpm remove package-name

# Update all dependencies
pnpm update

# Check outdated packages
pnpm outdated
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/feature-name

# Commit with conventional commit message
git commit -m "feat: add user authentication"
git commit -m "fix: resolve queue connection issue"
git commit -m "refactor: improve error handling"

# Push branch
git push -u origin feat/feature-name

# Create pull request (using GitHub CLI)
gh pr create --title "Add user authentication" --body "Description"
```

## Debugging

```bash
# View application logs
docker-compose -f docker-compose.dev.yml logs -f storage-service

# View Redis logs
docker-compose -f docker-compose.dev.yml logs -f redis

# View Postgres logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Check container status
docker-compose -f docker-compose.dev.yml ps

# Restart specific service
docker-compose -f docker-compose.dev.yml restart storage-service
```

## Bull Board (Queue Dashboard)

```
# Access queue dashboard
http://localhost:3000/api/admin/queues

# Features:
- View all queues
- See pending/active/completed/failed jobs
- Retry failed jobs
- Clean old jobs
- Monitor queue performance
```

## Health Checks

```bash
# Check application health
curl http://localhost:3000/health

# Check database health
curl http://localhost:3000/health/db

# Check Redis health
curl http://localhost:3000/health/redis
```

## Production

```bash
# Build Docker image
docker build -t storage-service:latest .

# Run production container
docker run -p 3000:3000 --env-file .env.production storage-service:latest

# View container logs
docker logs -f container_id
```

## Common Issues & Solutions

### Issue: Port already in use
```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>
```

### Issue: Database connection failed
```bash
# Check if Postgres is running
docker-compose ps postgres

# Restart Postgres
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Issue: Queue not processing
```bash
# Check if Redis is running
docker-compose ps redis

# Connect to Redis and check queues
docker exec -it redis redis-cli
> LLEN bull:image-processing:wait

# Check worker logs
docker-compose logs -f storage-service | grep Processor
```

### Issue: Migration failed
```bash
# Check migration status
pnpm nx run storage-service:migrate:check

# Rollback last migration (manual)
# Connect to DB and check migrations table
psql -U user -d dbname
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC;

# Drop last migration entry and re-run
DELETE FROM drizzle.__drizzle_migrations WHERE id = 'last_id';
```

## Useful Aliases (add to .bashrc or .zshrc)

```bash
# Docker Compose shortcuts
alias dc='docker-compose -f docker-compose.dev.yml'
alias dcup='docker-compose -f docker-compose.dev.yml up -d'
alias dcdown='docker-compose -f docker-compose.dev.yml down'
alias dclogs='docker-compose -f docker-compose.dev.yml logs -f'

# Database
alias psql-local='docker exec -it postgres psql -U user -d dbname'

# Redis
alias redis-cli-local='docker exec -it redis redis-cli'

# App
alias dev='pnpm dev'
alias build='pnpm build'
```

## Environment Setup

```bash
# Copy example env file
cp .env.example .env

# Edit environment variables
nano .env  # or vim .env or code .env

# Required variables:
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## Performance Monitoring

```bash
# View Bull Board
http://localhost:3000/api/admin/queues

# Check database query performance
# In psql:
EXPLAIN ANALYZE SELECT * FROM files WHERE file_hash = 'hash';

# Check Redis memory usage
# In redis-cli:
INFO memory

# Monitor active connections
# In psql:
SELECT * FROM pg_stat_activity;
```
