FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/kafka/package.json packages/kafka/
COPY packages/user-be/package.json packages/user-be/

RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/kafka/node_modules packages/kafka/node_modules
COPY --from=deps /app/packages/user-be/node_modules packages/user-be/node_modules

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma/ prisma/
COPY packages/kafka/ packages/kafka/
COPY packages/user-be/ packages/user-be/

RUN bunx prisma generate --config prisma.config.ts

FROM oven/bun:1-slim AS runner

WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/prisma.config.ts .
COPY --from=builder /app/tsconfig.json .


COPY --from=builder /app/prisma/generated prisma/generated

EXPOSE 5001

ENV NODE_ENV=production


HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:5001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "packages/user-be/src/index.ts"]
