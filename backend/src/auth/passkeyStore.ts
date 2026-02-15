import { randomBytes } from 'crypto';

interface ChallengeEntry {
  challenge: string;
  timer: ReturnType<typeof setTimeout>;
}

const store = new Map<string, ChallengeEntry>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a new session, store the challenge, and return the session ID.
 * The session ID is returned to the client and must be sent back on verify.
 */
export function createChallengeSession(challenge: string): string {
  const sessionId = randomBytes(24).toString('base64url');

  const timer = setTimeout(() => {
    store.delete(sessionId);
  }, CHALLENGE_TTL_MS);

  store.set(sessionId, { challenge, timer });
  return sessionId;
}

/**
 * Also support keying by userId for the registration flow (user is already authenticated).
 */
export function saveChallenge(key: string, challenge: string): void {
  const existing = store.get(key);
  if (existing) {
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(() => {
    store.delete(key);
  }, CHALLENGE_TTL_MS);

  store.set(key, { challenge, timer });
}

export function consumeChallenge(key: string): string | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  clearTimeout(entry.timer);
  store.delete(key);

  return entry.challenge;
}
