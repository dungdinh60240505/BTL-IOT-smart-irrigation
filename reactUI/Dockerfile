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

ARG INTERNAL_API_URL=http://server:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ARG NEXT_PUBLIC_WS_URL=
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

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

CMD ["node_modules/.bin/next", "start", "-p", "4001"]
