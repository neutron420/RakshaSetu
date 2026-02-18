FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/user-be/package.json ./packages/user-be/

RUN bun install --frozen-lockfile

FROM deps AS prisma

WORKDIR /app

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN bunx prisma generate --config prisma.config.ts

FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/prisma/generated ./prisma/generated

COPY package.json ./
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY packages/user-be ./packages/user-be

ENV USER_BE_PORT=5001
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://localhost:5001/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "run", "packages/user-be/src/index.ts"]
