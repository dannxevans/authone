import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { config } from '../config.js';
import { getDb } from '../db/database.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

export interface AccessTokenPayload {
  sub: string;
  username: string;
  type: 'access';
}

export function signAccessToken(userId: string, username: string): string {
  return jwt.sign(
    { sub: userId, username, type: 'access' } satisfies AccessTokenPayload,
    config.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenPayload;
}

export function issueRefreshToken(userId: string): string {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt =
    Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_DAYS * 86400;

  getDb()
    .prepare(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    )
    .run(userId, tokenHash, expiresAt);

  return token;
}

export function consumeRefreshToken(
  token: string
): { userId: string } | null {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const row = db
    .prepare(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`
    )
    .get(tokenHash, now) as { id: string; user_id: string } | undefined;

  if (!row) return null;

  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').run(
    now,
    row.id
  );

  return { userId: row.user_id };
}

export function revokeAllRefreshTokens(userId: string): void {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      'UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
    )
    .run(now, userId);
}
