import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.js';
import type { UserRow } from '../db/schema.js';
import { verifyPassword, hashPassword } from './passwordService.js';
import {
  signAccessToken,
  issueRefreshToken,
  consumeRefreshToken,
  revokeAllRefreshTokens,
} from './jwtService.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/authenticate.js';
import { REFRESH_COOKIE, COOKIE_OPTIONS } from './authConstants.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;

    const user = getDb()
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const accessToken = signAccessToken(user.id, user.username);
    const refreshToken = issueRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.json({
      accessToken,
      user: { id: user.id, username: user.username },
    });
  }
);

router.post('/refresh', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  const result = consumeRefreshToken(token);
  if (!result) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const user = getDb()
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(result.userId) as Pick<UserRow, 'id' | 'username'> | undefined;

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const newAccessToken = signAccessToken(user.id, user.username);
  const newRefreshToken = issueRefreshToken(user.id);

  res.cookie(REFRESH_COOKIE, newRefreshToken, COOKIE_OPTIONS);
  res.json({ accessToken: newAccessToken });
});

router.post('/logout', authenticate, (req, res) => {
  const { id } = (req as AuthenticatedRequest).user;
  revokeAllRefreshTokens(id);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => {
  const { id, username } = (req as AuthenticatedRequest).user;
  res.json({ id, username });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  async (req, res) => {
    const { id } = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = req.body as z.infer<
      typeof changePasswordSchema
    >;

    const user = getDb()
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as import('../db/schema.js').UserRow | undefined;

    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const now = Math.floor(Date.now() / 1000);
    getDb()
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, id);

    // Revoke all sessions so other devices are logged out
    revokeAllRefreshTokens(id);

    res.json({ ok: true });
  }
);

export { router as authRouter };
