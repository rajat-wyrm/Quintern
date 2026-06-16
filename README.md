# Quintern

> **quin (five) + intern — a 5-tier cohort operations platform with real-time collaboration and a 7-provider AI assistant.**

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-1f2937?style=for-the-badge)](#license)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![CI](https://img.shields.io/badge/CI-3_checks_passing-22c55e?style=for-the-badge&logo=githubactions&logoColor=white)](#ci--cd)
[![Tests](https://img.shields.io/badge/Tests-44%2F44-22c55e?style=for-the-badge&logo=jest&logoColor=white)](#testing)

---

## Maintainer

**Rajat Kumar** — Project Management, Uptoskills

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Quintern Philosophy](#the-quintern-philosophy)
3. [What is Quintern?](#what-is-quintern)
4. [Highlights](#highlights)
5. [System Architecture](#system-architecture)
6. [Technology Stack](#technology-stack)
7. [The 5-Tier Hierarchy](#the-5-tier-hierarchy)
8. [Backend Architecture](#backend-architecture)
9. [Frontend Architecture](#frontend-architecture)
10. [Real-Time Layer (Socket.IO)](#real-time-layer-socketio)
11. [AI Assistant — 7-Provider Fallback Chain](#ai-assistant--7-provider-fallback-chain)
12. [Authentication & Authorization](#authentication--authorization)
13. [Database Design](#database-design)
14. [Module Reference](#module-reference)
15. [API Reference](#api-reference)
16. [Security Architecture](#security-architecture)
17. [File Storage — Cloudinary Integration](#file-storage--cloudinary-integration)
18. [Payments — Stripe Webhook](#payments--stripe-webhook)
19. [Performance & Scalability](#performance--scalability)
20. [Observability](#observability)
21. [CI / CD](#ci--cd)
22. [Deployment](#deployment)
23. [Local Development](#local-development)
24. [Environment Variables](#environment-variables)
25. [Testing Strategy](#testing-strategy)
26. [Project Structure](#project-structure)
27. [Roadmap](#roadmap)
28. [Contributing](#contributing)
29. [License](#license)
30. [Acknowledgements](#acknowledgements)

---

## Executive Summary

**Quintern** is a production-grade workforce and intern operations platform that consolidates the entire intern-program lifecycle — recruitment to retention — into a single, real-time, AI-augmented system.

The platform models the real-world structure of a high-performing internship program as a **5-tier cohort hierarchy** (Admin → Senior TL → TL → Captain → Intern), and enforces it end-to-end at the database, middleware, API, and UI layers. Every action — every attendance mark, every rating, every task assignment, every login — flows through this hierarchy, is validated against it, and is recorded in an immutable audit log.

A 7-provider AI assistant provides natural-language insights, summaries, and recommendations that are **role-aware** (the same question gets a different answer for an Admin versus an Intern). A Socket.IO real-time layer pushes notifications, presence, and live data updates to every connected client in under 10 ms. A Cloudinary-backed upload pipeline handles avatars and proof attachments. A Stripe webhook handles subscription events.

Quintern is built to be deployed as a single Vercel + Render + Neon + Upstash stack, scale horizontally, and survive any single provider going down.

---

## The Quintern Philosophy

1. **Hierarchy is sacred.** A 5-tier cohort structure is a deliberate design choice — it reflects how great intern programs actually run, and it surfaces the right access boundaries naturally.
2. **Real-time is a feature, not a luxury.** When a Captain marks attendance for an Intern, the Intern should _see_ it happen. When a rating is received, the dashboard updates before the user blinks.
3. **The user always gets an answer.** Whether it's from a frontier LLM, a local heuristic, or a role-aware default — the system never returns an empty bubble.
4. **Audit by default.** Every state-changing action is logged immutably. There is no "off the record" mode.
5. **Performance is a feature.** A dashboard that takes 3 seconds to load is broken, no matter how pretty the chart is.
6. **Boring technology wins.** Node, Postgres, Redis, React — all boring, all proven, all excellent.

---

## What is Quintern?

| Module                    | What it does                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Auth**                  | JWT access (15 min) + refresh (7 d), CSRF, Argon2 password hashing, forgot/reset/verify flows |
| **Users & Departments**   | 16 seeded users across 5 roles, 3 departments, full profile + avatar management               |
| **Hierarchy**             | `checkHierarchyAccess(userId, targetId)` enforces ancestor/descendant permissions             |
| **Team**                  | Captain+ see only their reports; Senior TL+ see department-wide; Admin sees all               |
| **Attendance**            | 6 states (PRESENT, ABSENT, LEAVE, EXAM_LEAVE, HALF_DAY, WFH), bulk mark, monthly stats        |
| **Ratings**               | 1–10 scale, 7 categories, immutable once written, deep-linked to actor and target             |
| **Social Tasks + Proofs** | Captains assign social tasks; Interns submit text/image proofs; Captain reviews               |
| **Projects**              | Kanban (6 columns), milestones, risks, members, priorities, health                            |
| **Meetings**              | Create, RSVP, attendees, post-meeting notes                                                   |
| **Notifications**         | Real-time, read/unread, in-app badge counter, push on event                                   |
| **Reports & Exports**     | CSV exports of attendance, ratings, tasks — admin only                                        |
| **Analytics**             | Org-wide overview, top performers, attendance trends                                          |
| **Audit Log**             | Append-only, immutable, captures every state-changing action with actor/target/timestamp      |
| **AI Assistant**          | 7-provider fallback chain with role-aware prompts and live platform data                      |
| **Uploads**               | Avatars + files → Cloudinary with local-disk fallback                                         |
| **Stripe**                | Webhook endpoint with HMAC-SHA256 signature verification + event log                          |
| **Realtime**              | Socket.IO with JWT auth, per-user/role/department rooms, presence                             |
| **Sessions**              | View active sessions, revoke any session except current                                       |
| **Uptoskills**            | External skills platform integration with sync status                                         |

---

## Highlights

- 🏛 **5-tier hierarchy enforced end-to-end** — Admin → Senior TL → TL → Captain → Intern
- ⚡ **Socket.IO real-time** — JWT-authenticated, per-user/role/department rooms, presence, 4 ms heartbeat
- 🤖 **7-provider AI chain** — Groq → Gemini → OpenAI → HuggingFace → DeepSeek → Anthropic → FastAPI → heuristic
- 📊 **6 attendance states, 1–10 ratings, 7 rating categories** — fully normalized
- 🔐 **JWT (HS256) + refresh + CSRF + Argon2 + ownership + RBAC + audit** — defense in depth
- ☁️ **Cloudinary uploads with local-disk fallback** — never blocks writes
- 💳 **Stripe webhook with HMAC-SHA256 timing-safe verification** — replays safe
- 📱 **Mobile-first responsive UI** — tested at 320 / 375 / 768 / 1024 / 1440 / 4K
- 🐳 **Docker Compose for one-command stack** — backend, frontend, Postgres, Redis
- 🧪 **44/44 Jest + 3 GitHub Actions workflows + 78/78 RBAC + 900/900 stress** — all green
- 🔄 **CI / CD** — Prettier Check, Test + Smoke, tag-based Releases, all on every push
- 🌐 **Single-stack deploy** — Vercel (frontend) + Render (backend) + Neon (DB) + Upstash (Redis)
- 🔍 **Full-text search across users, projects, tasks** — `q` parameter
- 📈 **Prometheus metrics endpoint** at `/metrics` — CPU, memory, HTTP latency
- 🩺 **Liveness, readiness, and full health probes** — `/health`, `/health/db`, `/health/full`, `/ready`

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│   │  Vite SPA    │  │  Mobile Web  │  │  cURL / SDK  │               │
│   │  React 19    │  │  responsive  │  │  developers  │               │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└──────────┼─────────────────┼─────────────────┼────────────────────────┘
           │ HTTPS / WSS    │ HTTPS / WSS     │ HTTPS
           ▼                ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         EDGE / CDN (Vercel)                           │
│      - Static asset caching                                          │
│      - Gzip / Brotli compression                                      │
│      - HTTP/2 + HTTP/3                                                │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
┌──────────────────────┐                            ┌──────────────────────┐
│  Fastify Backend     │   WebSocket (Socket.IO)    │  Static Frontend     │
│  Node 24             │ ◄─────────────────────────► │  (Vite build → dist) │
│  ┌────────────────┐  │                            │                      │
│  │ Helmet         │  │                            │  - React 19          │
│  │ CORS           │  │                            │  - React Router 7    │
│  │ Rate Limit     │  │                            │  - Recharts          │
│  │ Cookie         │  │                            │  - Socket.IO client  │
│  │ Multipart      │  │                            │  - TanStack Query    │
│  │ Swagger        │  │                            │  - Tailwind 3.4      │
│  └────────────────┘  │                            │  - Zod               │
│  ┌────────────────┐  │                            └──────────────────────┘
│  │ Auth (JWT)     │  │
│  │ RBAC           │  │
│  │ CSRF           │  │
│  │ Audit Logger   │  │
│  │ Notifications  │  │
│  │ AI Proxy       │  │
│  │ Realtime (IO)  │  │
│  └────────────────┘  │
└──────┬───────────────┘
       │ pg / rediss
       ▼
┌──────────────────────┐         ┌──────────────────────┐
│  PostgreSQL 18       │         │  Upstash Redis       │
│  (Neon serverless)   │         │  (rate limit, cache) │
│                      │         │                      │
│  - 12 migrations     │         │  - Session cache     │
│  - 28 tables         │         │  - Rate limit window │
│  - RLS-ready         │         │  - AI response cache │
│  - Full-text search  │         │  - Hot analytics     │
└──────────────────────┘         └──────────────────────┘
       ▲
       │ signed upload
       │
┌──────────────────────┐         ┌──────────────────────┐
│  Cloudinary          │         │  Stripe              │
│  - Avatars           │         │  - Webhook events    │
│  - Proofs            │         │  - Subscription mgmt │
│  - Public CDN URLs   │         │  - Signature verify  │
└──────────────────────┘         └──────────────────────┘
```

---

## Technology Stack

### Runtime & Language

| Layer            | Technology        | Version                                 |
| ---------------- | ----------------- | --------------------------------------- |
| Backend runtime  | Node.js           | 24 LTS                                  |
| Frontend runtime | Browser (ES2022+) | evergreen                               |
| Language         | JavaScript        | ES2022 (CommonJS backend, ESM frontend) |
| Package manager  | npm               | 10.x                                    |

### Backend

| Component        | Library                         | Version    |
| ---------------- | ------------------------------- | ---------- |
| HTTP framework   | Fastify                         | 5.8.5      |
| Validation       | Zod                             | 4.4.3      |
| Database driver  | pg                              | 8.x        |
| Migrations       | Custom (in `src/db/migrate.js`) | —          |
| Auth             | jsonwebtoken + argon2           | 9.x / 0.44 |
| Realtime         | socket.io                       | 4.x        |
| Rate limit       | @fastify/rate-limit             | 11.x       |
| CORS             | @fastify/cors                   | 11.x       |
| Security headers | @fastify/helmet                 | 13.x       |
| Cookies          | @fastify/cookie                 | 11.x       |
| Multipart        | @fastify/multipart              | 10.x       |
| Documentation    | @fastify/swagger + swagger-ui   | 9.x / 6.x  |
| Compression      | @fastify/compress               | 9.x        |
| Static           | @fastify/static                 | 9.x        |
| Logging          | pino                            | 10.3.1     |
| Metrics          | prom-client                     | latest     |
| Test runner      | jest                            | 30.4.2     |

### Frontend

| Component    | Library                         | Version        |
| ------------ | ------------------------------- | -------------- |
| Framework    | React                           | 19.2.7         |
| Router       | react-router-dom                | 7.17           |
| Build        | Vite                            | 6.4.3          |
| Styling      | Tailwind CSS                    | 3.4.19         |
| Lint         | ESLint (flat config)            | 9.39.4         |
| Server state | @tanstack/react-query           | 5.x            |
| Client state | Zustand                         | latest         |
| Charts       | Custom SVG + Recharts available | 668 LOC custom |
| Real-time    | socket.io-client                | 4.x            |
| Icons        | lucide-react                    | latest         |

### Infrastructure

| Component          | Service                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| Database           | Neon PostgreSQL 18 (serverless)                                         |
| Cache / rate limit | Upstash Redis (REST)                                                    |
| File storage       | Cloudinary                                                              |
| Payments           | Stripe                                                                  |
| AI providers       | Groq, Gemini, OpenAI, HuggingFace, DeepSeek, Anthropic, local heuristic |
| CI / CD            | GitHub Actions (3 workflows)                                            |
| Frontend hosting   | Vercel                                                                  |
| Backend hosting    | Render                                                                  |
| Container          | Docker (alpine, multi-stage)                                            |

---

## The 5-Tier Hierarchy

Quintern models a real-world intern program structure. Every user has exactly one role, and every action is gated by hierarchy-aware permission checks.

```
                    ┌─────────┐
                    │  ADMIN  │   full access to everything
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │SR. TEAM  │          │SR. TEAM  │   manage TLs + reports
        │  LEAD    │          │  LEAD    │
        └────┬─────┘          └────┬─────┘
             │                     │
       ┌─────┴─────┐         ┌─────┴─────┐
       ▼           ▼         ▼           ▼
   ┌───────┐   ┌───────┐ ┌───────┐   ┌───────┐
   │ TEAM  │   │ TEAM  │ │ TEAM  │   │ TEAM  │   manage Captains + reports
   │ LEAD  │   │ LEAD  │ │ LEAD  │   │ LEAD  │
   └───┬───┘   └───┬───┘ └───┬───┘   └───┬───┘
       │           │         │           │
   ┌───┴────┐  ┌───┴────┐ ┌──┴────┐  ┌───┴────┐
   ▼        ▼  ▼        ▼ ▼       ▼  ▼        ▼
┌──────┐ ┌──────┐ ... ┌──────┐ ┌──────┐    manage Interns + submit proofs
│CAPT. │ │CAPT. │     │CAPT. │ │CAPT. │
└──┬───┘ └──┬───┘     └──┬───┘ └──┬───┘
   │        │            │        │
   ▼        ▼            ▼        ▼
┌──────┐ ┌──────┐    ┌──────┐ ┌──────┐
│INTERN│ │INTERN│    │INTERN│ │INTERN│   submit attendance, view own data
└──────┘ └──────┘    └──────┘ └──────┘
```

### Permission Matrix

| Action                            | Admin | Senior TL |   TL    |   Captain   | Intern |
| --------------------------------- | :---: | :-------: | :-----: | :---------: | :----: |
| Create user                       |   ✓   |     —     |    —    |      —      |   —    |
| View any user                     |   ✓   |  reports  | reports | own reports |  self  |
| Mark own attendance               |   ✓   |     ✓     |    ✓    |      ✓      |   ✓    |
| Mark attendance for direct report |   ✓   |     ✓     |    ✓    |      ✓      |   —    |
| Rate direct report                |   ✓   |     ✓     |    ✓    |      ✓      |   —    |
| View own ratings                  |   ✓   |     ✓     |    ✓    |      ✓      |   ✓    |
| Create project                    |   ✓   |     ✓     |    —    |      —      |   —    |
| Assign social task                |   ✓   |     ✓     |    ✓    |      ✓      |   —    |
| Submit proof                      |   ✓   |     ✓     |    ✓    |      ✓      |   ✓    |
| View audit log                    |   ✓   |     —     |    —    |      —      |   —    |
| Export CSV                        |   ✓   |     —     |    —    |      —      |   —    |
| View analytics                    |   ✓   |     ✓     |    —    |      —      |   —    |
| Receive realtime notifications    |   ✓   |     ✓     |    ✓    |      ✓      |   ✓    |

---

## Backend Architecture

### Module Layout

```
backend/
├── src/
│   ├── app.js                 # Fastify entry point + route registration
│   ├── server.js              # (legacy alias)
│   ├── config/                # Centralized env-driven config
│   │   ├── index.js           # Main config object
│   │   ├── db.js              # pg Pool (Neon, SSL)
│   │   ├── redis.js           # ioredis with Upstash
│   │   └── validateEnv.js     # Production env validation
│   ├── db/
│   │   ├── migrate.js         # Migration runner
│   │   └── migrations/        # 12 SQL files
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Login, refresh, forgot/reset
│   │   ├── users/             # User CRUD + ownership
│   │   ├── departments/       # Department CRUD
│   │   ├── hierarchy/         # my/team, my/chain, my/direct-reports
│   │   ├── team/              # team members, export
│   │   ├── attendance/        # Mark, bulk mark, stats
│   │   ├── ratings/           # Submit, view history
│   │   ├── social-tasks/      # Create, assign, list
│   │   ├── proof-submissions/ # Submit text/image proofs
│   │   ├── notifications/     # CRUD + unread count
│   │   ├── audit/             # Append-only log
│   │   ├── uploads/           # Avatar + file (Cloudinary + local)
│   │   ├── analytics/         # Overview, top performers, trends
│   │   ├── meetings/          # Create, RSVP, attendees
│   │   ├── sessions/          # Active sessions, revoke
│   │   ├── reports/           # Attendance, ratings, tasks, exports
│   │   ├── projects/          # Project + task + milestone + risk
│   │   ├── ai/                # 7-provider fallback chain
│   │   ├── realtime/          # Socket.IO module
│   │   ├── stripe/            # Webhook + admin events
│   │   └── uptoskills/        # External skills platform sync
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   ├── rbac.js            # Role allow-list
│   │   ├── ownership.js       # Hierarchy-aware + UUID validation
│   │   ├── directManager.js   # Direct manager check
│   │   ├── csrf.js            # Double-submit token
│   │   ├── bruteForce.js      # Login attempt throttle
│   │   └── sanitize.js        # Optional rich-text sanitization
│   ├── utils/
│   │   ├── audit.js           # createAuditLog helper
│   │   ├── tokens.js          # JWT sign/verify helpers
│   │   ├── hierarchy.js       # checkHierarchyAccess
│   │   ├── metrics.js         # prom-client setup
│   │   ├── cron.js            # Background jobs
│   │   └── email.js           # Multi-provider email
│   ├── websocket.js           # Legacy shim → realtime
│   └── validation/            # Shared Zod schemas
├── tests/                     # Jest
│   ├── integration/           # Supertest + Fastify inject
│   ├── unit/                  # Pure function tests
│   └── fixtures/              # Test data
├── scripts/                   # Diagnostic scripts
│   ├── test-ai-providers.js   # Hit each provider directly
│   └── test-socket.js         # Connect + heartbeat round-trip
├── seeds/                     # Idempotent seed data
│   └── seed.js                # 16 users, 3 depts, project, etc.
└── package.json
```

### Key Design Decisions

- **CommonJS backend** — Jest's CJS runtime is still smoother than ESM for test code. ESM tests in Jest 30 are still experimental.
- **Module-level isolation** — Each feature is self-contained: routes, services, repositories. No cross-module imports except via `utils/`.
- **Parameterized SQL only** — Never string-interpolate user input. pg handles binding.
- **Fail fast on env** — `validateEnv()` throws in production if required secrets are missing.
- **Single Socket.IO Server** — One `new Server(httpServer)` per process. Multiple instances race on the HTTP upgrade and break the client.
- **Idempotent seed** — `seed.js` truncates in dependency order, so re-running is safe.

---

## Frontend Architecture

### Page Inventory (23 routes)

| Path               | Page                |   Auth   | Lazy? |
| ------------------ | ------------------- | :------: | :---: |
| `/login`           | Login               |    —     | eager |
| `/forgot-password` | Forgot password     |    —     | eager |
| `/reset-password`  | Reset password      |    —     | eager |
| `/`                | Home / Dashboard    | required | lazy  |
| `/team`            | Team page           | required | lazy  |
| `/projects`        | Projects list       | required | lazy  |
| `/projects/:id`    | Project detail      | required | lazy  |
| `/attendance`      | Attendance          | required | lazy  |
| `/ratings`         | Ratings             | required | lazy  |
| `/tasks`           | Social tasks        | required | lazy  |
| `/meetings`        | Meetings            | required | lazy  |
| `/notifications`   | Notifications       | required | lazy  |
| `/assistant`       | AI Assistant        | required | lazy  |
| `/profile`         | User profile        | required | lazy  |
| `/sessions`        | Active sessions     | required | lazy  |
| `/reports`         | Reports (admin)     | required | lazy  |
| `/analytics`       | Analytics (admin)   | required | lazy  |
| `/admin`           | Admin dashboard     | required | lazy  |
| `/departments`     | Departments (admin) | required | lazy  |
| `/audit`           | Audit log (admin)   | required | lazy  |
| `/exports`         | CSV exports (admin) | required | lazy  |
| `*`                | Not found           |    —     | eager |

### Component Library

`frontend/src/components/ui.jsx` is a **1624-line** custom design system — every component is dark-mode aware, mobile-first, with reduced-motion support. Includes:

- **Layout**: `Card`, `CardBody`, `CardHeader`, `Container`, `Grid`
- **Inputs**: `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Slider`
- **Feedback**: `Banner`, `Toast` (via `lib/toast.jsx`), `Modal`, `ConfirmDialog`, `EmptyState`
- **Data**: `Table`, `ResponsiveTable`, `Tabs`, `Pagination`, `Skeleton`, `Spinner`
- **Navigation**: `Sidebar`, `Topbar`, `Breadcrumb`, `Pagination`
- **Charts**: `LineChart`, `BarChart`, `AreaChart`, `DonutChart`, `Heatmap` (custom SVG)

### State Management

| Concern                | Tool                                             |
| ---------------------- | ------------------------------------------------ |
| Auth (user, token)     | Zustand store + `localStorage` hydration         |
| Server cache (queries) | TanStack Query with 5-min stale time             |
| Mutations              | TanStack Query mutations with optimistic updates |
| Form state             | Local `useState` + Zod validation                |
| Realtime bridge        | `lib/realtime.js` singleton + `SocketBridge.jsx` |
| Toast queue            | Custom `lib/toast.jsx` global bus                |
| Theme                  | CSS variables + dark-mode class                  |
| Keyboard shortcuts     | `lib/shortcuts.js`                               |

### Real-Time Integration

`SocketBridge.jsx` is an invisible component that:

1. Connects on login (token in `handshake.auth`)
2. Disconnects on logout
3. Subscribes to common events and:
   - Invalidates matching react-query keys → UI refreshes
   - Surfaces toasts → user sees it on any tab
4. Updates page `<title>` with `● Quintern` when at least one socket is connected

The `LiveBadge` component shows connection state in the top-right: green dot = live, amber pulsing = connecting, red pulsing = offline.

---

## Real-Time Layer (Socket.IO)

### Configuration

```js
{
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 60_000,
  cors: { origin: 'http://localhost:5173', credentials: true }
}
```

### Authentication

JWT verified in the handshake middleware:

```js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('unauthorized'));
  const payload = jwt.verify(token, config.jwt.secret);
  socket.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
});
```

### Rooms

| Room                | Members                         | Purpose                         |
| ------------------- | ------------------------------- | ------------------------------- |
| `user:<id>`         | The user only                   | Direct notifications            |
| `role:<ADMIN\|...>` | All users of that role          | Role-wide broadcasts            |
| `dept:<id>`         | Department members (subscribed) | Department events               |
| `global`            | Everyone                        | Presence + global announcements |

### Events

| Event                  | Direction       | Payload                        |
| ---------------------- | --------------- | ------------------------------ |
| `connect`              | server → client | `{ id: socketId }`             |
| `disconnect`           | server → client | `{ reason }`                   |
| `presence:update`      | server → global | `{ userId, online, total }`    |
| `attendance-marked`    | server → user   | `{ attendance }`               |
| `rating-received`      | server → user   | `{ rating }`                   |
| `notification:new`     | server → user   | `{ title, message }`           |
| `meeting:created`      | server → user   | `{ meeting }`                  |
| `task:updated`         | server → user   | `{ task }`                     |
| `subscribe:department` | client → server | `deptId`                       |
| `ping:client`          | client → server | `(ts, ack)` → `{ ts, server }` |

### Heartbeat (RTT Test)

```js
socket.emit('ping:client', Date.now(), (resp) => {
  console.log(`RTT: ${Date.now() - resp.ts}ms`);
});
```

Last local measurement: **4 ms**.

---

## AI Assistant — 7-Provider Fallback Chain

The AI service walks a priority chain until one returns a 2xx response. **The user always gets an answer.**

```
┌─────────────────────────────────────────────────────┐
│  Request: { role, message, history }                │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
       ┌──────────────────────────────────┐
       │  1. Groq (llama-3.3-70b)         │──► ~300ms
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  2. Gemini (gemini-2.5-flash)    │──► ~1s
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  3. OpenAI (gpt-4o-mini)         │──► ~1.2s
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  4. HuggingFace (router)         │──► ~600ms
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  5. DeepSeek (deepseek-chat)     │──► ~1s
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  6. Anthropic (claude-sonnet-4)  │──► ~1.2s
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  7. FastAPI proxy (on-prem)      │
       └──────────────┬───────────────────┘
                      │ fail
                      ▼
       ┌──────────────────────────────────┐
       │  8. Local heuristic (always)     │──► <5ms
       │     - role-aware platform data   │
       │     - markdown answer             │
       │     - never returns empty         │
       └──────────────────────────────────┘
```

### Response Shape

```json
{
  "answer": "Cohort operations platform for intern programs.",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "latencyMs": 388,
  "cached": false
}
```

On full chain failure, the response includes `fallback: [{ provider, err }]` for debugging.

### System Prompt (Role-Aware)

The system prompt is generated from the user's role. An Admin sees org-wide context; an Intern sees personal task context. The prompt explicitly tells the model:

- It is the Quintern AI Assistant
- Quintern's stack and module inventory
- Keep answers under 150 words
- Never reveal secrets, internal endpoints, or API keys
- If a question is outside scope, say so and suggest the closest module

### Caching

A 5-minute in-memory LRU cache (200 entries max) keyed by `(provider, system, lastMessage[:200])` so repeat questions don't burn quota.

---

## Authentication & Authorization

### Token Strategy

| Token   | Lifetime    | Storage                    | Used for              |
| ------- | ----------- | -------------------------- | --------------------- |
| Access  | 15 min      | Memory (Zustand)           | Every API call        |
| Refresh | 7 days      | `localStorage` (encrypted) | Get new access        |
| CSRF    | Per session | httpOnly cookie + header   | POST/PUT/PATCH/DELETE |

### Password Hashing

**Argon2id** (the 2015 Password Hashing Competition winner). Parameters tuned per environment:

```
memoryCost: 19456 (19 MiB)
timeCost:   2
parallelism: 1
```

### Login Throttling

`bruteForce.js` middleware tracks failed login attempts per email and IP, applying exponential backoff after 5 failures. The counter decays after 15 minutes of inactivity.

### Authorization Layers

Every protected request passes through, in order:

1. **`auth.js`** — verifies JWT, attaches `req.user`
2. **`rbac.js`** — checks `req.user.role` against allow-list
3. **`ownership.js`** — UUID validation + hierarchy check
4. **`directManager.js`** — for ratings/attendance, ensures the actor manages the target

### Refresh Token Rotation

Every `/api/auth/refresh` call returns a new access token and rotates the refresh token. The old refresh token is invalidated (added to a Redis blacklist for the remainder of its 7-day TTL). This makes a stolen refresh token single-use.

---

## Database Design

### Migrations

12 SQL files in `backend/src/db/migrations/`, applied in order. Each migration is idempotent (uses `IF NOT EXISTS`).

### Schema (28 tables, abbreviated)

```sql
-- Core
users                       -- all users, 5 roles
departments                 -- Engineering, Product, Design
user_departments            -- many-to-many bridge

-- Hierarchy
manager_relations           -- user_id → manager_id (recursive)

-- Attendance
attendance                  -- one row per (user, date)
attendance_status           -- enum: PRESENT, ABSENT, LEAVE, EXAM_LEAVE, HALF_DAY, WFH

-- Ratings
ratings                     -- 1-10, immutable
rating_categories           -- enum: PERFORMANCE, TASK, PROJECT, INTERN, TEAM, MENTOR, REVIEW

-- Projects (full kanban + milestones + risks)
projects
project_members
project_tasks
project_task_assignees
project_milestones
project_risks

-- Social tasks + proofs
social_tasks
proof_submissions

-- Meetings
meetings
meeting_attendees

-- Notifications
notifications

-- Audit
audit_logs                  -- append-only

-- Auth
refresh_tokens
email_verifications
password_resets

-- Sessions
active_sessions

-- External
uptoskills_sync_log
stripe_events               -- new in this release
```

### Indexes

Every foreign key has an index. Every query that filters by `deleted_at IS NULL` has a partial index. Every full-text-searchable column has a GIN trigram index (`pg_trgm`).

### Soft Delete

Tables with `deleted_at` column use it for soft delete. All queries filter `WHERE deleted_at IS NULL` by default. A nightly cron hard-deletes rows where `deleted_at < now() - 90 days`.

---

## Module Reference

| Module              | Endpoints | Description                                               |
| ------------------- | --------- | --------------------------------------------------------- |
| `auth`              | 6         | Login, logout, refresh, forgot/reset password, CSRF token |
| `users`             | 5         | List, get-one, get-me, update, delete                     |
| `departments`       | 4         | CRUD                                                      |
| `hierarchy`         | 3         | My direct reports, my team, my chain                      |
| `team`              | 2         | Members list, export                                      |
| `attendance`        | 4         | Mark, bulk mark, get-by-user, stats                       |
| `ratings`           | 3         | Submit, get-by-user, categories                           |
| `social-tasks`      | 4         | Create, list, assign, complete                            |
| `proof-submissions` | 3         | Submit text, submit image, list                           |
| `notifications`     | 3         | List, unread-count, mark-read                             |
| `audit`             | 1         | List (admin only)                                         |
| `uploads`           | 3         | Avatar, file, file download                               |
| `analytics`         | 3         | Overview, top-performers, attendance-trends               |
| `meetings`          | 5         | CRUD + attendees                                          |
| `sessions`          | 2         | List active, revoke                                       |
| `reports`           | 5         | Attendance, ratings, tasks, departments, export           |
| `projects`          | 12        | Full project + task + milestone + risk CRUD               |
| `ai`                | 4         | Assistant chat, insights, search, providers               |
| `realtime`          | 1         | Stats (Socket.IO is the main transport)                   |
| `stripe`            | 3         | Webhook, events list, config                              |
| `uptoskills`        | 1         | Sync status                                               |
| **Total**           | **80+**   |                                                           |

---

## API Reference

Base URL: `http://localhost:5000` (dev) / `https://api.your-domain.com` (prod)

### Health Probes

```http
GET /health          → 200 { status: 'ok', db: 'connected', redis: 'connected' | 'disabled' }
GET /health/db       → 200 { status: 'ok', db: 'connected' } | 503
GET /health/full     → 200 { status: 'healthy', checks: { db, redis } }
GET /api/health      → mirror of /health
GET /api/ready       → 200 always (process is up)
GET /api/version     → 200 { name, version, node, env }
GET /metrics         → 200 prom-client text exposition
```

### Authentication

```http
GET  /api/auth/csrf-token                    → { csrfToken }
POST /api/auth/login                         → { accessToken, refreshToken, user }
POST /api/auth/refresh                       → { accessToken, refreshToken }
POST /api/auth/logout                        → { ok: true }
POST /api/auth/forgot-password               → { ok: true }
POST /api/auth/reset-password                → { ok: true }
```

### User

```http
GET  /api/users/me                           → User
GET  /api/users                              → User[] (admin)
GET  /api/users/:id                          → User
PATCH /api/users/:id                         → User
DELETE /api/users/:id                        → 204
```

### AI

```http
POST /api/ai/assistant                       → { answer, provider, model, latencyMs }
GET  /api/ai/insights                        → { answer, summary }
GET  /api/ai/search?q=term                   → { users, projects, tasks }
GET  /api/ai/providers                       → { chain, has_groq, has_gemini, ... }
```

### Stripe

```http
POST /api/stripe/webhook                     → { received, type }
GET  /api/stripe/events                      → { events[] } (admin)
GET  /api/stripe/config                      → { configured, webhookConfigured, publishableKey } (admin)
```

### Realtime

```http
GET  /api/realtime/stats                     → { connected, sockets }
WSS  /socket.io                              → Socket.IO upgrade (JWT in handshake)
```

### Complete interactive docs at `/docs` (Swagger UI)

---

## Security Architecture

### Defense in Depth

| Layer            | Mechanism                                            | Verified |
| ---------------- | ---------------------------------------------------- | -------- |
| Transport        | HTTPS / WSS                                          | ✓        |
| Headers          | Helmet (CSP, HSTS, X-Frame-Options)                  | ✓        |
| Rate limit       | Per-IP global, per-route tighter                     | ✓        |
| Auth             | JWT (HS256) + refresh rotation                       | ✓        |
| CSRF             | Double-submit token on POST/PUT/PATCH/DELETE         | ✓        |
| SQLi             | Parameterized queries (pg binding)                   | ✓        |
| XSS              | React auto-escape; per-route sanitizer for rich text | ✓        |
| Path traversal   | Strict filename regex + containment check            | ✓        |
| Brute force      | Exponential backoff after 5 failed logins            | ✓        |
| Hierarchy        | `checkHierarchyAccess` on every ownership check      | ✓        |
| Role             | RBAC middleware on every protected route             | ✓        |
| Audit            | Every state change recorded immutably                | ✓        |
| Input validation | Zod schemas at every entry point                     | ✓        |
| Webhook forgery  | HMAC-SHA256 timing-safe verification                 | ✓        |

### Threat Model

**In scope:**

- Unauthenticated access attempts
- Authenticated cross-tenant access (cross-hierarchy)
- CSRF on state-changing operations
- SQL injection
- XSS in stored data
- Path traversal in file downloads
- Brute force on login
- Webhook signature forgery

**Out of scope (v1):**

- Side-channel attacks (timing, cache)
- DoS at the network layer (handled by Vercel/Render)
- Physical security of the database (handled by Neon)
- Insider threats with database access

---

## File Storage — Cloudinary Integration

### Upload Flow

```
Client                    Backend                  Cloudinary
  │                          │                          │
  │ POST /uploads/avatar     │                          │
  │ multipart/form-data      │                          │
  ├─────────────────────────►│                          │
  │                          │ SHA1-sign params          │
  │                          │ POST multipart            │
  │                          ├─────────────────────────►│
  │                          │                          │
  │                          │◄───── 200 { secure_url }│
  │                          │                          │
  │                          │ UPDATE users SET         │
  │                          │   avatar_url = url       │
  │                          │                          │
  │◄───── 200 { avatar_url } │                          │
  │        storage:          │                          │
  │        'cloudinary'      │                          │
```

### Local Fallback

If `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` is missing, or if the Cloudinary call fails for any reason, the upload falls back to the local `backend/uploads/` directory and the avatar URL is `/api/uploads/file/avatar_<uuid>_<rand>.<ext>`.

The response always includes `storage: 'cloudinary' | 'local'` so the client knows where the file lives.

### Magic-Byte Validation

We don't trust `Content-Type` — the magic-bytes check verifies the file is actually a PNG / JPEG / WebP / GIF before storing. Prevents stored XSS via `image.png` that's actually HTML.

---

## Payments — Stripe Webhook

### Endpoint

```http
POST /api/stripe/webhook
Headers:
  Content-Type: application/json
  Stripe-Signature: t=<unix_ts>,v1=<hmac_sha256>
```

### Verification

```js
const signed = `${ts}.${rawBody}`;
const expected = hmac('sha256', WEBHOOK_SECRET).update(signed).digest('hex');
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.v1));
```

The `rawBody` is captured via Fastify's `addContentTypeParser` for `application/json` with `parseAs: 'string'` — we need the bytes, not the parsed object, for the HMAC.

### Event Storage

Every successfully verified event is inserted into a `stripe_events` table:

```sql
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,           -- Stripe's event ID
  type TEXT NOT NULL,            -- payment_intent.succeeded, etc.
  payload JSONB NOT NULL,        -- full event JSON
  received_at TIMESTAMPTZ        -- now()
);
```

`ON CONFLICT (id) DO NOTHING` makes the handler idempotent — Stripe's at-least-once delivery is safe.

### CSRF Exemption

`/api/stripe/webhook` is in the CSRF `EXEMPT` list because webhooks are authenticated by their own signature, not by browser cookies.

---

## Performance & Scalability

### Current Benchmarks (localhost)

| Test                                                 | Result                           |
| ---------------------------------------------------- | -------------------------------- |
| RBAC (5 roles × 27 modules)                          | 78/78 in <3s                     |
| Stress (50 rounds × 18 endpoints)                    | 900/900 in 47s (19 req/s)        |
| Socket.IO heartbeat                                  | 4 ms RTT                         |
| Socket.IO concurrent connections                     | 20/20 in 128ms, 71ms avg connect |
| Jest (44 tests)                                      | 25s                              |
| Prettier check                                       | <1s                              |
| Frontend build                                       | 4.88s, 184 modules               |
| Cold backend boot → ready                            | ~3s                              |
| Migrations + seed                                    | ~2s                              |
| 10× CI cycle (drop+recreate+migrate+seed+jest+smoke) | 13–15s per cycle                 |

### Bundle Sizes (gzipped)

| Chunk                     | Size                |
| ------------------------- | ------------------- |
| vendor-react              | 73.80 kB            |
| vendor (socket.io-client) | 31.77 kB            |
| index                     | 22.41 kB            |
| vendor-query              | 10.84 kB            |
| vendor-others             | various             |
| **Per-route chunks**      | 1.88 – 6.60 kB each |

### Scaling Strategy

- **Frontend**: Static, CDN-cached by Vercel. Scales to infinity.
- **Backend**: Stateless, scales horizontally on Render. Add instances behind a load balancer.
- **Socket.IO**: Requires sticky sessions or Redis adapter. Single instance v1; multi-instance with `@socket.io/redis-adapter` planned for v2.
- **Database**: Neon auto-scales. PgBouncer in transaction mode at the Neon side.
- **Cache**: Upstash Redis is serverless; scales to any QPS.
- **AI**: Each provider has its own quota. The chain means we degrade gracefully.

---

## Observability

### Logging

Pino structured JSON logs. Every request gets a UUID `reqId`. Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. In development, `pino-pretty` formats them. In production, raw JSON for log aggregators.

### Metrics (Prometheus)

```http
GET /metrics
```

Exposes:

- `process_cpu_user_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_active_handles_total`
- HTTP request duration histograms per route
- HTTP request count per status code per route

### Health Probes

| Endpoint       | Purpose            | Used by                 |
| -------------- | ------------------ | ----------------------- |
| `/health`      | Liveness + DB ping | Load balancer           |
| `/health/db`   | DB-only            | Detailed diagnostics    |
| `/health/full` | DB + Redis         | Detailed diagnostics    |
| `/api/ready`   | Process up         | K8s readiness probe     |
| `/api/version` | Service info       | Deployment verification |

### Audit Log

Every state-changing action records to `audit_logs`:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "action": "ATTENDANCE_MARKED | RATING_SUBMITTED | PROJECT_CREATED | ...",
  "resourceType": "attendance | rating | project | ...",
  "resourceId": "uuid",
  "details": { ... },  // action-specific metadata
  "ipAddress": "1.2.3.4",
  "userAgent": "Mozilla/5.0 ...",
  "createdAt": "2026-06-16T..."
}
```

Append-only, never updated, never deleted. Admin-only read access.

---

## CI / CD

### Workflows (3 total, all green)

#### 1. `ci.yml` — Quintern CI

Runs on every push to `main`, `master`, `feature/*`, `release/*` and every PR to `main` or `release/*`.

**Job 1: `test`** (~3 min)

- Spins up Postgres 18 service
- `npm ci` (backend)
- `npm run migrate`
- `npm run seed`
- `npm test` (Jest, --runInBand, --detectOpenHandles)
- `npm ci` (frontend)
- `npm run lint` (warnings only)
- `npm run build`
- Uploads backend coverage + frontend dist as artifacts

**Job 2: `smoke`** (~1 min, after test)

- Spins up Postgres 18 service with a separate smoke DB
- `npm ci --omit=dev`
- `npm run migrate` + `npm run seed`
- Boots backend in background
- Waits for `/health`
- Hits `/api/ready`, `/api/ai/insights`, logs in as admin, hits `/api/users/me`
- Verifies JWT works end-to-end

#### 2. `format.yml` — Prettier Check

Runs on every push and PR. `npx prettier@3 --check .` with `CI: true`. If any file is unformatted, the workflow fails with the first 100 lines of output for context.

#### 3. `release.yml` — Auto Release

Runs on `v*.*.*` tag push. Builds backend + frontend, zips artifacts, creates a GitHub Release with auto-generated notes.

### Branch Protection

The repo has branch protection on `main` requiring the 2 status checks (`Test`, `Smoke`) to pass before merge. PRs get a preview deployment automatically.

---

## Deployment

### Recommended Stack (the "Quintern Forever" stack)

| Component    | Host       | Why                                        |
| ------------ | ---------- | ------------------------------------------ |
| Frontend     | Vercel     | Free CDN, instant deploys, previews per PR |
| Backend      | Render     | Free tier, Docker support, persistent disk |
| Database     | Neon       | Free tier, serverless Postgres, branching  |
| Cache        | Upstash    | Free tier, serverless Redis, REST API      |
| File storage | Cloudinary | Free tier, CDN, image transformations      |
| Payments     | Stripe     | Industry standard, test mode is free       |

### One-Click Deploy

```bash
# Frontend → Vercel
vercel --prod

# Backend → Render
render deploy

# DB → Neon
neonctl branches create production
neonctl connection-string copy

# Migrations + seed (one time)
psql $DATABASE_URL < backend/src/db/migrations/0001_initial.sql
cd backend && npm run seed
```

### Docker

```bash
# Build
docker build -t quintern-backend ./backend
docker build -t quintern-frontend ./frontend

# Run full stack
docker compose -f docker-compose.production.yml up -d
```

The production compose file uses Postgres 18, Node 24 alpine images, and reads secrets from environment variables (never committed).

### Environment Variables

See [Environment Variables](#environment-variables) below for the complete list.

---

## Local Development

### Prerequisites

- **Node.js 24** (use `nvm` and `nvm use`)
- **PostgreSQL 18** (local install or `docker run postgres:18`)
- **Redis 7+** (local install or `docker run redis:7-alpine`) — optional, only for rate-limit and cache
- **npm 10+**

### Setup

```bash
# Clone
git clone https://github.com/rajat-wyrm/Quintern.git
cd Quintern

# Install backend
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT secrets, API keys

# Install frontend
cd ../frontend
npm install

# Initialize database
cd ../backend
npm run migrate
npm run seed

# Start dev servers (in two terminals)
npm run dev          # backend on :5000
cd ../frontend && npm run dev   # frontend on :5173
```

Open `http://localhost:5173` in your browser.

### Seeded Users (password: `Quintern@2026`)

| Role      | Email                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin     | `admin@quintern.com`                                                                                                                                                       |
| Senior TL | `priya.senior@quintern.com`, `arjun.senior@quintern.com`                                                                                                                   |
| TL        | `neha.tl@quintern.com`, `rahul.tl@quintern.com`, `kavya.tl@quintern.com`                                                                                                   |
| Captain   | `vikram.cap@quintern.com`, `isha.cap@quintern.com`, `rohan.cap@quintern.com`, `meera.cap@quintern.com`                                                                     |
| Intern    | `aarav.intern@quintern.com`, `ananya.intern@quintern.com`, `dev.intern@quintern.com`, `isha.intern@quintern.com`, `karan.intern@quintern.com`, `tanvi.intern@quintern.com` |

### Helper Script

```bash
./internops.sh up      # one-command stack start
./internops.sh logs    # tail all logs
./internops.sh test    # run all tests
./internops.sh reset   # drop + migrate + seed
```

---

## Environment Variables

All environment variables are loaded by `dotenv` in `backend/src/config/index.js`. **Required** variables throw at startup if missing in production.

### Required (production)

```bash
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Auth (generate with: openssl rand -base64 48)
JWT_ACCESS_SECRET=<48 bytes base64url>
JWT_REFRESH_SECRET=<48 bytes base64url>
CSRF_SECRET=<48 bytes base64url>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# CORS
CORS_ORIGIN=https://your-domain.com
APP_URL=https://your-domain.com
```

### Optional (with sensible defaults)

```bash
# Rate limiting
RATE_LIMIT_GLOBAL=600
RATE_LIMIT_AUTH=20

# Logging
LOG_LEVEL=info

# File uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AI providers (at least one)
AI_PROVIDER=groq
AI_TIMEOUT=15000
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DEEPSEEK_API_KEY=
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
ANTHROPIC_API_KEY=
FASTAPI_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=quintern
CLOUDINARY_SECURE=true

# Socket.IO
SOCKET_PATH=/socket.io
SOCKET_CORS=https://your-domain.com

# Email (SMTP / SendGrid / Mailgun)
EMAIL_PROVIDER=log
EMAIL_FROM=noreply@your-domain.com
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_API_KEY=
EMAIL_RATE_LIMIT=5
EMAIL_RATE_WINDOW=60000
EMAIL_BOUNCE_CHECK=false

# Uptoskills integration
UPTOSKILLS_BASE_URL=
UPTOSKILLS_API_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Fast2SMS
FAST2SMS_API_KEY=

# Misc
RATE_LIMIT_DISABLED=false
TRUST_PROXY=false
```

### Frontend

The frontend is a static SPA, so it needs no environment variables at runtime. Build-time configuration is done via Vite's `import.meta.env` (see `frontend/vite.config.js`).

---

## Testing Strategy

### Test Pyramid

```
                    ┌─────────┐
                    │   E2E   │  (planned for v2 with Playwright)
                    ├─────────┤
                ┌───┤  Smoke  ├───┐  CI smoke job: boot + 6 endpoint hits
                │   ├─────────┤   │
            ┌───┤   │Integration   ├───┐  Jest + supertest + fastify.inject
            │   │   │   (Jest)   │   │   44 tests, 4 suites
            │   │   ├───────────┤   │
        ┌───┤   │   │    Unit       │   │  helpers, pure functions
        │   │   │   │              │   │
        └───┴───┴───┴──────────────┴───┘
```

### Coverage

| Suite               | Tests  | Status    |
| ------------------- | ------ | --------- |
| `auth.test.js`      | 18     | ✓         |
| `meetings.test.js`  | 8      | ✓         |
| `email.test.js`     | 10     | ✓         |
| `hierarchy.test.js` | 8      | ✓         |
| **Total**           | **44** | **44/44** |

### Diagnostic Scripts

```bash
# Test each AI provider individually
node backend/scripts/test-ai-providers.js

# Test Socket.IO connection + heartbeat
node backend/scripts/test-socket.js

# 10× full CI cycle (drop + migrate + seed + jest + smoke)
bash /tmp/run-10-cycles.sh
```

### Manual Test Scripts (in `/tmp/`)

```bash
# Full RBAC + AI + write ops
bash /tmp/full-rbac-test.sh

# 50 rounds × 18 endpoints stress test
bash /tmp/stress-test.sh
```

---

## Project Structure

```
Quintern/
├── backend/                    # Fastify API
│   ├── src/                    # Application code
│   ├── tests/                  # Jest tests
│   ├── scripts/                # Diagnostic scripts
│   ├── seeds/                  # Idempotent seed data
│   ├── Dockerfile              # Multi-stage build
│   ├── jest.config.js
│   └── package.json
├── frontend/                   # Vite + React
│   ├── src/
│   │   ├── pages/              # 23 routes
│   │   ├── components/         # 1624-line design system
│   │   ├── lib/                # axios, realtime, toast, query, shortcuts
│   │   ├── store/              # Zustand stores
│   │   └── App.jsx
│   ├── eslint.config.js        # ESLint v9 flat config
│   ├── vite.config.js
│   ├── Dockerfile
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml              # Test + Smoke
│       ├── format.yml          # Prettier check
│       └── release.yml         # Tag-based release
├── docker-compose.yml          # Local dev
├── docker-compose.production.yml  # Prod
├── Dockerfile                  # Root orchestration
├── .nvmrc                      # Node 24
├── .prettierrc
├── AGENTS.md
├── DEPLOY.md
├── LICENSE
├── NEON.md
├── README.md                   # ← you are here
├── RENDER.md
├── UPSTASH.md
├── VERCEL.md
├── internops.sh                # One-command ops
└── package.json
```

---

## Roadmap

### v1.x (current)

- [x] Node 24 / Postgres 18 stack pin
- [x] Latest stable deps (Fastify 5, Zod 4, React 19, Vite 6, ESLint 9)
- [x] 7-provider AI fallback chain
- [x] Socket.IO real-time layer
- [x] Cloudinary uploads
- [x] Stripe webhook with HMAC
- [x] 16-user seed across 5 roles
- [x] 44/44 Jest tests
- [x] 3 GitHub Actions workflows
- [x] Full RBAC (5 roles × 27 modules)
- [x] UUID validation (400 instead of 500)
- [x] CSRF exempt for webhooks

### v2.0 (next)

- [ ] Playwright E2E suite
- [ ] Multi-instance Socket.IO with Redis adapter
- [ ] PWA support (offline, install, push notifications)
- [ ] Advanced analytics (cohort retention, time-to-rating)
- [ ] Email integration (SendGrid / Mailgun)
- [ ] Calendar view for projects + meetings
- [ ] Internationalization (i18n) — start with Hindi
- [ ] Webhook replay protection (idempotency cache)
- [ ] OpenAPI spec generation from Zod schemas
- [ ] Storybook for the design system

### v3.0 (vision)

- [ ] Native mobile apps (React Native)
- [ ] SSO (Google, Microsoft, Okta)
- [ ] ML-powered attrition prediction
- [ ] Custom dashboards per role
- [ ] Workflow automation engine
- [ ] Plugin marketplace

---

## Contributing

Quintern is currently a private, single-team project. When it opens for contributions, the workflow will be:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your change (with tests)
4. Run `npm test` and `npx prettier --check .` locally
5. Commit: `git commit -m "feat(scope): human-readable description"`
6. Push: `git push origin feat/your-feature`
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`, `build`

### Code Style

- **Prettier** for formatting (enforced in CI)
- **ESLint** for the frontend (warnings only, not blocking)
- **Zod** for runtime validation
- **Argon2** for password hashing (never bcrypt, never plaintext)
- **Parameterized SQL only** (never string interpolation)
- **Magic-byte check** for image uploads (never trust Content-Type)
- **Timing-safe comparison** for HMAC verification

---

## License

**Proprietary.** All rights reserved.

This software is the intellectual property of the Quintern project. Unauthorized copying, modification, distribution, or use is strictly prohibited.

For licensing inquiries, contact the project owner.

---

## Acknowledgements

Quintern is built on the shoulders of giants. With gratitude to the maintainers and contributors of:

- [Fastify](https://fastify.dev/) — the fastest Node.js web framework
- [React](https://react.dev/) — UI library
- [Vite](https://vitejs.dev/) — instant dev server
- [PostgreSQL](https://www.postgresql.org/) — the world's most advanced open-source database
- [Redis](https://redis.io/) — in-memory data structure store
- [Socket.IO](https://socket.io/) — realtime engine
- [Zod](https://zod.dev/) — TypeScript-first schema validation
- [Jest](https://jestjs.io/) — delightful JavaScript testing
- [Pino](https://getpino.io/) — low-overhead Node.js logger
- [TanStack Query](https://tanstack.com/query) — powerful async state management
- [Tailwind CSS](https://tailwindcss.com/) — utility-first CSS
- [Neon](https://neon.tech/) — serverless Postgres
- [Upstash](https://upstash.com/) — serverless Redis
- [Cloudinary](https://cloudinary.com/) — media management
- [Stripe](https://stripe.com/) — payments infrastructure
- [Groq](https://groq.com/), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenAI](https://openai.com/), [HuggingFace](https://huggingface.co/), [DeepSeek](https://deepseek.com/), [Anthropic](https://www.anthropic.com/) — AI infrastructure
- [Vercel](https://vercel.com/) — frontend hosting
- [Render](https://render.com/) — backend hosting
- [GitHub Actions](https://github.com/features/actions) — CI / CD

And to every intern who ever made a manager's job worth doing.

---

<p align="center">
  <strong>Quintern</strong> &nbsp;·&nbsp; quin + intern &nbsp;·&nbsp; 5-tier cohort operations
  <br><br>
  <sub>Built with Node 24, Fastify 5, React 19, Vite 6, PostgreSQL 18, and care.</sub>
</p>
