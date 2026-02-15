import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, getDb } from './db/database.js';
import { hashPassword } from './auth/passwordService.js';
import { authRouter } from './auth/authRouter.js';
import { passkeyRouter } from './auth/passkeyRouter.js';
import { accountsRouter } from './accounts/accountsRouter.js';
import { exportRouter } from './export/exportRouter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust proxy (for Unraid / Nginx Proxy Manager)
if (config.TRUST_PROXY) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        // Allow camera access for QR scanning
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin:
      config.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/auth/passkey', passkeyRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api', exportRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Serve frontend in production
const frontendDist = join(__dirname, '../../frontend/dist');
logger.info({ frontendDist, exists: existsSync(frontendDist) }, 'Frontend dist check');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*path', (_req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

// Initialize DB and first-run setup
const db = initDb();

const userCount = (
  db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
).count;

if (userCount === 0) {
  const hash = await hashPassword('admin');
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    'admin',
    hash
  );
  logger.warn(
    'Created default admin user with password "admin". Change it immediately via the app settings.'
  );
}

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

export { app };
