import { getDb } from '../db/database.js';
import type { PasskeyCredentialRow } from '../db/schema.js';

export function getCredentialsByUserId(userId: string): PasskeyCredentialRow[] {
  return getDb()
    .prepare('SELECT * FROM passkey_credentials WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId) as PasskeyCredentialRow[];
}

export function getCredentialByCredentialId(credentialId: string): PasskeyCredentialRow | undefined {
  return getDb()
    .prepare('SELECT * FROM passkey_credentials WHERE credential_id = ?')
    .get(credentialId) as PasskeyCredentialRow | undefined;
}

export function insertCredential(
  userId: string,
  credentialId: string,
  publicKey: Buffer,
  counter: number,
  aaguid: string,
  transports: string[],
  name: string
): PasskeyCredentialRow {
  const db = getDb();
  db.prepare(
    `INSERT INTO passkey_credentials
      (user_id, credential_id, public_key, counter, aaguid, transports, name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, credentialId, publicKey, counter, aaguid, JSON.stringify(transports), name);

  return db
    .prepare('SELECT * FROM passkey_credentials WHERE credential_id = ?')
    .get(credentialId) as PasskeyCredentialRow;
}

export function updateCredentialCounter(id: string, newCounter: number): void {
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ?')
    .run(newCounter, now, id);
}

export function deleteCredential(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return result.changes > 0;
}
