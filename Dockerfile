# ---- Base -------------------------------------------------------------------
# openssl is a Prisma requirement on Alpine; libc6-compat covers Next's
# native bits.
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ---- Dependencies -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Prisma needs DATABASE_URL present to generate a client, but never connects at
# build time. The real value arrives at runtime.
ENV DATABASE_URL="file:/data/app.db"
# Produce .next/standalone for the runner stage below.
ENV BUILD_STANDALONE=true

# `npm run build` runs `prisma generate` first. Note that no branding or secret
# is baked in here: ORG_NAME and APP_SECRET are read at runtime, so one image
# serves any deployment.
RUN npm run build

# ---- Runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/data/app.db"

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next's standalone output ships its own minimal node_modules, so the whole
# dependency tree stays out of the final image.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The Prisma CLI and engines, needed so the container can apply its own
# migrations on start. `standalone` traces the client but not the CLI.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The SQLite file lives on a volume mounted here. Created up front and owned by
# the app user so the first write does not fail on a read-only parent.
RUN mkdir -p /data && chown -R nextjs:nodejs /data /app

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
