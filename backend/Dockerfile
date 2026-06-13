# =============================================================================
# Quintern · Backend image
# Multi-stage build. Final image contains only the runtime deps, the
# compiled app, and the package manifest. No devDependencies, no build
# artifacts, no .git, no test fixtures.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
# Run as a non-root user. The official Node image ships with `node` user.
RUN apk add --no-cache curl openssl tini
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
# Drop privileges. `node` user exists in the base image (uid 1000).
USER node

# tini as PID 1 for proper signal handling (SIGTERM → graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

# Default env. Override at runtime with --env-file or compose `environment`.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

CMD ["node", "src/app.js"]
