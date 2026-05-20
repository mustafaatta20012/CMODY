# ═══════════════════════════════════════════════
#  GODMODE STORE — Dockerfile
#  Multi-stage: development → production
# ═══════════════════════════════════════════════

# ── Base Stage ──────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# Install system deps needed by some npm packages
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Development Stage ───────────────────────────
FROM base AS development
ENV NODE_ENV=development

# Install ALL deps (including devDependencies)
RUN npm ci && npm cache clean --force

# Copy prisma schema first (for generate)
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── Builder Stage ────────────────────────────────
FROM base AS builder
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# ── Production Stage ────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 godmode

# Copy only what's needed
COPY --from=builder --chown=godmode:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=godmode:nodejs /app/src ./src
COPY --from=builder --chown=godmode:nodejs /app/prisma ./prisma
COPY --from=builder --chown=godmode:nodejs /app/package.json ./

# Create uploads dir with correct permissions
RUN mkdir -p uploads && chown godmode:nodejs uploads

USER godmode

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/server.js"]
