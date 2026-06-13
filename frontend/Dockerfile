# =============================================================================
# Quintern · Frontend image
# Multi-stage: install → build → nginx serve.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache curl tini
COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
# Rate limit zone shared across vhosts.
limit_req_zone $binary_remote_addr zone=quintern:10m rate=30r/s;
limit_req_status 429;

# Upstream — points at the API container. In compose, the service name
# is `backend`; in production it would be a real DNS or VIP.
upstream quintern_api {
  server backend:5000;
  keepalive 32;
}

server {
  listen 80 default_server;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Security headers — applied to every response.
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
  # CSP is tight: only same-origin by default, plus the assets we ship.
  add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

  # Long cache for hashed Vite assets.
  location ~* \.(?:js|css|woff2?|ttf|otf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable, max-age=31536000";
    try_files $uri =404;
  }

  # Hashed build manifest.
  location = /manifest.webmanifest { expires 1d; add_header Cache-Control "public, max-age=86400"; }

  # Service worker / manifest. We don't ship one yet; placeholder.
  location = /sw.js { return 404; }

  # WebSocket + REST: pass-through to the API.
  location /api/ {
    limit_req zone=internops burst=60 nodelay;
    proxy_pass http://quintern_api;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection         "";
    proxy_read_timeout 90s;
  }
  # /docs is the Swagger UI served by the backend at /docs.
  location /docs {
    proxy_pass http://quintern_api/docs;
    proxy_set_header Host $host;
  }
  location /docs/ {
    proxy_pass http://quintern_api/docs/;
  }
  # /uploads (the avatar/proof file serving) is also proxied to the API.
  location /uploads/ {
    proxy_pass http://quintern_api;
    proxy_set_header Host $host;
  }

  # SPA fallback — every non-asset path serves the index so React Router
  # can take over. (Note: this is *not* a 404; it's a deliberate rewrite
  # for client-side routing.)
  location / {
    try_files $uri $uri/ /index.html;
  }

  # No server tokens, ever.
  server_tokens off;
}
EOF
COPY <<'EOF' /docker-entrypoint.sh
#!/bin/sh
# nginx entrypoint: render the listen port from env (default 80) so the
# same image can run behind a TLS proxy (443) or directly.
set -e
if [ -n "$LISTEN_PORT" ]; then
  sed -i "s/listen 80 default_server;/listen ${LISTEN_PORT} default_server;/" /etc/nginx/conf.d/default.conf
fi
exec nginx -g "daemon off;"
EOF
RUN chmod +x /docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:80/ >/dev/null || exit 1

EXPOSE 80
ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
