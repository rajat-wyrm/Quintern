# Quintern · Deployment Guide

> quin (5) + intern — a 5-tier cohort operations platform.

This guide covers shipping **Quintern** to production. The repo is already CI-green
on `rajat-wyrm/Quintern` (see `Quintern CI` + `Format Check` workflows). This doc
walks through everything that needs to happen to take it from a passing CI run to
a live, publicly-accessible URL serving real users.

---

## TL;DR

```bash
# 1. Provision
- Postgres 14+ (Neon, Supabase, RDS, or self-hosted)
- Redis (Upstash REST or self-hosted)
- Object storage (optional, for uploads)

# 2. Deploy
- Backend: Railway / Render / Fly.io / AWS ECS / DigitalOcean App Platform
- Frontend: Vercel / Netlify / Cloudflare Pages / nginx-on-VPS

# 3. Connect
- CORS_ORIGIN=https://<your-frontend-domain>
- APP_URL=https://<your-backend-domain>
- DATABASE_URL=postgres://<user>:<pass>@<host>/<db>

# 4. Smoke
curl https://<backend>/health         # → {"status":"ok","db":"connected"}
curl https://<backend>/api/ready      # → {"status":"ready","checks":{"db":true,"migrations":true}}
```

---

## 1. Architecture at a glance

```
                    ┌────────────────────────────────────────────┐
                    │           Cloudflare / CDN                 │
                    │   (TLS termination, WAF, rate-limit)       │
                    └──────────────┬──────────────┬──────────────┘
                                   │              │
                          /api/*   │              │  /*
                                   ▼              ▼
                       ┌──────────────────┐  ┌──────────────────┐
                       │   Backend        │  │   Frontend       │
                       │   (Fastify)      │  │   (Vite SPA)     │
                       │   Node 20+       │  │   nginx          │
                       │   PORT=5000      │  │   PORT=80        │
                       │   2+ workers     │  │   static only    │
                       └────────┬─────────┘  └──────────────────┘
                                │
                  ┌─────────────┼──────────────┐
                  ▼             ▼              ▼
          ┌─────────────┐ ┌──────────┐ ┌──────────────┐
          │  Postgres   │ │  Redis   │ │  AI providers│
          │  14+        │ │  Upstash │ │  Groq→Gemini │
          │  sslmode=   │ │  REST    │ │  →DeepSeek→  │
          │  verify-full│ │  TLS     │ │  Anthropic   │
          └─────────────┘ └──────────┘ └──────────────┘
```

The backend is stateless (no in-memory session state — everything is in Postgres or
Upstash Redis). That means horizontal scaling is just "add more instances behind a
load balancer".

---

## 2. Required services (cheapest viable stack)

| Service           | Provider (free/cheap tier)                | Why                              |
| ----------------- | ----------------------------------------- | -------------------------------- |
| **Postgres 14+**  | [Neon](https://neon.tech) (free 0.5GB)    | Connection pooling, branching    |
| **Redis**         | [Upstash](https://upstash.com) (free 10k) | REST, edge-replicated, no TCP    |
| **Backend host**  | [Railway](https://railway.app) / Render   | Native Node, auto-deploy from GH |
| **Frontend host** | [Vercel](https://vercel.com) / Cloudflare | Free static hosting + CDN        |
| **Secrets**       | Platform env vars (Railway/Render/Vercel) | No third-party vault needed      |

All four are free to start and scale-to-zero when traffic is low. Quintern is
designed to be friendly to this stack:

- **No TCP Redis required** — backend supports both `REDIS_URL` (TCP) and
  `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN` (REST). Choose REST for
  edge/serverless compatibility.
- **No file uploads persistence required** — `backend/uploads/` is a volume, but
  uploads are optional (avatar + proof-submission images). For early stage you can
  run on Railway with its ephemeral volume and accept that uploaded files vanish
  on restart. For production, attach an S3-compatible store (TODO: implement
  S3 backend, see `modules/uploads/routes.js`).
- **No build step on backend** — it's just `node src/app.js`.

---

## 3. Environment variables (production)

The full list is in `backend/.env.example` and `.env.production.example`. The
production-mandatory subset:

```bash
# ── Runtime ──
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
APP_URL=https://api.quintern.example.com
CORS_ORIGIN=https://quintern.example.com

# ── Secrets (generate with: openssl rand -base64 48) ──
JWT_ACCESS_SECRET=<48 random bytes, base64>
JWT_REFRESH_SECRET=<48 random bytes, base64>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CSRF_SECRET=<32 random bytes, base64>
API_KEY=<32 random bytes, hex>

# ── Postgres ──
DATABASE_URL=postgres://quintern:<password>@<host>/quintern?sslmode=verify-full

# ── Redis (Upstash REST) ──
UPSTASH_REDIS_REST_URL=https://<your>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<upstash-read-write-token>

# ── AI providers (any subset; missing ones are skipped) ──
GROQ_API_KEY=gsk_<key>
GEMINI_API_KEY=AIza<key>
DEEPSEEK_API_KEY=sk-<key>           # optional
HUGGINGFACE_TOKEN=hf_<key>          # optional
ANTHROPIC_API_KEY=sk-ant-<key>      # optional
FASTAPI_URL=http://<host>:8000      # optional, custom internal proxy
AI_TIMEOUT=8000                     # ms

# ── Email ──
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
EMAIL_FROM=Quintern <no-reply@quintern.example.com>
EMAIL_PROVIDER=smtp

# ── Rate limit (per-IP, per-window) ──
RATE_LIMIT_GLOBAL=600
RATE_LIMIT_AUTH=20

# ── Misc ──
LOG_LEVEL=info
```

The backend refuses to start in production if any required secret is missing or
too short — see `backend/src/config/validateEnv.js`. That check is enforced in
CI via the **Smoke** job (boots the real backend, hits `/health`, `/api/ready`,
`/api/auth/login`, `/api/users/me`).

---

## 4. Backend deployment

### Option A — Railway (recommended for fastest setup)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli
railway login

# 2. From the repo root
railway init --name quintern-api
railway up   # uses Procfile or nixpacks auto-detect
```

Railway auto-detects Node 20, runs `npm install` then `npm start` (which is
`cross-env NODE_ENV=production node src/app.js`). To use the project's own
Dockerfile, add a `railway.json`:

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "backend/Dockerfile" }
}
```

In Railway's dashboard:

1. Add a **Postgres** plugin (Neon is already linked, but Railway Postgres also
   works).
2. Add a **Redis** plugin OR paste the Upstash REST URL/token in env vars.
3. Paste all the env vars from §3.
4. Set the domain. The default `*.up.railway.app` is fine; bring your own
   custom domain later.

### Option B — Render

```bash
# New → Web Service → Connect GitHub repo → rajat-wyrm/Quintern
# Root directory: backend
# Build command: npm ci
# Start command: cross-env NODE_ENV=production node src/app.js
# Health check path: /health
```

Add the env vars from §3. Render has built-in Postgres and Redis; point
`DATABASE_URL` and `UPSTASH_REDIS_REST_*` to whichever you provision.

### Option C — Fly.io (more control, multi-region)

```bash
fly launch --image-label quintern-api
fly secrets set JWT_ACCESS_SECRET=$(openssl rand -base64 48) \
              JWT_REFRESH_SECRET=$(openssl rand -base64 48) \
              CSRF_SECRET=$(openssl rand -base64 32) \
              DATABASE_URL=postgres://... \
              UPSTASH_REDIS_REST_URL=... \
              UPSTASH_REDIS_REST_TOKEN=... \
              GROQ_API_KEY=... \
              GEMINI_API_KEY=... \
              APP_URL=https://api.quintern.fly.dev \
              CORS_ORIGIN=https://quintern.fly.dev
fly deploy
```

### Option D — Self-hosted VPS (full control)

```bash
# On the VPS (Ubuntu 22.04+, Node 20+)
git clone https://github.com/rajat-wyrm/Quintern.git /opt/quintern
cd /opt/quintern
cp .env.production.example .env.production
$EDITOR .env.production       # fill in secrets
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml exec backend node src/db/migrate.js
docker compose -f docker-compose.production.yml exec backend node seeds/seed.js
```

`docker-compose.production.yml` is the canonical "ship it" stack: postgres + redis

- backend (2 workers) + frontend (nginx). Behind a Caddy/Nginx reverse proxy for
  TLS (Caddy is recommended — automatic Let's Encrypt).

---

## 5. Frontend deployment

The frontend is a Vite-built SPA. `frontend/Dockerfile` produces a tiny
`nginx:1.27-alpine` image with the dist files + a hardened nginx config (CSP,
HSTS-ready, rate-limit, gzip, SPA fallback).

### Option A — Vercel (zero config)

```bash
cd frontend
vercel link
vercel env add VITE_API_BASE production
# → https://api.quintern.example.com/api
vercel --prod
```

Vercel auto-detects Vite. No config needed.

### Option B — Cloudflare Pages

- Build command: `npm run build`
- Build output: `frontend/dist`
- Env var: `VITE_API_BASE=https://api.quintern.example.com/api`

### Option C — Same VPS as backend (via docker-compose.production.yml)

The included compose stack serves the SPA from the same host as the API. nginx
routes `/api/*` to the backend container and `/*` to the SPA's `index.html`.
Add Caddy in front for TLS.

---

## 6. Post-deploy checklist

After the first deploy, walk through this list:

```bash
# 1. Health
curl -fsS https://api.quintern.example.com/health | jq
# expect: {"status":"ok","db":"connected","redis":"connected"}

curl -fsS https://api.quintern.example.com/api/ready | jq
# expect: {"status":"ready","checks":{"db":true,"migrations":true}}

# 2. Login as the seeded admin (only works if you ran seeds)
curl -fsS -H 'Content-Type: application/json' \
  -d '{"email":"admin@quintern.example.com","password":"<change-me>"}' \
  https://api.quintern.example.com/api/auth/login | jq .accessToken

# 3. Change the admin password immediately
# Frontend → Profile → Change password

# 4. Confirm CORS is locked down
curl -fsS -H 'Origin: https://evil.com' \
  -X OPTIONS \
  https://api.quintern.example.com/api/users/me -i | grep -i access-control
# expect: no Access-Control-Allow-Origin for evil.com

# 5. Confirm rate limits work
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code} " \
    -H 'Content-Type: application/json' \
    -d '{"email":"x","password":"y"}' \
    https://api.quintern.example.com/api/auth/login
done
# expect: 401 401 401 ... 429 (after 20 attempts per minute)

# 6. Confirm Swagger is up
curl -fsS -o /dev/null -w "%{http_code}\n" https://api.quintern.example.com/docs/
# expect: 200
```

---

## 7. CI/CD

The repo already has:

- **Format Check** — Prettier on every push
- **Quintern CI** — Jest (44 tests) + migrations + seed + frontend build +
  **Smoke** job that boots the real backend and hits `/health`, `/api/ready`,
  `/api/auth/login` (admin), `/api/users/me`
- **Release** — on `v*.*.*` tag push: runs full CI gate, builds backend +
  frontend, packages three tarballs (`backend-*.tar.gz`, `frontend-*.tar.gz`,
  `docker-*.tar.gz`), creates a GitHub Release with auto-generated notes

To cut a release:

```bash
git tag v2026.06.1
git push --tags origin main
# → GitHub Actions runs Release → artifacts uploaded to Releases page
```

To roll back:

```bash
git tag v2026.06.0  # last known good
# redeploy from the v2026.06.0 tarball:
docker compose -f docker-compose.production.yml down
docker load < backend-v2026.06.0.tar.gz
docker load < frontend-v2026.06.0.tar.gz
docker compose -f docker-compose.production.yml up -d
```

---

## 8. Observability (TODO — not yet wired)

The repo includes `docker-compose.monitoring.yml` (Prometheus + Grafana) and
`prometheus.yml` is checked in, but the backend doesn't yet emit Prometheus
metrics. That's a known gap.

**Minimum viable observability for production:**

1. **Logs** — pipe stdout to a log aggregator (Railway/Render do this
   automatically). Set `LOG_LEVEL=info` in production.
2. **Uptime monitoring** — [UptimeRobot](https://uptimerobot.com) (free) or
   [BetterStack](https://betterstack.com) hitting `/health` every 60s.
3. **Error tracking** — add Sentry:
   - Backend: `npm install @sentry/node` → init in `app.js` with `SENTRY_DSN`
   - Frontend: `npm install @sentry/react` → init in `main.jsx`
4. **APM** — later, OpenTelemetry → Grafana Tempo / Honeycomb.

---

## 9. Scaling

| Layer        | Today                               | At 1k concurrent users                     |
| ------------ | ----------------------------------- | ------------------------------------------ |
| Backend      | 1 instance, 1 worker                | 2-4 instances, 4 workers each, behind ALB  |
| Postgres     | Neon free (0.5GB, 0.25 vCPU burst)  | Neon Scale (4 vCPU, 28GB) or RDS           |
| Redis        | Upstash free (10k cmd/day)          | Upstash Pro (500k cmd/day) or self-host    |
| AI providers | Groq/Gemini with heuristic fallback | Same + add Anthropic + rate-limit per-user |
| Frontend     | Vercel/Cloudflare free              | Same (CDN absorbs everything)              |
| File uploads | Ephemeral volume (lost on restart)  | S3 / R2 backend (TODO)                     |

The backend is stateless and horizontally scalable. The only state is in
Postgres + Redis + uploaded files. Add a load balancer (ALB, Cloudflare Load
Balancer, Railway's built-in) and you can run N backend instances behind a
single domain.

---

## 10. Hardening (TODO before going public with real PII)

- [ ] Add Sentry (backend + frontend)
- [ ] Wire S3-compatible upload backend (replace local `uploads/`)
- [ ] Enable Cloudflare WAF rules
- [ ] Set up log retention (90 days → archive to S3)
- [ ] Add CSP report-uri
- [ ] Enable HSTS (after confirming all subdomains serve HTTPS)
- [ ] Pen test the JWT/CSRF flow
- [ ] Set up database backups (Neon does this automatically; verify
      point-in-time recovery window)
- [ ] Document the disaster-recovery RTO/RPO

---

## See also

- [README.md](README.md) — overview, features, local dev
- [internops.sh](internops.sh) — one-command local dev / test / seed
- [.github/workflows/](.github/workflows/) — CI/CD definitions
- [docker-compose.production.yml](docker-compose.production.yml) — production stack
- [backend/src/config/validateEnv.js](backend/src/config/validateEnv.js) — env validator
