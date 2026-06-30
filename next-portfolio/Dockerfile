# ─────────────────────────────────────────────
# Stage 1: deps  — install only production deps
# ─────────────────────────────────────────────
FROM node:18-alpine AS deps

# Install libc compat for Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests and install deps
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ─────────────────────────────────────────────
# Stage 2: builder — compile the Next.js app
# ─────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Bring in node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source
COPY . .

# Build arguments passed in from docker-compose (needed at build time for NEXT_PUBLIC_* vars)
ARG NEXT_PUBLIC_DATA_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_DATABASE_URL
ARG NEXT_PUBLIC_FIREBASE_PROJECTID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID
ARG NEXT_PUBLIC_FIREBASE_APPID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENTD

ENV NEXT_PUBLIC_DATA_URL=$NEXT_PUBLIC_DATA_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_DATABASE_URL=$NEXT_PUBLIC_FIREBASE_DATABASE_URL
ENV NEXT_PUBLIC_FIREBASE_PROJECTID=$NEXT_PUBLIC_FIREBASE_PROJECTID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID
ENV NEXT_PUBLIC_FIREBASE_APPID=$NEXT_PUBLIC_FIREBASE_APPID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENTD=$NEXT_PUBLIC_FIREBASE_MEASUREMENTD

# Disable Next.js telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: runner — lean production image
# ─────────────────────────────────────────────
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what Next.js needs to run
COPY --from=builder /app/public        ./public
COPY --from=builder /app/data.json     ./data.json

# Leverage Next.js output tracing (standalone mode copies only required files)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
