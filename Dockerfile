# Stage 1: Build frontend
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend (compile TS + install prod deps + rebuild native bindings)
FROM node:22-alpine AS build-backend
WORKDIR /app/backend
# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build
# Remove dev dependencies
RUN npm prune --production

# Stage 3: Runtime image
FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built backend
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/node_modules ./backend/node_modules
COPY --from=build-backend /app/backend/package.json ./backend/

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
