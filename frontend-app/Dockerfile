# Multi-stage build for Next.js frontend

# Stage 1: Dependencies
# UBAH ke node:20-alpine (atau lts) untuk memenuhi persyaratan EBADENGINE
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# UBAH 'npm ci' ke 'npm install' untuk mengatasi masalah lock file tidak sinkron
RUN npm install

# Stage 2: Builder
# Pastikan semua stage menggunakan versi Node yang sama
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Stage 3: Runner
# Pastikan runner juga menggunakan versi Node yang sama
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]