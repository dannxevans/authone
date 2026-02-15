import { useState, useEffect, useCallback } from 'react';

/**
 * Browser-native TOTP implementation using Web Crypto API.
 * Implements RFC 6238 (TOTP) and RFC 4226 (HOTP).
 */

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const bits = cleaned
    .split('')
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0'))
    .join('');

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function generateTotp(
  secret: string,
  period: number,
  digits: number,
  algorithm: string
): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32), false);
  view.setUint32(4, counter >>> 0, false);

  const keyBytes = base32Decode(secret);

  // Map algorithm name to SubtleCrypto hash name
  const hashName = algorithm === 'SHA512' ? 'SHA-512' : algorithm === 'SHA256' ? 'SHA-256' : 'SHA-1';

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: hashName },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes.buffer.slice(0) as ArrayBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** digits).padStart(digits, '0');
}

interface TotpState {
  code: string;
  remaining: number;
  period: number;
}

export function useTotp(
  secret: string,
  period = 30,
  digits = 6,
  algorithm = 'SHA1'
): TotpState {
  const getNow = useCallback((): Omit<TotpState, 'code'> => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = period - (now % period);
    return { remaining, period };
  }, [period]);

  const [state, setState] = useState<TotpState>({
    code: '------',
    ...getNow(),
  });

  useEffect(() => {
    if (!secret) return;

    let cancelled = false;

    const update = async () => {
      try {
        const code = await generateTotp(secret, period, digits, algorithm);
        if (!cancelled) {
          setState({ code, ...getNow() });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, code: '------', ...getNow() }));
        }
      }
    };

    void update();

    const interval = setInterval(() => {
      void update();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [secret, period, digits, algorithm, getNow]);

  return state;
}
