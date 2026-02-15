import { useState, type FormEvent } from 'react';
import { apiClient } from '../api/client.ts';

interface ManualEntryProps {
  prefill?: {
    secret?: string;
    issuer?: string;
    account?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
  };
  onAdded: () => void;
}

export default function ManualEntry({ prefill, onAdded }: ManualEntryProps) {
  const [secret, setSecret] = useState(prefill?.secret ?? '');
  const [issuer, setIssuer] = useState(prefill?.issuer ?? '');
  const [account, setAccount] = useState(prefill?.account ?? '');
  const [algorithm, setAlgorithm] = useState(prefill?.algorithm ?? 'SHA1');
  const [digits, setDigits] = useState(String(prefill?.digits ?? 6));
  const [period, setPeriod] = useState(String(prefill?.period ?? 30));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.post('/accounts', {
        secret: secret.toUpperCase().replace(/\s/g, ''),
        issuer,
        account,
        algorithm,
        digits: parseInt(digits),
        period: parseInt(period),
      });
      onAdded();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Failed to add account';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const labelClass = 'block text-sm font-medium text-gray-300 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>Secret key *</label>
        <input
          type="text"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          className={`${fieldClass} font-mono`}
          placeholder="JBSWY3DPEHPK3PXP"
          spellCheck={false}
        />
        <p className="text-xs text-gray-500 mt-1">Base32 encoded secret</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Issuer *</label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            required
            className={fieldClass}
            placeholder="GitHub"
          />
        </div>
        <div>
          <label className={labelClass}>Account *</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required
            className={fieldClass}
            placeholder="user@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Algorithm</label>
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className={fieldClass}
          >
            <option value="SHA1">SHA1</option>
            <option value="SHA256">SHA256</option>
            <option value="SHA512">SHA512</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Digits</label>
          <select
            value={digits}
            onChange={(e) => setDigits(e.target.value)}
            className={fieldClass}
          >
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Period (s)</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={fieldClass}
          >
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2 text-sm transition-colors mt-1"
      >
        {loading ? 'Adding...' : 'Add account'}
      </button>
    </form>
  );
}
