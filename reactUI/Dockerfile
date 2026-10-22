FROM node:20-alpine AS builder

WORKDIR /app

# Kich hoat pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies manifest
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Cai dat dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code va build Next.js
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4001

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 4001

CMD ["pnpm", "start"]
