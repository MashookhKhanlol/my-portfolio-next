# ─────────────────────────────────────────────────────────────────────────────
# Single-stage production image for Strapi v5
# Debian bookworm-slim: sharp has prebuilt binaries, no compilation issues
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libvips \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────────
COPY package*.json ./
RUN npm ci

# ── Copy source code ───────────────────────────────────────────────────────
COPY . .

# ── Build Strapi (compiles TS + builds admin panel) ───────────────────────
# NODE_OPTIONS: Strapi admin panel webpack build needs ~1GB+ RAM
ENV NODE_OPTIONS="--max-old-space-size=1400"
RUN npm run build

# ── Runtime config ─────────────────────────────────────────────────────────
ENV NODE_ENV=production
# Clear build-time NODE_OPTIONS so the server runs without heap restriction
ENV NODE_OPTIONS=""

# Strapi needs a writable uploads dir (Cloudinary handles actual storage)
RUN mkdir -p /app/public/uploads && chown -R node:node /app

USER node

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1337/_health', r => process.exit(r.statusCode === 204 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "node_modules/.bin/strapi", "start"]
