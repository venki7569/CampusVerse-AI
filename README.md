# CampusVerse AI

CampusVerse AI is an AI-powered Smart Campus Digital Twin platform designed to simplify campus operations through real-time monitoring, analytics, IoT integration, predictive insights, and AI-assisted decision-making.

The platform supports facilities management, classroom occupancy, utilities, maintenance, parking, notifications, announcements, and campus-wide analytics.

## Architecture

| Layer | Technology |
|---|---|
| API | Express 5, TypeScript, Zod, Swagger |
| Web | React 19, Vite, TanStack Query v5, Tailwind CSS |
| Primary Database | PostgreSQL with Prisma ORM |
| Document Database | MongoDB for notifications, audit logs, AI, and analytics snapshots |
| Cache | Redis (optional, with graceful degradation) |
| Realtime | Socket.IO with JWT authentication |
| Authentication | JWT and role-based access control (RBAC) |
| AI | Gemini provider abstraction |

## Repository Structure

```text
apps/
  api/                 REST API and Socket.IO backend
  web/                 React frontend
docker-compose.yml     PostgreSQL, MongoDB, and Redis
```

## Prerequisites

- Node.js 20 or later
- Docker and Docker Compose (recommended)
- Gemini API key (optional; AI features may operate with reduced functionality without it)

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure

```bash
npm run docker:up
```

Alternatively:

```bash
docker compose up -d
```

### 3. Configure Environment Variables

Copy the example environment files.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

On Windows, you can also copy these files manually or use PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Configure the required environment variables in the generated files.

**Security:** Never commit `.env` files, credentials, API keys, or production secrets.

### 4. Configure the Database

```bash
npm run prisma:generate
npm run prisma:validate
```

For development database synchronization:

```bash
cd apps/api
npm run prisma:push
```

Alternatively, use migrations where configured:

```bash
npm run prisma:migrate:dev -- --name init
```

Run database commands from the directory specified by the project's package scripts.

### 5. Seed Demo Data

Configure `SEED_ADMIN_PASSWORD` and, optionally, `SEED_DEMO_PASSWORD` in `apps/api/.env`.

Then run:

```bash
npm run db:seed
```

The seed process creates demo users and sample campus data. It is designed to be idempotent.

### 6. Run Development Servers

From the repository root:

```bash
npm run dev:api
npm run dev:web
```

Development URLs:

- Frontend: http://localhost:5173
- API: http://localhost:5000
- API documentation: http://localhost:5000/api/v1/docs

The exact ports and documentation path depend on your environment configuration.

## Environment Variables

Refer to `apps/api/.env.example` and `apps/web/.env.example`.

| Variable | Purpose |
|---|---|
| `POSTGRES_URI` | PostgreSQL connection |
| `MONGODB_URI` | MongoDB connection |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret |
| `CORS_ORIGIN` | Allowed frontend origin |
| `REDIS_URI` | Optional caching and distributed rate limiting |
| `GEMINI_API_KEY` | Optional AI assistant integration |
| `SOCKET_ENABLED` | Enables or disables Socket.IO; defaults to `true` when configured |

Use strong, unique secrets in production and follow the validation rules defined by the application.

## Main Features

- Smart campus dashboard and analytics
- Campus asset and facilities management
- Classroom occupancy monitoring
- Maintenance request and lifecycle management
- Electricity and utilities analytics
- Parking management
- Notifications and announcements
- AI-assisted campus insights
- Role-based permissions
- Real-time dashboard updates
- Health checks and operational diagnostics

## Available Commands

Run commands from the repository root unless otherwise specified by the project configuration.

| Command | Description |
|---|---|
| `npm run dev` | Starts API and web development processes in parallel |
| `npm test` | Runs configured unit and mock E2E test suites |
| `npm run test:integration` | Runs integration tests |
| `npm run verify:infra` | Checks infrastructure availability |
| `npm run verify:seed` | Checks seed idempotency |
| `npm run typecheck` | Type-checks the API and web applications |
| `npm run lint` | Runs configured frontend linting |
| `npm run build` | Builds production applications |
| `npm run db:seed` | Seeds demo data |

Check the root and application-level `package.json` files for the exact supported commands.

## Realtime Architecture

Domain modules emit transport-independent events, such as dashboard and notification events. A Socket.IO event bridge forwards sanitized event payloads to authorized clients.

Example event channels:

- `user:{userId}` — user-specific notifications, AI interactions, and announcement updates
- `campus:updates` — dashboard, parking, analytics, maintenance, and announcement updates

REST APIs remain authoritative. Socket failures should not interrupt core API operations.

The frontend `RealtimeProvider` connects using JWT authentication and invalidates TanStack Query caches when relevant events arrive.

## Redis Behavior

When Redis is available, the application can cache dashboard summaries, analytics overviews, and notification unread counts. Redis-backed rate limiting can support multiple API instances.

When Redis is unavailable, the application can use configured in-memory fallbacks. Distributed behavior may be limited in fallback mode.

## Health Checks

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Liveness check |
| `GET /api/v1/health/ready` | Readiness and dependency checks |
| `GET /api/v1/health/config` | Safe configuration diagnostics without exposing secrets |

## Role-Based Access Control (RBAC)

Supported roles include:

- `SUPER_ADMIN`
- `CAMPUS_ADMIN`
- `DEPARTMENT_ADMIN`
- `FACULTY`
- `STUDENT`
- `MAINTENANCE_STAFF`
- `SECURITY_STAFF`

Permissions are loaded from the database for each request, while JWTs carry role information.

Related documentation:

- `docs/security/permission-matrix.md`
- `docs/go-live-checklist.md`
- `docs/production-readiness.md`
- `docs/operations/integration-verification.md`

## Testing

| Test Suite | Location | Purpose |
|---|---|---|
| Module unit tests | `apps/api/src/modules/` | Service and module logic |
| Security tests | `apps/api/src/test/security.test.ts` | Security verification |
| Department scope tests | `apps/api/src/test/department-scope.test.ts` | Department-level access controls |
| Authentication profile tests | `apps/api/src/test/auth-profile.test.ts` | Authentication and profile endpoints |
| E2E HTTP tests | `apps/api/src/test/e2e.test.ts` | HTTP journeys and authentication boundaries |
| Production tests | `apps/api/src/modules/production/production.test.ts` | Health, caching, and Socket.IO behavior |

Run the configured tests using the scripts in the root or API `package.json`.

## Demo Data

After configuring the seed passwords, run:

```bash
npm run db:seed
```

Depending on the configured seed implementation, demo data may include campus hierarchies, maintenance lifecycle samples, utilities history, IoT devices, announcements, notifications, and recommendations.

## Backup and Restore

Refer to `scripts/backup/README.md` for the project's PostgreSQL and MongoDB backup and restore procedures.

## Docker Production Build

Example build commands:

```bash
docker build -f apps/api/Dockerfile -t campusverse-api .
docker build -f apps/web/Dockerfile -t campusverse-web \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 .
```

Replace the example API URL with your deployed backend URL.

## Production Deployment Checklist

1. Configure strong JWT secrets and the correct production `CORS_ORIGIN`.
2. Apply database migrations using the configured production migration command.
3. Create administrator credentials through environment variables or a secure provisioning process.
4. Configure Redis when distributed caching and rate limiting are required.
5. Configure HTTPS, reverse proxy rules, and WebSocket upgrades.
6. Set `NODE_ENV=production`.
7. Verify readiness endpoints, database connectivity, and authentication.
8. Confirm secrets and environment files are excluded from Git.

## Known Limitations

- Announcement scheduling may use lazy promotion rather than a background worker.
- Notification fan-out may be synchronous.
- Multi-instance Socket.IO deployments may require a Redis adapter.

Verify these limitations against the current implementation before production deployment.

## License

ISC
