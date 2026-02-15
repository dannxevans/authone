# Stage 1: Build frontend
FROM node:22-alpine AS build-frontend
WORKDIR /app
# Copy root workspace manifests + lock file first for layer caching
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --workspace=frontend
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# Stage 2: Build backend (compile TS + install prod deps + rebuild native bindings)
FROM node:22-alpine AS build-backend
WORKDIR /app
# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend
COPY backend/ ./backend/
RUN npm run build --workspace=backend
# Prune dev deps from the root node_modules (where workspaces hoist packages)
RUN npm prune --omit=dev

# Stage 3: Runtime image
FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy root package.json (needed by Node module resolution)
COPY --from=build-backend /app/package.json ./
# All deps are hoisted to root node_modules by npm workspaces
COPY --from=build-backend /app/node_modules ./node_modules
# Copy built backend
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/package.json ./backend/

# Copy frontend build
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Create data directory (world-writable so any PUID/PGID can use it)
RUN mkdir -p /data && chmod 777 /data

EXPOSE 3000

ENV NODE_ENV=production \
    DB_PATH=/data/otp.db \
    PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]
