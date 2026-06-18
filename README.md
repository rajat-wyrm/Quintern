# Quintern

> **quin (five) + intern** — a 5-tier cohort operations platform with real-time collaboration, multi-provider AI assistance, and hierarchical access control.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-1f2937?style=for-the-badge)](#license)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tests](https://img.shields.io/badge/Tests-44%2F44-22c55e?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)

## Maintainer

**Rajat Kumar** — Project Management, Uptoskills

## Quick Start

```bash
git clone https://github.com/rajat-wyrm/Quintern.git
cd Quintern

cd backend && npm install && cp .env.example .env
# Edit .env with DATABASE_URL, JWT secrets, API keys

cd ../frontend && npm install
cd ../backend && npm run migrate && npm run seed

# Terminal 1: backend
npm run dev

# Terminal 2: frontend
cd ../frontend && npm run dev
```

Open `http://localhost:5173` — all seeded users use password `Quintern@2026`.

| Role | Email |
|---|---|
| Admin | `admin@quintern.com` |
| Senior TL | `priya.senior@quintern.com` |
| TL | `neha.tl@quintern.com` |
| Captain | `vikram.cap@quintern.com` |
| Intern | `aarav.intern@quintern.com` |

```bash
# Ops helper
./internops.sh up      # full stack
./internops.sh reset   # drop + migrate + seed
./internops.sh test    # run all 44 tests
```

## Documentation

| Document | What it covers |
|---|---|
| [Architecture (HLD)](docs/ARCHITECTURE.md) | System context, container diagram, module interaction map, request lifecycle, 5 data-flow scenarios, deployment topology, scaling, observability |
| [Design (LLD)](docs/DESIGN.md) | Database schema (28 tables, 12 migrations), full API reference (80+ endpoints), middleware chain (auth → RBAC → ownership → directManager), auth flow (JWT + refresh + CSRF), Socket.IO events, security controls, env config, testing strategy |

## At a Glance

- **5-tier hierarchy** — Admin → Senior TL → TL → Captain → Intern, enforced at DB, middleware, API, and UI
- **80+ API endpoints** — Auth, Users, Attendance, Ratings, Projects (Kanban), Meetings, AI, Reports, and more
- **7-provider AI fallback** — Groq → Gemini → OpenAI → HuggingFace → DeepSeek → Anthropic → FastAPI → heuristic; the user always gets an answer
- **Real-time** — Socket.IO with JWT auth, per-user/role/department rooms, <5ms heartbeat
- **Defense in depth** — JWT + CSRF + Argon2 + RBAC + hierarchy checks + audit log + rate limiting + magic-byte upload validation
- **44/44 tests** — Jest + supertest + fastify.inject, 3 GitHub Actions workflows, 78/78 RBAC checks
- **Deployment** — Vercel (frontend) + Render (backend) + Neon (DB) + Upstash (Redis) + Cloudinary (files) + Stripe (payments)

## Project Structure

```
backend/          Fastify 5 API (20 modules, 7 middleware, 12 migrations)
frontend/         Vite 6 + React 19 SPA (23 routes, custom design system)
.github/workflows CI / CD (3 workflows: test+smoke, format, release)
```

## License

**Proprietary** — all rights reserved.
