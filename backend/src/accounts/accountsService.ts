import { getDb } from '../db/database.js';
import { encrypt, decrypt } from '../crypto/fieldEncryption.js';
import type { AccountRow } from '../db/schema.js';

export interface CreateAccountParams {
  userId: string;
  secret: string;
  issuer: string;
  account: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  color?: string;
  icon?: string;
}

export interface AccountSummary {
  id: string;
  issuer: string;
  account: string;
  algorithm: string;
  digits: number;
  period: number;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: number;
}

export function createAccount(params: CreateAccountParams): AccountSummary {
  const db = getDb();

  const secretEnc = encrypt(params.secret);
  const issuerEnc = encrypt(params.issuer);
  const accountEnc = encrypt(params.account);

  const algorithm = params.algorithm ?? 'SHA1';
  const digits = params.digits ?? 6;
  const period = params.period ?? 30;

  const maxOrder = (
    db
      .prepare('SELECT MAX(sort_order) as m FROM accounts WHERE user_id = ?')
      .get(params.userId) as { m: number | null }
  ).m ?? -1;

  const result = db
    .prepare(
      `INSERT INTO accounts
        (user_id, secret_enc, issuer_enc, account_enc, algorithm, digits, period, color, icon, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, algorithm, digits, period, color, icon, sort_order, created_at`
    )
    .get(
      params.userId,
      secretEnc,
      issuerEnc,
      accountEnc,
      algorithm,
      digits,
      period,
      params.color ?? null,
      params.icon ?? null,
      maxOrder + 1
    ) as Pick<
    AccountRow,
    'id' | 'algorithm' | 'digits' | 'period' | 'color' | 'icon' | 'sort_order' | 'created_at'
  >;

  return {
    id: result.id,
    issuer: params.issuer,
    account: params.account,
    algorithm: result.algorithm,
    digits: result.digits,
    period: result.period,
    color: result.color,
    icon: result.icon,
    sort_order: result.sort_order,
    created_at: result.created_at,
  };
}

export function listAccounts(userId: string): AccountSummary[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM accounts WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC'
    )
    .all(userId) as AccountRow[];

  return rows.map((row) => ({
    id: row.id,
    issuer: decrypt(row.issuer_enc),
    account: decrypt(row.account_enc),
    algorithm: row.algorithm,
    digits: row.digits,
    period: row.period,
    color: row.color,
    icon: row.icon,
    sort_order: row.sort_order,
    created_at: row.created_at,
  }));
}

export function getAccountSecret(
  userId: string,
  accountId: string
): string | null {
  const row = getDb()
    .prepare(
      'SELECT secret_enc FROM accounts WHERE id = ? AND user_id = ?'
    )
    .get(accountId, userId) as { secret_enc: string } | undefined;

  if (!row) return null;
  return decrypt(row.secret_enc);
}

export function deleteAccount(userId: string, accountId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?')
    .run(accountId, userId);
  return result.changes > 0;
}

export interface UpdateAccountParams {
  issuer?: string;
  account?: string;
  color?: string | null;
  icon?: string | null;
  sort_order?: number;
}

export function updateAccount(
  userId: string,
  accountId: string,
  params: UpdateAccountParams
): AccountSummary | null {
  const db = getDb();

  const existing = db
    .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId) as AccountRow | undefined;

  if (!existing) return null;

  const issuerEnc =
    params.issuer !== undefined ? encrypt(params.issuer) : existing.issuer_enc;
  const accountEnc =
    params.account !== undefined
      ? encrypt(params.account)
      : existing.account_enc;
  const color = 'color' in params ? params.color : existing.color;
  const icon = 'icon' in params ? params.icon : existing.icon;
  const sortOrder =
    params.sort_order !== undefined ? params.sort_order : existing.sort_order;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    `UPDATE accounts SET issuer_enc = ?, account_enc = ?, color = ?, icon = ?, sort_order = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(issuerEnc, accountEnc, color, icon, sortOrder, now, accountId, userId);

  return {
    id: existing.id,
    issuer: params.issuer ?? decrypt(existing.issuer_enc),
    account: params.account ?? decrypt(existing.account_enc),
    algorithm: existing.algorithm,
    digits: existing.digits,
    period: existing.period,
    color: color ?? null,
    icon: icon ?? null,
    sort_order: sortOrder,
    created_at: existing.created_at,
  };
}

export function getAllAccountsWithSecrets(
  userId: string
): (AccountSummary & { secret: string })[] {
  const rows = getDb()
    .prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY sort_order ASC')
    .all(userId) as AccountRow[];

  return rows.map((row) => ({
    id: row.id,
    issuer: decrypt(row.issuer_enc),
    account: decrypt(row.account_enc),
    secret: decrypt(row.secret_enc),
    algorithm: row.algorithm,
    digits: row.digits,
    period: row.period,
    color: row.color,
    icon: row.icon,
    sort_order: row.sort_order,
    created_at: row.created_at,
  }));
}
