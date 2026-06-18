# Architecture — High-Level Design

> **Scope:** system topology, module interactions, data flows, deployment model, scaling strategy.
> **Audience:** developers, infrastructure engineers, technical leads.

---

## Table of Contents

1. [System Context](#system-context)
2. [Container Diagram](#container-diagram)
3. [Module Interaction Map](#module-interaction-map)
4. [Request Lifecycle](#request-lifecycle)
5. [Data Flow — Key Scenarios](#data-flow--key-scenarios)
6. [Deployment Topology](#deployment-topology)
7. [Scaling Strategy](#scaling-strategy)
8. [Observability](#observability)

---

## System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           QUINTERN SYSTEM                                │
│                                                                          │
│  A 5-tier cohort operations platform managing the full intern-program    │
│  lifecycle — recruitment, attendance, ratings, projects, tasks, and      │
│  real-time collaboration — with a 7-provider AI fallback assistant.      │
└──────────────────────────────────────────────────────────────────────────┘
```

### External Actors

| Actor                 | Role                                       | Interaction     |
| --------------------- | ------------------------------------------ | --------------- |
| **Admin**             | Full access to all modules                 | Web UI, API     |
| **Senior TL**         | Department-wide management                 | Web UI, API     |
| **TL**                | Team-lead management of Captains + Interns | Web UI, API     |
| **Captain**           | Direct management of Interns               | Web UI, API     |
| **Intern**            | Self-service attendance, tasks, proofs     | Web UI, API     |
| **Stripe**            | Payment webhook provider                   | HTTPS callback  |
| **Cloudinary**        | File storage (avatars, proofs)             | HTTPS upload    |
| **AI Providers** (×7) | LLM inference chain                        | HTTPS API calls |
| **Neon (PostgreSQL)** | Primary data store                         | TCP/SSL         |
| **Upstash (Redis)**   | Cache, rate-limit, session blacklist       | HTTPS REST      |

---

## Container Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT TIER                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │ Vite SPA   │  │ Mobile Web │  │ cURL / SDK │  │ Socket.IO Client     │  │
│  │ React 19   │  │ responsive │  │ developers │  │ JWT handshake auth   │  │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────────┬───────────┘  │
└─────────┼────────────────┼───────────────┼───────────────────┼──────────────┘
          │ HTTPS/WSS      │ HTTPS/WSS     │ HTTPS             │ WSS
          ▼                ▼               ▼                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          EDGE / CDN (Vercel)                                 │
│  • Static asset caching (1y immutable)                                      │
│  • Gzip / Brotli compression                                                │
│  • HTTP/2 + HTTP/3                                                          │
│  • SPA fallback rewrites                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND TIER (Fastify / Node 24)                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PLUGIN LAYER                                   │   │
│  │  Helmet │ CORS │ Rate-Limit │ Cookie │ Multipart │ Compress │ Static  │   │
│  │  Swagger │ CSRF (HMAC) │ Prometheus                                    │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      MIDDLEWARE CHAIN                                 │   │
│  │  JWT Auth → RBAC → Ownership (hierarchy) → Direct Manager → Sanitize │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        MODULE LAYER                                    │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │  │ Auth │ │Users │ │Depts │ │Hierarchy│ │ Team │ │Atten-│ │Rates │  │   │
│  │  │      │ │      │ │      │ │        │ │      │ │dance │ │     │  │   │
│  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────┘ └──────┘ └──────┘  │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │  │Social│ │Proofs│ │Proj. │ │Meetings│ │Notif.│ │Audit │ │Sess. │  │   │
│  │  │Tasks │ │      │ │      │ │        │ │      │ │      │ │     │  │   │
│  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────┘ └──────┘ └──────┘  │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐          │   │
│  │  │Upload│ │Analyt│ │Report│ │  AI    │ │Stripe│ │Upto- │          │   │
│  │  │      │ │ ics  │ │     s│ │(7-prov)│ │      │ │skills│          │   │
│  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────┘ └──────┘          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      REAL-TIME LAYER (Socket.IO)                      │   │
│  │  JWT handshake auth → Rooms (user/role/dept/global) → Events pub/sub  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│   PostgreSQL 18  │                 │   Redis 7        │
│   (Neon)         │                 │   (Upstash)      │
│                  │                 │                  │
│   • 28 tables    │                 │   • Rate-limit   │
│   • 12 migrations│                 │   • Session cache│
│   • GIN indexes  │                 │   • AI cache     │
│   • Soft-delete  │                 │   • Token blackls│
└────────┬─────────┘                 └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │Cloudinary│ │  Stripe  │ │  AI Providers (×7)   │ │
│  │ •Avatars │ │ •Webhook │ │ Groq→Gemini→OpenAI→  │ │
│  │ •Proofs  │ │ •Events  │ │ HuggingFace→DeepSeek→│ │
│  │ •CDN URLs│ │ •Subscrip│ │ Anthropic→FastAPI→   │ │
│  └──────────┘ └──────────┘ │ heuristic (always)   │ │
│                            └──────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Module Interaction Map

### Dependency Graph (simplified)

```
auth ───────────────────────────────────────────────── all modules
  │
  ├── users ────────────────────────────────── departments, hierarchy
  ├── hierarchy ────────────────────────────── ownership middleware, team
  ├── attendance ───────────────────────────── audit, notifications
  ├── ratings ──────────────────────────────── audit, notifications
  ├── social-tasks ─────────────────────────── proof-submissions
  ├── projects ─────────────────────────────── tasks, milestones, risks
  ├── meetings ─────────────────────────────── audit
  ├── notifications ────────────────────────── realtime (Socket.IO)
  ├── reports ──────────────────────────────── attendance, ratings, tasks
  ├── analytics ────────────────────────────── attendance, ratings
  ├── ai ───────────────────────────────────── users, projects (search)
  ├── uploads ──────────────────────────────── cloudinary, local FS
  ├── stripe ───────────────────────────────── external webhook
  ├── sessions ─────────────────────────────── redis
  └── realtime ─────────────────────────────── socket.io + jwt
```

### Module → Repository Pattern

Every module follows a consistent layered architecture:

```
routes.js        ← HTTP handlers, validation (Zod), error mapping
  │
  ├── service.js   ← Business logic, multi-step operations (optional)
  │     │
  │     └── repository.js  ← Parameterized SQL queries only
  │
  └── middleware ← auth, rbac, ownership, directManager (as preHandler)
```

Key rule: **routes never import other modules' routes**. Cross-module data access goes through shared utilities (`utils/`) or direct database queries.

---

## Request Lifecycle

```
Client                    Server
  │                         │
  │──── HTTPS Request ────►│
  │                         │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  1. Fastify Router                     │
  │                  │     • Match method + path              │
  │                  │     • Apply global onRequest hooks     │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  2. Global Plugins                    │
  │                  │     • Helmet (security headers)        │
  │                  │     • CORS origin check               │
  │                  │     • Rate-limit (per-IP)             │
  │                  │     • Cookie parsing                  │
  │                  │     • Request logging (pino + reqId)  │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  3. CSRF Check (if POST/PUT/PATCH/    │
  │                  │     DELETE, excluding EXEMPT routes)  │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  4. Route preHandler chain            │
  │                  │     a) auth.js → JWT verify → req.user│
  │                  │     b) rbac.js → role allow-list      │
  │                  │     c) ownership.js → hierarchy check │
  │                  │     d) directManager.js → chain depth │
  │                  │     e) sanitize.js → XSS guard (opt)  │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  5. Route handler                     │
  │                  │     • Zod input validation             │
  │                  │     • Service / Repository call        │
  │                  │     • Audit log (state changes)        │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │                  ┌─────▼──────────────────────────────────┐
  │                  │  6. Response                          │
  │                  │     • JSON serialization              │
  │                  │     • Metrics update (prometheus)     │
  │                  │     • Compression (if applicable)     │
  │                  └─────┬──────────────────────────────────┘
  │                        │
  │◄──── HTTPS Response ───│
```

### Error Handling

Errors propagate through Fastify's error handler:

| Error Source        | HTTP Code | Response Shape                             |
| ------------------- | --------- | ------------------------------------------ |
| Zod validation      | 400       | `{ error, details: [{ field, message }] }` |
| JWT missing/expired | 401       | `{ error: "Unauthorized" }`                |
| RBAC deny           | 403       | `{ error: "Forbidden" }`                   |
| Ownership deny      | 403       | `{ error: "Forbidden" }`                   |
| Not found (DB)      | 404       | `{ error: "Not found" }`                   |
| Invalid UUID        | 400       | `{ error: "Invalid ID format" }`           |
| Rate-limited        | 429       | `{ error: "Too many requests" }`           |
| Internal            | 500       | `{ error: "Internal server error" }`       |

---

## Data Flow — Key Scenarios

### 1. Login + Token Lifecycle

```
Client                        Backend                         Database
  │                             │                                │
  │ POST /api/auth/login        │                                │
  │ { email, password }         │                                │
  ├───────────────────────────►│                                │
  │                             │── bruteForce check ──────────►│
  │                             │── SELECT user ───────────────►│
  │                             │◄── user row ──────────────────│
  │                             │                                │
  │                             │── Argon2id verify(password)    │
  │                             │── Check tokenVersion           │
  │                             │                                │
  │                             │── Generate accessToken (15m)   │
  │                             │── Generate refreshToken (7d)   │
  │                             │── Hash + INSERT refresh ─────►│
  │                             │                                │
  │◄── 200 { accessToken,      │                                │
  │         refreshToken,       │                                │
  │         user }              │                                │
  │                             │                                │
  │ ◄── CSRF cookie (httpOnly)  │                                │
```

### 2. Attendance Mark (Real-Time)

```
Captain                         Backend                    Intern (Socket.IO)
  │                                │                             │
  │ POST /api/attendance/mark      │                             │
  │ { userId, date, status }       │                             │
  ├──────────────────────────────►│                             │
  │                                │── RBAC: CAPTAIN+           │
  │                                │── directManager check      │
  │                                │── INSERT attendance        │
  │                                │── createAuditLog()          │
  │                                │                             │
  │                                │── socket.to(`user:${id}`)   │
  │                                │    .emit("attendance-marked")│
  │                                │───────────────────────────►│
  │                                │                             │
  │                                │── Invalidate react-query    │
  │                                │   cache on intern's client  │
  │                                │                             │
  │◄── 200 { attendance }          │                             │
```

### 3. AI Assistant (Provider Fallback Chain)

```
Client                         Backend                    AI Providers
  │                               │                             │
  │ POST /api/ai/assistant        │                             │
  │ { message, history }          │                             │
  ├─────────────────────────────►│                             │
  │                               │── Check LRU cache (5min)    │
  │                               │── Build role-aware prompt   │
  │                               │                             │
  │                               │── POST Groq ──────────────►│
  │                               │◄── 200 ✓ or error           │
  │                               │                             │
  │                               │ (on error → next provider)  │
  │                               │── POST Gemini ────────────►│
  │                               │◄── 200 ✓ or error           │
  │                               │                             │
  │                               │ (continues through ×7)      │
  │                               │── Local heuristic (always)  │
  │                               │                             │
  │◄── { answer, provider,        │                             │
  │       latencyMs, cached }     │                             │
```

### 4. Project Member Scoping

```
User (TL)                      Backend                         Database
  │                               │                                │
  │ GET /api/projects             │                                │
  ├─────────────────────────────►│                                │
  │                               │── auth → req.user = { TL }    │
  │                               │                                │
  │                               │── repository.listProjects()    │
  │                               │     │                          │
  │                               │     │ WITH RECURSIVE hierarchy │
  │                               │     │   (manager_id chain)     │
  │                               │     ├─────────────────────────►│
  │                               │     │◄── [userIds] ────────────│
  │                               │     │                          │
  │                               │     │ WHERE (owner_id = ANY    │
  │                               │     │   (:hierarchyIds)        │
  │                               │     │   OR project_members     │
  │                               │     │   IN (SELECT ...))       │
  │                               │     ├─────────────────────────►│
  │                               │     │◄── [projects] ───────────│
  │                               │                                │
  │◄── 200 [ projects ]           │                                │
```

### 5. Upload → Cloudinary with Local Fallback

```
Client                         Backend                     Cloudinary
  │                               │                             │
  │ POST /api/uploads/avatar      │                             │
  │ multipart (image)             │                             │
  ├─────────────────────────────►│                             │
  │                               │── Magic-byte validation     │
  │                               │   (PNG/JPEG/WebP/GIF only)  │
  │                               │                             │
  │                               │── if Cloudinary configured: │
  │                               │     POST signed upload ────►│
  │                               │◄──── 200 { secure_url } ────│
  │                               │                             │
  │                               │── else (fallback):           │
  │                               │     write to uploads/ dir    │
  │                               │                             │
  │                               │── UPDATE users SET avatar    │
  │                               │                             │
  │◄── { avatar_url, storage:     │                             │
  │       "cloudinary"|"local" }  │                             │
```

---

## Deployment Topology

### Production Stack ("Quintern Forever")

```
                         ┌──────────┐
                         │  Vercel  │  ← Frontend (SPA)
                         │  CDN     │
                         └────┬─────┘
                              │ HTTPS
                              ▼
                    ┌──────────────────┐
                    │     Render       │  ← Backend (Fastify)
                    │  (Docker)        │
                    │  • 1+ instances  │
                    │  • Health checks │
                    └────┬─────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │  Neon    │   │ Upstash  │   │Cloudinary│
   │Postgres  │   │  Redis   │   │  CDN     │
   └──────────┘   └──────────┘   └──────────┘
```

### Docker Local Dev

```bash
docker compose up -d
# → postgres:18, backend:5000
```

### Docker Production

```bash
docker compose -f docker-compose.production.yml up -d
# → postgres:18-alpine, redis:7-alpine, backend:5000, frontend:8080
```

### Monitoring Stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
# → prometheus + grafana on :3000
```

---

## Scaling Strategy

| Tier          | Strategy                                                                      | Limit                   |
| ------------- | ----------------------------------------------------------------------------- | ----------------------- |
| **Frontend**  | Static SPA, CDN-cached by Vercel                                              | Infinity                |
| **Backend**   | Stateless, horizontal scaling on Render. Behind load balancer                 | Instance count          |
| **Socket.IO** | Single-instance v1. Multi-instance with `@socket.io/redis-adapter` planned v2 | ~10k conn/instance      |
| **Database**  | Neon auto-scales. PgBouncer transaction mode. Read replicas for analytics     | Connection pool         |
| **Cache**     | Upstash Redis serverless, auto-scales                                         | Per-plan QPS            |
| **AI**        | Provider chain degrades gracefully. 200-entry LRU cache reduces quota burn    | Per-provider rate limit |

---

## Observability

### Logging (Pino)

Every request gets a UUID `reqId`. Structured JSON logs at configurable level (default `info`).

```json
{
  "level": 30,
  "time": 1718612345678,
  "reqId": "abc-123",
  "req": { "method": "GET", "url": "/api/users/me" },
  "res": { "statusCode": 200 },
  "responseTime": 12
}
```

### Metrics (Prometheus)

| Metric                           | Type      | Labels                     |
| -------------------------------- | --------- | -------------------------- |
| `http_request_duration_ms`       | Histogram | method, route, status_code |
| `http_requests_active`           | Gauge     | —                          |
| `process_cpu_user_seconds_total` | Counter   | —                          |
| `process_resident_memory_bytes`  | Gauge     | —                          |
| `nodejs_eventloop_lag_seconds`   | Gauge     | —                          |

### Health Probes

| Endpoint           | Purpose                 | Expected                       |
| ------------------ | ----------------------- | ------------------------------ |
| `GET /health`      | Liveness + DB ping      | `200 { status: "ok" }`         |
| `GET /health/db`   | DB-only check           | `200` or `503`                 |
| `GET /health/full` | DB + Redis check        | `200` or `503`                 |
| `GET /api/ready`   | Process readiness       | `200`                          |
| `GET /api/version` | Deployment verification | `{ name, version, node, env }` |
| `GET /metrics`     | Prometheus scrape       | `text/plain` exposition        |

---

## Related

- [Design (LLD)](./DESIGN.md) — database schema, API reference, middleware, auth, real-time
- [README](../README.md) — project overview, quick start
