import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { authenticate, type AuthenticatedRequest } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { getAllAccountsWithSecrets, createAccount } from '../accounts/accountsService.js';
import { buildOtpauthUri, parseOtpauthUri } from '../accounts/otpauthParser.js';
import { deriveExportKey } from '../crypto/keyDerivation.js';
import { encryptWithKey, decryptWithKey } from '../crypto/fieldEncryption.js';

const router = Router();
router.use(authenticate);

const exportSchema = z.object({
  format: z.enum(['encrypted', 'plain']),
  passphrase: z.string().min(8).optional(),
});

const importSchema = z.object({
  data: z.string(),
  passphrase: z.string().optional(),
  format: z.enum(['encrypted', 'plain']),
});

router.post('/export', validateBody(exportSchema), (req, res) => {
  const { id } = (req as AuthenticatedRequest).user;
  const { format, passphrase } = req.body as z.infer<typeof exportSchema>;

  const accounts = getAllAccountsWithSecrets(id);
  const uris = accounts.map((a) =>
    buildOtpauthUri({
      secret: a.secret,
      issuer: a.issuer,
      account: a.account,
      algorithm: a.algorithm,
      digits: a.digits,
      period: a.period,
    })
  );

  if (format === 'plain') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="otp-export.json"'
    );
    res.json({ version: 1, format: 'plain', accounts: uris });
    return;
  }

  // Encrypted format
  if (!passphrase) {
    res.status(400).json({ error: 'Passphrase required for encrypted export' });
    return;
  }

  const salt = randomBytes(32);
  const key = deriveExportKey(passphrase, salt);
  const plaintext = JSON.stringify({ version: 1, accounts: uris });
  const ciphertext = encryptWithKey(plaintext, key);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="otp-export-encrypted.json"'
  );
  res.json({
    version: 1,
    format: 'encrypted',
    salt: salt.toString('base64'),
    data: ciphertext,
  });
});

router.post('/import', validateBody(importSchema), (req, res) => {
  const { id } = (req as AuthenticatedRequest).user;
  const { data, passphrase, format } = req.body as z.infer<typeof importSchema>;

  let uris: string[];

  try {
    if (format === 'plain') {
      const parsed = JSON.parse(data) as { accounts: string[] };
      uris = parsed.accounts;
    } else {
      if (!passphrase) {
        res.status(400).json({ error: 'Passphrase required for encrypted import' });
        return;
      }

      const parsed = JSON.parse(data) as {
        salt: string;
        data: string;
      };

      const salt = Buffer.from(parsed.salt, 'base64');
      const key = deriveExportKey(passphrase, salt);

      let decrypted: string;
      try {
        decrypted = decryptWithKey(parsed.data, key);
      } catch {
        res.status(400).json({ error: 'Invalid passphrase or corrupted data' });
        return;
      }

      const inner = JSON.parse(decrypted) as { accounts: string[] };
      uris = inner.accounts;
    }
  } catch {
    res.status(400).json({ error: 'Invalid import data' });
    return;
  }

  const results: { success: string[]; failed: string[] } = {
    success: [],
    failed: [],
  };

  for (const uri of uris) {
    try {
      const params = parseOtpauthUri(uri);
      const account = createAccount({ userId: id, ...params });
      results.success.push(account.id);
    } catch {
      results.failed.push(uri);
    }
  }

  res.json({
    imported: results.success.length,
    failed: results.failed.length,
    failedUris: results.failed,
  });
});

export { router as exportRouter };
