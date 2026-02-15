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
# Remove dev dependencies
RUN npm prune --omit=dev --workspace=backend

# Stage 3: Runtime image
FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built backend
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/node_modules ./backend/node_modules
COPY --from=build-backend /app/backend/package.json ./backend/
# Copy root node_modules (shared workspace deps)
COPY --from=build-backend /app/node_modules ./node_modules

# Copy frontend build
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

ENV NODE_ENV=production \
    DB_PATH=/data/otp.db \
    PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]
