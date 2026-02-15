import { pbkdf2Sync } from 'crypto';
import { config } from '../config.js';

let derivedKey: Buffer | null = null;

export function getDerivedKey(): Buffer {
  if (derivedKey) return derivedKey;

  derivedKey = pbkdf2Sync(
    config.ENCRYPTION_KEY,
    'otp-authenticator-v1',
    100_000,
    32,
    'sha256'
  );

  return derivedKey;
}

/**
 * Derive a key from a user-supplied passphrase (used for export encryption).
 * Higher iteration count since the output is offline-attackable.
 */
export function deriveExportKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, 200_000, 32, 'sha256');
}
