export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
}

export interface AccountRow {
  id: string;
  user_id: string;
  secret_enc: string;
  issuer_enc: string;
  account_enc: string;
  algorithm: string;
  digits: number;
  period: number;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PasskeyCredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: number;
  aaguid: string;
  transports: string; // JSON array string
  name: string;
  created_at: number;
  last_used_at: number | null;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  revoked_at: number | null;
}
