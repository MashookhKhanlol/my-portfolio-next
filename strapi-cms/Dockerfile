# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build — installs all deps and compiles the Strapi admin panel
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# vips is required for image processing (sharp)
RUN apk add --no-cache libc6-compat vips-dev python3 make g++

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source and build the Strapi admin UI
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production — lean runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat vips

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

# Strapi needs a writable uploads dir even when using Cloudinary
# (used for temporary files during upload processing)
RUN mkdir -p /app/public/uploads && chown -R node:node /app

USER node

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1

CMD ["node", "node_modules/.bin/strapi", "start"]
