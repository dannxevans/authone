import { useState, useEffect, type FormEvent } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import Modal from '../components/Modal.tsx';
import { getRegistrationChallenge, verifyRegistration, listPasskeys, deletePasskey } from './passkeyApi.ts';
import type { PasskeyInfo } from './passkeyApi.ts';

interface ManagePasskeysModalProps {
  onClose: () => void;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ManagePasskeysModal({ onClose }: ManagePasskeysModalProps) {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [pendingAttestation, setPendingAttestation] = useState<import('@simplewebauthn/browser').RegistrationResponseJSON | null>(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPasskeys = async () => {
    try {
      const data = await listPasskeys();
      setPasskeys(data);
    } catch {
      setError('Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPasskeys();
  }, []);

  const handleAddPasskey = async () => {
    setError('');
    setRegistering(true);

    try {
      const options = await getRegistrationChallenge();
      const attestation = await startRegistration({ optionsJSON: options });
      setPendingAttestation(attestation);
      setShowNameInput(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // User cancelled — don't show error
      } else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (err instanceof Error ? err.message : 'Failed to register passkey');
        setError(msg);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingAttestation) return;

    setRegistering(true);
    setError('');

    try {
      await verifyRegistration(pendingAttestation, nameInput.trim() || 'Passkey');
      setPendingAttestation(null);
      setShowNameInput(false);
      setNameInput('');
      setLoading(true);
      await fetchPasskeys();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save passkey';
      setError(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError('');
    try {
      await deletePasskey(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete passkey');
    } finally {
      setDeletingId(null);
    }
  };

  const fieldClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal title="Manage passkeys" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Passkey list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : passkeys.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No passkeys registered yet
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-medium truncate">{pk.name}</div>
                  <div className="text-gray-500 text-xs">
                    Added {formatDate(pk.createdAt)} · Last used {formatDate(pk.lastUsedAt)}
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(pk.id)}
                  disabled={deletingId === pk.id}
                  className="ml-3 text-red-400 hover:text-red-300 disabled:opacity-50 text-sm flex-shrink-0"
                >
                  {deletingId === pk.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Name input after browser prompt succeeds */}
        {showNameInput && (
          <form onSubmit={handleSaveName} className="space-y-3 border-t border-gray-700 pt-4">
            <p className="text-gray-300 text-sm">Give this passkey a name so you can identify it later.</p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              className={fieldClass}
              placeholder="e.g. iPhone, MacBook Touch ID"
              maxLength={64}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowNameInput(false); setPendingAttestation(null); setNameInput(''); }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={registering}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {registering ? 'Saving…' : 'Save passkey'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Add passkey button */}
        {!showNameInput && (
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={registering || loading}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed border border-gray-700 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            {registering ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10 4v12M4 10h12" />
              </svg>
            )}
            {registering ? 'Follow browser prompt…' : 'Add passkey'}
          </button>
        )}
      </div>
    </Modal>
  );
}
