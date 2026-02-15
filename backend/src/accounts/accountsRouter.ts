import { Router } from 'express';
import { z } from 'zod';
import { authenticate, type AuthenticatedRequest } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import {
  createAccount,
  listAccounts,
  getAccountSecret,
  deleteAccount,
  updateAccount,
} from './accountsService.js';
import { parseOtpauthUri } from './otpauthParser.js';

const router = Router();
router.use(authenticate);

const manualSchema = z.object({
  secret: z.string().regex(/^[A-Z2-7]+=*$/i, 'Invalid base32 secret'),
  issuer: z.string().min(1),
  account: z.string().min(1),
  algorithm: z.enum(['SHA1', 'SHA256', 'SHA512']).optional(),
  digits: z.union([z.literal(6), z.literal(8)]).optional(),
  period: z.union([z.literal(30), z.literal(60)]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const uriSchema = z.object({
  uri: z.string().startsWith('otpauth://'),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const addAccountSchema = z.union([manualSchema, uriSchema]);

const updateSchema = z.object({
  issuer: z.string().min(1).optional(),
  account: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

router.get('/', (req, res) => {
  const { id } = (req as AuthenticatedRequest).user;
  const accounts = listAccounts(id);
  res.json(accounts);
});

router.post('/', validateBody(addAccountSchema), (req, res) => {
  const { id } = (req as AuthenticatedRequest).user;
  const body = req.body as z.infer<typeof addAccountSchema>;

  let params: {
    secret: string;
    issuer: string;
    account: string;
    algorithm?: string;
    digits?: number;
    period?: number;
    color?: string;
    icon?: string;
  };

  if ('uri' in body) {
    try {
      const parsed = parseOtpauthUri(body.uri);
      params = { ...parsed, color: body.color, icon: body.icon };
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
  } else {
    params = {
      secret: body.secret.toUpperCase().replace(/\s/g, ''),
      issuer: body.issuer,
      account: body.account,
      algorithm: body.algorithm,
      digits: body.digits,
      period: body.period,
      color: body.color,
      icon: body.icon,
    };
  }

  const account = createAccount({ userId: id, ...params });
  res.status(201).json(account);
});

router.get('/:accountId/secret', (req, res) => {
  const { id } = (req as unknown as AuthenticatedRequest).user;
  const accountId = req.params['accountId'] as string;

  const secret = getAccountSecret(id, accountId);
  if (secret === null) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.json({ secret });
});

router.patch('/:accountId', validateBody(updateSchema), (req, res) => {
  const { id } = (req as unknown as AuthenticatedRequest).user;
  const accountId = req.params['accountId'] as string;

  const updated = updateAccount(id, accountId, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.json(updated);
});

router.delete('/:accountId', (req, res) => {
  const { id } = (req as unknown as AuthenticatedRequest).user;
  const accountId = req.params['accountId'] as string;

  const deleted = deleteAccount(id, accountId);
  if (!deleted) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.json({ ok: true });
});

export { router as accountsRouter };
