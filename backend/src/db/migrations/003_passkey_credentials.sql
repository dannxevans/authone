CREATE TABLE IF NOT EXISTS passkey_credentials (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id  TEXT    NOT NULL UNIQUE,
  public_key     BLOB    NOT NULL,
  counter        INTEGER NOT NULL DEFAULT 0,
  aaguid         TEXT    NOT NULL DEFAULT '',
  transports     TEXT    NOT NULL DEFAULT '[]',
  name           TEXT    NOT NULL DEFAULT 'Passkey',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pk_user_id       ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_pk_credential_id ON passkey_credentials(credential_id);
