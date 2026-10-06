# Phase 16 — AI Assistant & Gemini Integration — Final Report

## 1. Architecture Discovered

CampusVerse AI is a monorepo with:

- **Backend:** Express + TypeScript, Prisma/PostgreSQL, MongoDB (audit, notifications, AI conversations)
- **Frontend:** React + Vite, TanStack Query v5, protected routes, DashboardShell
- **Existing AI infrastructure:** `AIConversation` MongoDB schema, `GEMINI_API_KEY` env placeholder, navigation/search dead links to `/ai-assistant`
- **Patterns reused:** Module layout (dto → repository → service → controller → router → events → audit → tests), RBAC via `requirePermission`, MongoDB audit logging, in-process event bus

Phase 16 added a read-only, permission-aware AI assistant that grounds answers in live campus data via internal tools and a Gemini provider abstraction.

---

## 2. Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/modules/ai/ai.dto.ts` | Zod schemas, DTOs, system instruction |
| `apps/api/src/modules/ai/ai.repository.ts` | MongoDB conversation CRUD with ownership |
| `apps/api/src/modules/ai/ai.provider.ts` | `AIProvider` interface + `GeminiProvider` (REST fetch) |
| `apps/api/src/modules/ai/ai.tools.ts` | Permission-aware campus data tools |
| `apps/api/src/modules/ai/ai.service.ts` | Chat orchestration, context control, audit/events |
| `apps/api/src/modules/ai/ai.controller.ts` | HTTP handlers |
| `apps/api/src/modules/ai/ai.router.ts` | Routes mounted at `/api/v1/ai` |
| `apps/api/src/modules/ai/ai.events.ts` | Transport-agnostic AI events |
| `apps/api/src/modules/ai/ai.audit.service.ts` | MongoDB audit integration |
| `apps/api/src/modules/ai/ai.test.ts` | 20 deterministic tests (mocked provider) |
| `apps/web/src/hooks/useAI.ts` | TanStack Query hooks |
| `apps/web/src/pages/AIAssistant.tsx` | Enterprise chat UI |
| `apps/web/src/components/ai/ChatMessage.tsx` | Message bubble + sources |
| `apps/web/src/components/ai/ConversationSidebar.tsx` | Conversation list sidebar |

---

## 3. Files Modified

| File | Change |
|------|--------|
| `apps/api/src/config/env.ts` | Gemini + AI config (model, tokens, timeout, history, rate limits) |
| `apps/api/.env.example` | Documented Gemini/AI variables |
| `apps/api/src/middleware/rateLimiter.middleware.ts` | Added `aiRateLimiter` |
| `apps/api/src/modules/database/mongodb/schemas/aiConversation.schema.ts` | Optional `title`, typed `context` |
| `apps/api/src/modules/admin/admin.permissions.ts` | Added `ai.use` permission for all roles |
| `apps/api/src/server.ts` | Mounted `/api/v1/ai` |
| `apps/api/src/config/swagger.ts` | AI Assistant tag |
| `apps/web/src/types/index.ts` | AI TypeScript types |
| `apps/web/src/App.tsx` | `/ai-assistant` protected route |

---

## 4. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/ai/status` | JWT + `ai.use` | Gemini configuration status |
| `POST` | `/api/v1/ai/chat` | JWT + `ai.use` + `aiRateLimiter` | Send message, receive grounded response |
| `GET` | `/api/v1/ai/conversations` | JWT + `ai.use` | List user's conversations (paginated) |
| `GET` | `/api/v1/ai/conversations/:id` | JWT + `ai.use` | Get conversation history |
| `DELETE` | `/api/v1/ai/conversations/:id` | JWT + `ai.use` | Delete owned conversation |

**Chat response shape:**

```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "message": { "role": "assistant", "content": "...", "createdAt": "..." },
    "sources": [{ "type": "maintenance", "label": "Maintenance Records" }],
    "configured": true
  }
}
```

---

## 5. Gemini Provider Design

- **Interface:** `AIProvider` with `isConfigured()` and `generate()`
- **Implementation:** `GeminiProvider` uses native `fetch` to Google Generative Language API (no new npm dependency)
- **Configuration:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_TIMEOUT_MS`
- **Graceful degradation:** Missing key returns helpful message + truncated live context; app continues running
- **Security:** API key never exposed to clients; errors mapped to controlled `AppError` (502/503/504)

---

## 6. AI Tools

Keyword-based tool selection (max 5 tools per message):

| Tool | Data Source |
|------|-------------|
| `getCampusOverview` | DashboardService |
| `getBuildings` | Prisma building registry |
| `getDepartments` | Prisma departments |
| `getAssets` | Prisma asset aggregates |
| `getMaintenanceSummary` | MaintenanceService + Prisma |
| `getElectricitySummary` | AnalyticsService or Dashboard fallback |
| `getWaterSummary` | AnalyticsService or Dashboard fallback |
| `getParkingAvailability` | ParkingService |
| `getAnalyticsOverview` | AnalyticsService |
| `getRoomOccupancy` | AnalyticsService or Dashboard |
| `getAlerts` | NotificationRepository (user's unread) |

All tools are **read-only**. No mutations are exposed to Gemini.

---

## 7. RBAC Behavior

- Route access requires `ai.use` (granted to all default roles)
- Tool execution checks permissions per request via `AuthorizationService`
- `SUPER_ADMIN` bypasses permission checks
- Restricted tools return `{ denied: true, message: "You do not have permission..." }` rather than leaking data
- Examples:
  - `parking.view` required for parking availability
  - `analytics.view` required for full analytics overview
  - Electricity/water fall back to dashboard data when analytics permission is missing

---

## 8. Conversation Persistence

- Reuses existing MongoDB `AIConversation` schema
- Fields: `userId`, `title`, `messages[]` (role, content, timestamp), `context`, timestamps
- Ownership enforced on all read/write/delete operations (`userId` filter)
- Context window: last `AI_MAX_HISTORY_MESSAGES` (default 12) messages sent to Gemini
- Titles auto-derived from first user message

---

## 9. Audit / Event Integration

**Audit actions (MongoDB AuditLog):**

- `aiConversationCreated`
- `aiQuery` (latency, tools, success/failure — no message content or API keys)
- `aiConversationDeleted`
- `aiToolUsed`

**Events (in-process, transport-agnostic):**

- `ai.conversation.created`
- `ai.message.created`
- `ai.tool.used`
- `ai.response.completed`
- `ai.error`

---

## 10. Frontend Functionality

- **Route:** `/ai-assistant` (authenticated users, ProtectedRoute)
- **Navigation:** AI Assistant link active (no dead link)
- **Global search:** Campus AI Assistant entry navigates correctly
- **UI features:**
  - Conversation sidebar with new/delete
  - User/assistant message bubbles
  - Source reference badges
  - Quick prompt chips
  - Loading, error, retry states
  - Gemini unconfigured banner
  - Enter to send, Shift+Enter for newline
  - Auto-scroll, responsive layout

---

## 11. Security Measures

- JWT authentication required on all AI endpoints
- Conversation ownership enforced
- Permission-aware tool layer (no RBAC bypass)
- Read-only tools only — no autonomous writes
- User messages treated as untrusted; strong system instruction resists prompt injection
- No raw SQL, filesystem, shell, or arbitrary URL access
- API keys and tokens never logged or returned
- Stricter rate limiting on `POST /ai/chat` (30 req / 15 min default)
- Centralized error handling — no stack traces to clients

---

## 12. Tests

**AI module:** 20 tests (`apps/api/src/modules/ai/ai.test.ts`)

Coverage includes: tool selection, conversation CRUD, ownership, missing Gemini key, provider errors, audit/events, permission restrictions, source references, history truncation, rate limiter config.

**Regression totals:**

| Suite | Tests |
|-------|-------|
| Dashboard | 16 |
| Notifications | 17 |
| Admin | 38 |
| Maintenance | 17 |
| Electricity | 20 |
| Water | 19 |
| Parking | 24 |
| Analytics | 14 |
| **AI (new)** | **20** |
| **Total** | **185** |

All suites pass. No real Gemini API calls in tests.

---

## 13. Validation Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| Backend `npx tsc --noEmit` | Pass |
| Frontend `npm run typecheck` | Pass |
| Frontend `npm run lint` | Pass (pre-existing warnings only) |
| Frontend `npm run build` | Pass |
| All test suites | 185/185 |

---

## 14. Environment Configuration

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_MAX_OUTPUT_TOKENS=1024
GEMINI_TIMEOUT_MS=30000
AI_MAX_HISTORY_MESSAGES=12
AI_CHAT_RATE_LIMIT_WINDOW_MS=900000
AI_CHAT_RATE_LIMIT_MAX=30
```

When `GEMINI_API_KEY` is unset, the API and frontend continue to work; responses include retrieved campus context with a configuration notice.

---

## 15. Known Limitations

- Tool selection is keyword-based (not LLM function-calling) — may miss nuanced intents
- No vector DB, embeddings, or RAG pipeline
- No voice, image, or web browsing
- No Socket.IO streaming of responses
- No autonomous write actions through AI
- Existing deployments need DB re-seed or manual permission assignment for `ai.use` if roles were seeded before Phase 16

---

## 16. Recommended Phase 17

1. **LLM-native function calling** — Let Gemini invoke typed tools instead of keyword routing
2. **Streaming responses** — SSE or WebSocket for token-by-token delivery
3. **Conversation title summarization** — Auto-generate titles via LLM after first exchange
4. **Action workflows** — Explicit, audited human-in-the-loop mutations (e.g., create maintenance ticket draft)
5. **Admin AI analytics** — Usage metrics, cost tracking, popular queries dashboard
6. **Embeddings/RAG (optional)** — Document search for policies/SOPs separate from operational data

---

**Phase 16 status: COMPLETE**
