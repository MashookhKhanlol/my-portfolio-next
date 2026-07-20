# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build — use Debian (bookworm-slim) so sharp has prebuilt binaries.
# Alpine requires compiling sharp from source which often fails in CI/VPS.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

# Install only what's needed for native module compilation (fallback safety)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source and build the Strapi admin UI
COPY . .

# Increase Node.js heap limit — Strapi admin panel build needs ~1GB+ RAM
ENV NODE_OPTIONS="--max-old-space-size=1400"
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — lean Debian slim runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy compiled artifacts from build stage
COPY --from=build /app/build        ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/config       ./config
COPY --from=build /app/src          ./src
COPY --from=build /app/public       ./public
COPY --from=build /app/database     ./database

# Writable temp upload dir (Cloudinary handles final storage)
RUN mkdir -p /app/public/uploads && chown -R node:node /app

USER node

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1337/_health', r => process.exit(r.statusCode === 204 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "node_modules/.bin/strapi", "start"]
