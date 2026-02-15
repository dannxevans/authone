import { useState, type FormEvent } from 'react';
import CountdownRing from '../components/CountdownRing.tsx';
import CopyButton from '../components/CopyButton.tsx';
import { useTotp } from '../hooks/useTotp.ts';
import { apiClient } from '../api/client.ts';

interface Account {
  id: string;
  issuer: string;
  account: string;
  algorithm: string;
  digits: number;
  period: number;
  color: string | null;
  icon: string | null;
  secret?: string;
}

interface AccountTileProps {
  account: Account;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: { issuer: string; account: string }) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onPointerDownGrip?: (e: React.PointerEvent, id: string) => void;
}

function formatCode(code: string): string {
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

function EditModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: (issuer: string, accountName: string) => void;
}) {
  const [issuer, setIssuer] = useState(account.issuer);
  const [accountName, setAccountName] = useState(account.account);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.patch(`/accounts/${account.id}`, {
        issuer,
        account: accountName,
      });
      onSaved(issuer, accountName);
    } catch {
      setError('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-gray-900 rounded-xl shadow-2xl border border-gray-800 p-5">
        <h2 className="text-white font-semibold mb-4">Edit account</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              required
              autoFocus
              className={fieldClass}
              placeholder="e.g. Work Email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Account
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              className={fieldClass}
              placeholder="e.g. danny@example.com"
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AccountTile({
  account,
  onDelete,
  onUpdate,
  isDragging = false,
  isDragOver = false,
  onPointerDownGrip,
}: AccountTileProps) {
  const { code, remaining, period } = useTotp(
    account.secret ?? '',
    account.period,
    account.digits
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const isWarning = remaining <= 5;
  const accentColor = account.color ?? '#3b82f6';

  if (!account.secret) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-24 mb-2" />
        <div className="h-8 bg-gray-800 rounded w-32" />
      </div>
    );
  }

  return (
    <>
      <div
        data-account-id={account.id}
        className={`bg-gray-900 rounded-xl p-4 border transition-colors relative group select-none
          ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
          ${isDragOver ? 'border-blue-500 shadow-lg shadow-blue-900/30' : 'border-gray-800 hover:border-gray-700'}
        `}
        style={{ borderLeftColor: isDragOver ? undefined : accentColor, borderLeftWidth: 3 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1 flex items-start gap-2">
            {/* Drag grip — always visible on touch devices, hover-only on desktop */}
            <div
              onPointerDown={(e) => onPointerDownGrip?.(e, account.id)}
              className="text-gray-500 cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 -m-1"
              style={{ touchAction: 'none' }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.2" /><circle cx="11" cy="4" r="1.2" />
                <circle cx="5" cy="8" r="1.2" /><circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="12" r="1.2" /><circle cx="11" cy="12" r="1.2" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {account.issuer}
              </div>
              <div className="text-xs text-gray-400 truncate">{account.account}</div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative ml-2 flex-shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1 text-gray-500 hover:text-gray-300 rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-6 z-10 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-32">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowEdit(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(account.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Code + Ring — pl matches grip width + gap so code aligns under issuer name */}
        <div className="flex items-center justify-between pl-[22px]">
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-mono font-bold tracking-widest transition-colors ${
                isWarning ? 'text-amber-400' : 'text-white'
              }`}
            >
              {formatCode(code)}
            </span>
            <CopyButton text={code} />
          </div>

          <CountdownRing remaining={remaining} period={period} size={40} />
        </div>
      </div>

      {showEdit && (
        <EditModal
          account={account}
          onClose={() => setShowEdit(false)}
          onSaved={(issuer, accountName) => {
            setShowEdit(false);
            onUpdate(account.id, { issuer, account: accountName });
          }}
        />
      )}
    </>
  );
}

export type { Account };
