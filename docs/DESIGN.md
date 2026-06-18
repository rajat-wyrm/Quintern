# Design — Low-Level Details

> **Scope:** database schema, API endpoints, middleware chain, authentication flow,
> real-time protocol, security controls, environment configuration.
> **Audience:** developers implementing features, debugging, or reviewing PRs.

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Reference](#api-reference)
3. [Middleware Chain](#middleware-chain)
4. [Authentication & Authorization](#authentication--authorization)
5. [Real-Time Protocol (Socket.IO)](#real-time-protocol-socketio)
6. [Security Controls](#security-controls)
7. [Environment Configuration](#environment-configuration)
8. [Testing Strategy](#testing-strategy)

---

## Database Schema

### Entity Relationship (Logical)

```
departments ────< user_departments >──── users ────< refresh_tokens
                    │                    │              │
                    │                    ├──< manager_relations (self-ref)
                    │                    │
                    │                    ├──< attendance
                    │                    │
                    │                    ├──< ratings (rated_user_id)
                    │                    │      │
                    │                    │      └──< rating_categories
                    │                    │
                    │                    ├──< social_tasks (created_by)
                    │                    │
                    │                    ├──< proof_submissions (intern_id)
                    │                    │
                    │                    ├──< notifications
                    │                    │
                    │                    ├──< meetings (created_by)
                    │                    │      └──< meeting_attendees
                    │                    │
                    │                    ├──< sessions
                    │                    │
                    │                    ├──< projects (owner_id)
                    │                    │      ├──< project_members
                    │                    │      ├──< project_tasks
                    │                    │      ├──< project_milestones
                    │                    │      ├──< project_risks
                    │                    │      └──< project_meeting_notes
                    │                    │
                    │                    ├──< audit_logs
                    │                    │
                    │                    ├──< password_resets
                    │                    │
                    │                    └──< email_verifications
                    │
                    └──< login_attempts
```

### Tables (28 total)

#### Core

| Table | Columns | Notes |
|---|---|---|
| `users` | id (UUID PK), email (UNIQUE), password_hash, role (ENUM), manager_id (FK→users), department_id (FK→departments), full_name, avatar_url, suspended, phone, college, course, year_of_study, position, joining_date, internship_status, location, notes, email_verified, created_at, updated_at, deleted_at | 5 roles; soft-delete |
| `departments` | id (UUID PK), name (UNIQUE), created_by, created_at, updated_at, deleted_at | e.g. Engineering, Product |
| `user_departments` | user_id, department_id (composite PK) | Many-to-many bridge |

#### Attendance

| Table | Columns | Notes |
|---|---|---|
| `attendance` | id (UUID PK), user_id (FK), marked_by (FK), date (DATE), status (ENUM), remarks, created_at, updated_at, deleted_at | UNIQUE(user_id, date) |
| `attendance_status` | ENUM: PRESENT, ABSENT, LEAVE, EXAM_LEAVE, HALF_DAY, WFH | — |

#### Ratings

| Table | Columns | Notes |
|---|---|---|
| `ratings` | id (UUID PK), rated_user_id (FK), rated_by (FK), score (1-10), category (VARCHAR 30), remarks, created_at | Append-only |
| `rating_categories` | ENUM: PERFORMANCE, TASK, PROJECT, INTERN, TEAM, MENTOR, REVIEW | — |

#### Projects (Kanban)

| Table | Columns |
|---|---|
| `projects` | id (UUID PK), name, description, status (ENUM), health (ENUM), priority (ENUM), department_id (FK), owner_id (FK), start_date, due_date, progress (0-100), created_at, updated_at, deleted_at |
| `project_members` | project_id (FK), user_id (FK), role, joined_at. PK(project_id, user_id) |
| `project_tasks` | id (UUID PK), project_id (FK), parent_task_id (FK self), title, description, status (ENUM), priority (ENUM), assignee_id (FK), start_date, due_date, estimated_hours, actual_hours, position, created_by, created_at, updated_at, deleted_at |
| `project_milestones` | id (UUID PK), project_id (FK), name, description, due_date, completed_at, created_at, updated_at, deleted_at |
| `project_risks` | id (UUID PK), project_id (FK), title, description, severity (ENUM), mitigation, status, raised_by, created_at, updated_at, deleted_at |
| `project_task_dependencies` | task_id (FK), depends_on_id (FK). PK(task_id, depends_on_id) |
| `project_meeting_notes` | id (UUID PK), project_id (FK), meeting_id (FK), notes, decisions, action_items (JSONB), author_id, created_at, updated_at, deleted_at |

#### Enums (project-related)

| Enum | Values |
|---|---|
| `project_status` | PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED |
| `project_health` | HEALTHY, AT_RISK, CRITICAL, UNKNOWN |
| `project_priority` | LOW, MEDIUM, HIGH, CRITICAL |
| `task_status` | BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE |
| `task_priority` | LOW, MEDIUM, HIGH, CRITICAL |
| `risk_severity` | LOW, MEDIUM, HIGH, CRITICAL |

#### Social Tasks + Proofs

| Table | Columns |
|---|---|
| `social_tasks` | id (UUID PK), title, description, target_platform, task_link, deadline, created_by, created_at, updated_at, deleted_at |
| `proof_submissions` | id (UUID PK), task_id (FK), intern_id (FK), image_path, verified_by, verified_at, status (PENDING/APPROVED/REJECTED), created_at, updated_at, deleted_at |

#### Meetings

| Table | Columns |
|---|---|
| `meetings` | id (UUID PK), title, description, meeting_date, start_time, end_time, created_by, department_id, created_at, updated_at, deleted_at |
| `meeting_attendees` | meeting_id (FK), user_id (FK). PK(meeting_id, user_id) |

#### Auth / Sessions

| Table | Columns |
|---|---|
| `refresh_tokens` | id (UUID PK), user_id (FK), token_hash, expires_at, revoked (BOOL), created_at |
| `password_reset_tokens` | id (UUID PK), user_id (FK), token_hash, expires_at, used (BOOL), created_at |
| `email_verifications` | id (UUID PK), user_id (FK), token_hash, expires_at, used (BOOL), created_at |
| `login_attempts` | id (UUID PK), email, ip_address, success (BOOL), attempted_at |

#### System

| Table | Columns |
|---|---|
| `notifications` | id (UUID PK), user_id (FK), message (TEXT), read (BOOL), created_at, deleted_at |
| `audit_logs` | id (UUID PK), user_id, action, resource_type, resource_id, details (JSONB), old_value (JSONB), new_value (JSONB), ip_address, user_agent, created_at. Append-only. |
| `stripe_events` | id (TEXT PK → Stripe event ID), type, payload (JSONB), received_at. Created dynamically on first webhook. |
| `_migrations` | name (VARCHAR PK), applied_at | Migration tracking |

### Indexing Strategy

- Every FK column has an index
- Partial indexes on `WHERE deleted_at IS NULL` for soft-delete tables
- GIN trigram indexes (`pg_trgm`) on full-text search columns
- Composite indexes on common query patterns: `(user_id, date)`, `(rated_user_id, created_at)`, `(project_id, status, position)`
- Index on `audit_logs(action, created_at)` for admin filtering

### Soft Delete Pattern

Tables with `deleted_at` use soft delete. All queries filter `WHERE deleted_at IS NULL`.
A nightly cron hard-deletes rows where `deleted_at < now() - 90 days`.

```sql
-- Every soft-delete table has this partial index
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL;
```

---

## API Reference

### Base URL

| Environment | URL |
|---|---|
| Local dev | `http://localhost:5000` |
| Production | `https://api.your-domain.com` |

### Convention

- All endpoints return JSON
- Success: `2xx` with response body
- Client errors: `4xx` with `{ error: string, details?: [] }`
- Server errors: `5xx` with `{ error: string }`
- Pagination: `?page=1&limit=20` → `{ data: [], total, page, limit }`
- Auth: `Authorization: Bearer <accessToken>`
- CSRF: `X-CSRF-Token` header on state-changing requests

### Module Index

| Prefix | Module | Endpoints | Auth | RBAC |
|---|---|---|---|---|
| `POST /api/auth/register` | Auth | Register user | auth | ADMIN |
| `POST /api/auth/login` | Auth | Login | bruteForce | none |
| `POST /api/auth/refresh` | Auth | Rotate tokens | none | none |
| `POST /api/auth/logout` | Auth | Logout + revoke | auth | none |
| `GET /api/auth/csrf-token` | Auth | Get CSRF token | none | none |
| `POST /api/auth/forgot-password` | Auth | Send reset email | none | none |
| `POST /api/auth/reset-password` | Auth | Reset password | none | none |
| `POST /api/auth/verify-email` | Auth | Verify email | none | none |
| `POST /api/auth/resend-verification` | Auth | Resend verification | auth | none |
| `GET /api/users` | Users | List (paginated) | auth | ADMIN |
| `GET /api/users/me` | Users | Own profile | auth | none |
| `GET /api/users/:id` | Users | Get user | auth | ownership |
| `PATCH /api/users/:id` | Users | Update | auth | ADMIN |
| `DELETE /api/users/:id` | Users | Soft-delete | auth | ADMIN |
| `PATCH /api/users/:id/suspend` | Users | Suspend | auth | ADMIN |
| `PATCH /api/users/:id/activate` | Users | Activate | auth | ADMIN |
| `PATCH /api/users/me/password` | Users | Change password | auth | none |
| `PATCH /api/users/me` | Users | Update profile | auth | none |
| `POST /api/departments` | Departments | Create | auth | ADMIN |
| `GET /api/departments` | Departments | List | auth | none |
| `DELETE /api/departments/:id` | Departments | Delete | auth | ADMIN |
| `GET /api/hierarchy/my/direct-reports` | Hierarchy | Direct reports | auth | none |
| `GET /api/hierarchy/my/team` | Hierarchy | Full team (recursive) | auth | none |
| `GET /api/hierarchy/my/chain` | Hierarchy | Upward chain | auth | none |
| `GET /api/team/members` | Team | List members | auth | MANAGER_ROLES |
| `GET /api/team/members/export` | Team | CSV export | auth | MANAGER_ROLES |
| `POST /api/team/members` | Team | Create member | auth | MANAGER_ROLES |
| `GET /api/team/members/:id` | Team | Member detail | auth | MANAGER_ROLES + ownership |
| `PATCH /api/team/members/:id` | Team | Update member | auth | MANAGER_ROLES + ownership |
| `PATCH /api/team/members/:id/status` | Team | Suspend/activate | auth | MANAGER_ROLES + ownership |
| `POST /api/attendance/mark` | Attendance | Mark single | auth | CAPTAIN+ + directManager |
| `POST /api/attendance/bulk` | Attendance | Bulk mark | auth | CAPTAIN+ |
| `GET /api/attendance/:userId` | Attendance | Records | auth | ownership |
| `GET /api/attendance/:userId/stats` | Attendance | Monthly stats | auth | ownership |
| `POST /api/ratings` | Ratings | Submit (1-10) | auth | CAPTAIN+ + directManager |
| `GET /api/ratings/:userId` | Ratings | History | auth | ownership |
| `POST /api/tasks` | Social Tasks | Create | auth | ADMIN, SENIOR_TL |
| `GET /api/tasks` | Social Tasks | List | auth | none |
| `POST /api/proofs/submit` | Proofs | Submit proof | auth | INTERN |
| `PATCH /api/proofs/:id/verify` | Proofs | Verify | auth | CAPTAIN+ |
| `GET /api/proofs/task/:taskId` | Proofs | By task | auth | CAPTAIN+ |
| `GET /api/proofs/my` | Proofs | Own proofs | auth | none |
| `GET /api/notifications` | Notifications | List | auth | none |
| `PATCH /api/notifications/:id/read` | Notifications | Mark read | auth | none |
| `POST /api/notifications/read-all` | Notifications | Mark all read | auth | none |
| `DELETE /api/notifications/:id` | Notifications | Delete | auth | none |
| `GET /api/notifications/unread-count` | Notifications | Unread count | auth | none |
| `GET /api/audit` | Audit Log | List (paginated) | auth | ADMIN |
| `POST /api/uploads/avatar` | Uploads | Upload avatar | auth | none |
| `POST /api/uploads/file` | Uploads | Upload file | auth | none |
| `GET /api/uploads/file/:filename` | Uploads | Download | auth | none |
| `GET /api/analytics/overview` | Analytics | User counts | auth | ADMIN, SENIOR_TL |
| `GET /api/analytics/department-attendance` | Analytics | Dept rates | auth | ADMIN, SENIOR_TL |
| `GET /api/analytics/top-performers` | Analytics | Top by role | auth | CAPTAIN+ |
| `GET /api/analytics/attendance-trends` | Analytics | Trends | auth | ADMIN, SENIOR_TL |
| `GET /api/meetings` | Meetings | List | auth | none |
| `GET /api/meetings/:id` | Meetings | Get | auth | none |
| `POST /api/meetings` | Meetings | Create | auth | TL+ |
| `PATCH /api/meetings/:id` | Meetings | Update | auth | TL+ |
| `DELETE /api/meetings/:id` | Meetings | Delete | auth | TL+ |
| `POST /api/meetings/:id/attendees` | Meetings | Add attendee | auth | CAPTAIN+ |
| `DELETE /api/meetings/:id/attendees/:userId` | Meetings | Remove attendee | auth | CAPTAIN+ |
| `GET /api/sessions/me` | Sessions | List own | auth | none |
| `DELETE /api/sessions/me/:sessionId` | Sessions | Revoke own | auth | none |
| `POST /api/sessions/me/revoke-all` | Sessions | Revoke all own | auth | none |
| `POST /api/sessions/admin/revoke-user/:userId` | Sessions | Revoke all (admin) | auth | ADMIN |
| `GET /api/reports/attendance-summary` | Reports | Attendance | auth | ADMIN, SENIOR_TL |
| `GET /api/reports/ratings-summary` | Reports | Ratings | auth | ADMIN, SENIOR_TL |
| `GET /api/reports/task-completion` | Reports | Tasks | auth | ADMIN, SENIOR_TL |
| `GET /api/reports/department-attendance` | Reports | Per-dept | auth | ADMIN |
| `GET /api/reports/custom-summary` | Reports | Custom date range | auth | ADMIN |
| `GET /api/reports/export/:kind` | Reports | CSV export | auth | ADMIN, SENIOR_TL |
| `GET /api/projects` | Projects | List (scoped) | auth | none |
| `GET /api/projects/me` | Projects | My projects | auth | none |
| `GET /api/projects/me/tasks` | Projects | My tasks | auth | none |
| `GET /api/projects/:id` | Projects | Get | auth | none |
| `POST /api/projects` | Projects | Create | auth | CAPTAIN+ |
| `PATCH /api/projects/:id` | Projects | Update | auth | CAPTAIN+ |
| `DELETE /api/projects/:id` | Projects | Delete | auth | TL+ |
| `POST /api/projects/:id/tasks` | Projects | Add task | auth | CAPTAIN+ |
| `PATCH /api/projects/tasks/:taskId` | Projects | Update task | auth | none |
| `DELETE /api/projects/tasks/:taskId` | Projects | Delete task | auth | CAPTAIN+ |
| `POST /api/projects/:id/milestones` | Projects | Add milestone | auth | CAPTAIN+ |
| `PATCH /api/projects/milestones/:milestoneId` | Projects | Update milestone | auth | CAPTAIN+ |
| `POST /api/projects/:id/risks` | Projects | Add risk | auth | CAPTAIN+ |
| `PATCH /api/projects/risks/:riskId` | Projects | Update risk | auth | CAPTAIN+ |
| `POST /api/projects/:id/members` | Projects | Add member | auth | CAPTAIN+ |
| `DELETE /api/projects/:id/members/:userId` | Projects | Remove member | auth | CAPTAIN+ |
| `POST /api/ai/assistant` | AI | Chat | auth | none |
| `GET /api/ai/insights` | AI | Dashboard insights | auth | none |
| `GET /api/ai/search` | AI | Search (users/projects/tasks) | auth | none |
| `GET /api/ai/providers` | AI | Provider status | auth | none |
| `POST /api/stripe/webhook` | Stripe | Webhook receiver | none | none |
| `GET /api/stripe/events` | Stripe | Events list | auth | ADMIN |
| `GET /api/stripe/config` | Stripe | Config probe | auth | ADMIN |
| `GET /api/realtime/stats` | Realtime | Connected count | auth | none |
| `GET /health` | System | Liveness | none | none |
| `GET /health/db` | System | DB health | none | none |
| `GET /health/full` | System | Full health | none | none |
| `GET /api/ready` | System | Readiness | none | none |
| `GET /api/version` | System | Version info | none | none |
| `GET /metrics` | System | Prometheus | none | none |

---

## Middleware Chain

### Execution Order

Every protected request passes through these middleware in sequence:

```
1. Global onRequest hooks
   ├── CORS origin check
   ├── Rate-limit (per-IP)
   ├── Cookie parser
   ├── Request ID (UUID)
   └── Request logger (pino)

2. CSRF (onRequest, POST/PUT/PATCH/DELETE only)
   ├── Skip if EXEMPT list (auth endpoints, webhooks)
   └── HMAC-SHA256 double-submit cookie + header verification

3. Route preHandler
   ├── a) auth.js
   │     ├── Extract Bearer token from Authorization header
   │     ├── Reject tokens with jti claim (refresh tokens)
   │     ├── Verify with HS256 algorithm pinning
   │     ├── Check tokenVersion against DB
   │     └── Set req.user = { id, role, email, tokenVersion }
   │
   ├── b) rbac.js
   │     ├── Accept variadic role arguments
   │     └── req.user.role ∈ allowedRoles ? pass : 403
   │
   ├── c) ownership.js
   │     ├── Extract targetId from params/body
   │     ├── UUID format validation
   │     ├── Admin bypass
   │     └── checkHierarchyAccess(requesterId, targetId)
   │
   ├── d) directManager.js
   │     ├── Recursive CTE walking upward from target
   │     ├── MAX_CHAIN_DEPTH: ADMIN=99, SENIOR_TL=4, TL=3, CAPTAIN=2
   │     └── Rejects self-management
   │
   └── e) sanitize.js (opt-in per route)
         └── Strip HTML tags from request body
```

### Hierarchy Resolution (Recursive CTE)

```sql
WITH RECURSIVE hierarchy AS (
  -- Base: start from target user
  SELECT id, manager_id, 1 AS depth
  FROM users
  WHERE id = :targetId AND deleted_at IS NULL

  UNION ALL

  -- Step up: find manager
  SELECT u.id, u.manager_id, h.depth + 1
  FROM users u
  INNER JOIN hierarchy h ON u.id = h.manager_id
  WHERE u.deleted_at IS NULL
)
SELECT EXISTS (
  SELECT 1 FROM hierarchy WHERE id = :requesterId AND depth <= :maxDepth
) AS has_access;
```

### Direct Manager Validation

```sql
WITH RECURSIVE chain AS (
  SELECT id, manager_id, 1 AS lvl
  FROM users WHERE id = :subordinateId AND deleted_at IS NULL
  UNION ALL
  SELECT u.id, u.manager_id, c.lvl + 1
  FROM users u INNER JOIN chain c ON u.id = c.manager_id
  WHERE u.deleted_at IS NULL AND c.lvl < :maxDepth
)
SELECT EXISTS (SELECT 1 FROM chain WHERE id = :managerId) AS is_manager;
```

### Project Member Scoping

```sql
SELECT * FROM projects
WHERE deleted_at IS NULL
AND (
  owner_id = ANY(:hierarchyIds)
  OR id IN (
    SELECT project_id FROM project_members
    WHERE user_id = ANY(:hierarchyIds)
  )
);
```

---

## Authentication & Authorization

### Token Strategy

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access (JWT) | 15 min | Memory (Zustand) | API auth via `Authorization: Bearer` |
| Refresh (JWT) | 7 days | localStorage (encrypted) | Rotate for new access token |
| CSRF | Session | httpOnly cookie + header | POST/PUT/PATCH/DELETE protection |

### JWT Payload

```js
// Access token
{ sub: "uuid", role: "ADMIN", email: "a@b.com", tokenVersion: 1, iat, exp }

// Refresh token
{ sub: "uuid", jti: "unique-id", tokenVersion: 1, iat, exp }
```

### Token Rotation

Every `/api/auth/refresh` call:
1. Verifies current refresh token (HMAC, expiry, not revoked)
2. Invalidates old refresh token (Redis blacklist for remainder of 7d TTL)
3. Issues new access token + new refresh token
4. Old refresh token becomes single-use — stolen tokens self-destruct on first use

### Password Hashing

**Algorithm:** Argon2id (PHC winner 2015)

```
memoryCost:  19456 (19 MiB)
timeCost:    2
parallelism: 1
```

### Login Throttling

`bruteForce.js` tracks failed attempts per email + IP in `login_attempts` table:
- After 5 failures within 15 min window → exponential backoff
- Counter decays after 15 min of inactivity
- Successful login resets counter

### Role Hierarchy + Permission Matrix

```
ADMIN (rank 4)       → full access
SENIOR_TL (rank 3)   → manages TLs + Captains + Interns (max depth 4)
TL (rank 2)          → manages Captains + Interns (max depth 3)
CAPTAIN (rank 1)     → manages Interns (max depth 2)
INTERN (rank 0)      → self only
```

| Action | ADMIN | SENIOR_TL | TL | CAPTAIN | INTERN |
|---|---|---|---|---|---|
| Create user | ✓ | — | — | — | — |
| View any user | ✓ | reports | reports | own reports | self |
| Mark attendance (direct) | ✓ | ✓ | ✓ | ✓ | — |
| Mark own attendance | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rate direct report | ✓ | ✓ | ✓ | ✓ | — |
| View own ratings | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create project | ✓ | ✓ | — | — | — |
| Assign social task | ✓ | ✓ | ✓ | ✓ | — |
| Submit proof | ✓ | ✓ | ✓ | ✓ | ✓ |
| View audit log | ✓ | — | — | — | — |
| Export CSV | ✓ | — | — | — | — |
| View analytics | ✓ | ✓ | — | — | — |
| Real-time notifications | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Real-Time Protocol (Socket.IO)

### Connection

```js
{
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 60_000,
  cors: { origin: process.env.CORS_ORIGIN, credentials: true }
}
```

### Authentication (Handshake Middleware)

```js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('unauthorized'));
  const payload = jwt.verify(token, config.jwt.secret);
  socket.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
});
```

### Room Architecture

| Room | Members | Purpose |
|---|---|---|
| `user:<id>` | Single user | Targeted notifications |
| `role:<ADMIN\|SENIOR_TL\|TL\|CAPTAIN\|INTERN>` | All users of role | Role-wide broadcasts |
| `dept:<id>` | Department members | Department events |
| `global` | All connected | Presence + global announcements |

### Event Catalog

| Event | Direction | Payload | Description |
|---|---|---|---|
| `connect` | server → client | `{ id: socketId }` | Connection established |
| `disconnect` | server → client | `{ reason }` | Connection lost |
| `presence:update` | server → global | `{ userId, online, total }` | Online status change |
| `attendance-marked` | server → user | `{ attendance }` | Attendance recorded |
| `rating-received` | server → user | `{ rating }` | New rating |
| `notification:new` | server → user | `{ title, message }` | In-app notification |
| `meeting:created` | server → user | `{ meeting }` | Meeting invitation |
| `task:updated` | server → user | `{ task }` | Task change |
| `subscribe:department` | client → server | `deptId` | Join department room |
| `unsubscribe:department` | client → server | `deptId` | Leave department room |
| `ping:client` | client → server | `(ts, ack)` → `{ ts, server }` | RTT measurement |

### Client Integration (SocketBridge.jsx)

Invisible React component that:
1. Connects on login (token in `handshake.auth`)
2. Disconnects on logout
3. Subscribes to common events:
   - Invalidates matching react-query keys → UI auto-refreshes
   - Surfaces toasts → user sees it on any tab
4. Updates page `<title>` with `● Quintern` when connected

---

## Security Controls

### Defense in Depth

| Layer | Mechanism | Where |
|---|---|---|
| Transport | HTTPS / WSS | Edge/CDN |
| Headers | Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | Global plugin |
| Rate limit | Per-IP global + per-route tighter limits | Global + per-route |
| Authentication | JWT (HS256) + refresh rotation + tokenVersion check | auth.js |
| CSRF | HMAC double-submit cookie + header | csrf.js |
| SQL injection | Parameterized queries via pg binding | All repositories |
| XSS | React auto-escape + per-route sanitize.js | Frontend + optional backend |
| Path traversal | Strict filename regex + containment check | uploads/routes.js |
| Brute force | Exponential backoff after 5 failures | bruteForce.js |
| Hierarchy | Recursive CTE on every ownership check | ownership.js, hierarchy.js |
| Role check | RBAC middleware on every protected route | rbac.js |
| Audit trail | Immutable audit_logs on every state change | audit.js |
| Input validation | Zod schemas at every route entry | Each routes.js |
| Webhook forgery | HMAC-SHA256 timing-safe comparison | stripe/routes.js |
| File upload | Magic-byte validation (not Content-Type) | uploads/routes.js |

### CSRF Exempt Routes

```js
const CSRF_EXEMPT = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/stripe/webhook',
];
```

### Threat Model Coverage

**In scope:** unauthenticated access, cross-hierarchy access, CSRF, SQLi, XSS,
path traversal, brute force, webhook signature forgery, token theft (rotation).

**Out of scope (v1):** side-channel attacks, network DoS, physical DB security,
insider threats with direct DB access.

---

## Environment Configuration

### Required (production will not start without these)

```bash
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
CSRF_SECRET=<openssl rand -base64 48>
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
CORS_ORIGIN=https://your-domain.com
APP_URL=https://your-domain.com
```

### Optional (with defaults)

See [Environment Variables](../README.md#environment-variables) in the README for the
complete list including AI provider keys, Stripe, Cloudinary, Redis, email, and
integration settings.

---

## Testing Strategy

### Pyramid

```
                    ┌─────────┐
                    │   E2E   │  Playwright (v2 planned)
                    ├─────────┤
                ┌───┤  Smoke  ├───┐  CI: boot + 6 endpoint hits
                │   ├─────────┤   │
            ┌───┤   │Integration   ├───┐  Jest + supertest + fastify.inject
            │   │   │  (Jest)   │   │   44 tests, 4 suites
            │   │   ├───────────┤   │
        ┌───┤   │   │   Unit    │   │   helpers, pure functions
        │   │   │   │           │   │
        └───┴───┴───┴───────────┴───┘
```

### Test Suites

| Suite | Tests | Scope |
|---|---|---|
| `auth.test.js` | 18 | Login, register, refresh, logout, CSRF, rate-limit |
| `meetings.test.js` | 8 | CRUD, attendees, hierarchy scoping |
| `email.test.js` | 10 | SMTP send, rate-limit, bounce detection |
| `hierarchy.test.js` | 8 | Recursive CTE, chain depth, access checks |

### Diagnostic Scripts

```bash
node backend/scripts/test-ai-providers.js  # Test each AI provider
node backend/scripts/test-socket.js        # Socket.IO heartbeat test
bash /tmp/full-rbac-test.sh                # 5 roles × 27 modules
bash /tmp/stress-test.sh                   # 50 rounds × 18 endpoints
```

---

## Related

- [Architecture (HLD)](./ARCHITECTURE.md) — system context, container diagram, data flow, deployment
- [README](../README.md) — project overview, quick start
