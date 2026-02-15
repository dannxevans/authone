import { Router } from 'express';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/server';
import { getDb } from '../db/database.js';
import type { UserRow } from '../db/schema.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { config } from '../config.js';
import { signAccessToken, issueRefreshToken } from './jwtService.js';
import { REFRESH_COOKIE, COOKIE_OPTIONS } from './authConstants.js';
import { saveChallenge, consumeChallenge, createChallengeSession } from './passkeyStore.js';
import {
  getCredentialsByUserId,
  getCredentialByCredentialId,
  insertCredential,
  updateCredentialCounter,
  deleteCredential,
} from './passkeyService.js';

const router = Router();

// ── Registration ──────────────────────────────────────────────────────────────

router.post('/register/challenge', authenticate, async (req, res) => {
  const { id: userId, username } = (req as AuthenticatedRequest).user;

  const existingCredentials = getCredentialsByUserId(userId);

  const options = await generateRegistrationOptions({
    rpName: config.WEBAUTHN_RP_NAME,
    rpID: config.WEBAUTHN_RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: username,
    userDisplayName: username,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credential_id,
      transports: JSON.parse(c.transports) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  saveChallenge(userId, options.challenge);

  res.json(options);
});

const registrationVerifySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  response: z.any(),
});

router.post(
  '/register/verify',
  authenticate,
  validateBody(registrationVerifySchema),
  async (req, res) => {
    const { id: userId } = (req as AuthenticatedRequest).user;
    const { name = 'Passkey', response } = req.body as z.infer<typeof registrationVerifySchema>;

    const expectedChallenge = consumeChallenge(userId);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'Registration session expired, please try again' });
      return;
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.WEBAUTHN_ORIGIN,
        expectedRPID: config.WEBAUTHN_RP_ID,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      res.status(400).json({ error: msg });
      return;
    }

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Verification failed' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo as {
        credential: {
          id: string;
          publicKey: Uint8Array;
          counter: number;
          transports?: AuthenticatorTransportFuture[];
        };
        credentialDeviceType: CredentialDeviceType;
        credentialBackedUp: boolean;
      };

    const publicKeyBuffer = Buffer.from(credential.publicKey);
    const transports = credential.transports ?? [];

    const row = insertCredential(
      userId,
      credential.id,
      publicKeyBuffer,
      credential.counter,
      verification.registrationInfo.aaguid ?? '',
      transports,
      name
    );

    res.json({ ok: true, passkeyId: row.id, name: row.name });
  }
);

// ── Authentication ─────────────────────────────────────────────────────────────

// No username required — browser shows its own passkey picker (discoverable credentials)
router.post('/authenticate/challenge', async (_req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: config.WEBAUTHN_RP_ID,
    allowCredentials: [], // empty = let the authenticator show all available passkeys
    userVerification: 'preferred',
  });

  // Store challenge keyed by a random session ID (returned to client)
  const sessionId = createChallengeSession(options.challenge);

  res.json({ ...options, sessionId });
});

const authVerifySchema = z.object({
  sessionId: z.string().min(1),
  response: z.any(),
});

router.post(
  '/authenticate/verify',
  validateBody(authVerifySchema),
  async (req, res) => {
    const { sessionId, response } = req.body as z.infer<typeof authVerifySchema>;

    const expectedChallenge = consumeChallenge(sessionId);
    if (!expectedChallenge) {
      res.status(400).json({ error: 'Authentication session expired, please try again' });
      return;
    }

    // Identify user from the credential ID in the response
    const credential = getCredentialByCredentialId(response.id as string);
    if (!credential) {
      res.status(401).json({ error: 'Passkey not found' });
      return;
    }

    const user = getDb()
      .prepare('SELECT id, username FROM users WHERE id = ?')
      .get(credential.user_id) as Pick<UserRow, 'id' | 'username'> | undefined;

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: config.WEBAUTHN_ORIGIN,
        expectedRPID: config.WEBAUTHN_RP_ID,
        credential: {
          id: credential.credential_id,
          publicKey: new Uint8Array(credential.public_key),
          counter: credential.counter,
          transports: JSON.parse(credential.transports) as AuthenticatorTransportFuture[],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      res.status(401).json({ error: msg });
      return;
    }

    if (!verification.verified) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);

    const accessToken = signAccessToken(user.id, user.username);
    const refreshToken = issueRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.json({
      accessToken,
      user: { id: user.id, username: user.username },
    });
  }
);

// ── Credential management ──────────────────────────────────────────────────────

router.get('/credentials', authenticate, (req, res) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const credentials = getCredentialsByUserId(userId);

  res.json(
    credentials.map((c) => ({
      id: c.id,
      name: c.name,
      aaguid: c.aaguid,
      transports: JSON.parse(c.transports) as string[],
      createdAt: c.created_at,
      lastUsedAt: c.last_used_at,
    }))
  );
});

router.delete('/credentials/:credentialId', authenticate, (req, res) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const credentialId = req.params['credentialId'] as string;

  const deleted = deleteCredential(credentialId, userId);

  if (!deleted) {
    res.status(404).json({ error: 'Passkey not found' });
    return;
  }

  res.json({ ok: true });
});

export { router as passkeyRouter };
