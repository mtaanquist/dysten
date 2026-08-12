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

# ---- Prisma CLI -------------------------------------------------------------
# The container applies its own migrations on start, which needs the Prisma CLI
# at runtime. `next build --standalone` traces the *client* but never the CLI,
# and the CLI has its own dependency tree (@prisma/config pulls in `effect`,
# among others), so cherry-picking directories out of the build's node_modules
# produces a binary that cannot load itself.
#
# Installing it alone, at the version package.json already pins, gives a small
# self-contained closure to copy — without dragging the whole dev dependency
# tree into the final image.
FROM base AS prisma-cli
WORKDIR /cli
COPY package.json /tmp/app-package.json
RUN npm init -y > /dev/null \
 && npm install --no-audit --no-fund \
      "prisma@$(node -p "require('/tmp/app-package.json').devDependencies.prisma")"

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
#
# Ownership is set on the way in. A `chown -R` afterwards would rewrite every
# file into a second layer and roughly double the image.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The Prisma CLI, kept in its own node_modules so Node's resolution finds the
# CLI's dependencies from it. The entrypoint runs build/index.js — the package's
# declared bin — directly: COPY dereferences the .bin/prisma symlink into a lone
# file, which then hunts for its sibling wasm in the wrong directory.
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./cli/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The SQLite file lives on a volume mounted here. Created up front and owned by
# the app user so the first write does not fail on a read-only parent.
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
