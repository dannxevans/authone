export interface OtpAuthParams {
  secret: string;
  issuer: string;
  account: string;
  algorithm: string;
  digits: number;
  period: number;
}

/**
 * Parse an otpauth:// URI into structured parameters.
 * Format: otpauth://totp/ISSUER:ACCOUNT?secret=XXX&issuer=XXX&algorithm=SHA1&digits=6&period=30
 */
export function parseOtpauthUri(uri: string): OtpAuthParams {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('Invalid otpauth URI');
  }

  if (url.protocol !== 'otpauth:') {
    throw new Error('URI must use otpauth: protocol');
  }

  if (url.host !== 'totp') {
    throw new Error('Only TOTP is supported (otpauth://totp/...)');
  }

  // The label is the pathname minus the leading slash
  const label = decodeURIComponent(url.pathname.slice(1));

  let issuer: string;
  let account: string;

  if (label.includes(':')) {
    const colonIdx = label.indexOf(':');
    issuer = label.slice(0, colonIdx).trim();
    account = label.slice(colonIdx + 1).trim();
  } else {
    issuer = url.searchParams.get('issuer') ?? label;
    account = label;
  }

  // issuer in query param takes precedence
  const issuerParam = url.searchParams.get('issuer');
  if (issuerParam) {
    issuer = issuerParam;
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Missing secret parameter');
  }

  // Validate base32 (A-Z and 2-7, case insensitive, optional padding)
  if (!/^[A-Z2-7]+=*$/i.test(secret.replace(/\s/g, ''))) {
    throw new Error('Invalid base32 secret');
  }

  const algorithm = (
    url.searchParams.get('algorithm') ?? 'SHA1'
  ).toUpperCase();
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) {
    throw new Error('Unsupported algorithm');
  }

  const digits = parseInt(url.searchParams.get('digits') ?? '6', 10);
  if (![6, 8].includes(digits)) {
    throw new Error('Digits must be 6 or 8');
  }

  const period = parseInt(url.searchParams.get('period') ?? '30', 10);
  if (![30, 60].includes(period)) {
    throw new Error('Period must be 30 or 60');
  }

  return {
    secret: secret.toUpperCase().replace(/\s/g, ''),
    issuer: issuer || 'Unknown',
    account: account || 'Unknown',
    algorithm,
    digits,
    period,
  };
}

export function buildOtpauthUri(params: OtpAuthParams): string {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.account)}`;
  const url = new URL(`otpauth://totp/${label}`);
  url.searchParams.set('secret', params.secret);
  url.searchParams.set('issuer', params.issuer);
  url.searchParams.set('algorithm', params.algorithm);
  url.searchParams.set('digits', String(params.digits));
  url.searchParams.set('period', String(params.period));
  return url.toString();
}
