import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { getAuthChallenge, verifyAuthentication } from './passkeyApi.ts';
import { useAuthStore } from './authStore.ts';

interface PasskeyButtonProps {
  onSuccess: () => void;
}

export default function PasskeyButton({ onSuccess }: PasskeyButtonProps) {
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setLoading(true);

    try {
      const { sessionId, ...options } = await getAuthChallenge();
      const assertionResponse = await startAuthentication({ optionsJSON: options });
      const result = await verifyAuthentication(sessionId, assertionResponse);
      setAuth(result.accessToken, result.user);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // User cancelled — don't show error
        return;
      }
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Passkey sign-in failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed border border-gray-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C9.24 2 7 4.24 7 7c0 1.86.97 3.49 2.43 4.43C6.38 12.55 4 15.54 4 19h2c0-3.31 2.69-6 6-6s6 2.69 6 6h2c0-3.46-2.38-6.45-5.43-7.57C15.97 10.49 17 8.86 17 7c0-2.76-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z" fill="currentColor" opacity="0.5"/>
            <circle cx="18" cy="18" r="4" fill="currentColor" fillOpacity="0.9"/>
            <path d="M18 16v2M18 20v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        {loading ? 'Waiting for passkey…' : 'Sign in with passkey'}
      </button>

      {error && (
        <p className="text-red-400 text-xs text-center">{error}</p>
      )}
    </div>
  );
}
