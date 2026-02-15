import { useState } from 'react';
import Modal from '../components/Modal.tsx';
import { apiClient } from '../api/client.ts';

interface ExportModalProps {
  onClose: () => void;
}

type Format = 'encrypted' | 'plain';

export default function ExportModal({ onClose }: ExportModalProps) {
  const [format, setFormat] = useState<Format>('encrypted');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    format === 'plain' ? confirm === 'EXPORT' : passphrase.length >= 8;

  const handleExport = async () => {
    setError('');
    setLoading(true);

    try {
      const payload =
        format === 'encrypted'
          ? { format, passphrase }
          : { format };

      const { data } = await apiClient.post<object>('/export', payload);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'encrypted'
          ? 'otp-export-encrypted.json'
          : 'otp-export-plain.json';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Export failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Export accounts" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Format selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFormat('encrypted')}
            className={`rounded-lg p-3 text-left border transition-colors ${
              format === 'encrypted'
                ? 'border-blue-500 bg-blue-900/30 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            <div className="text-sm font-medium mb-0.5">Encrypted</div>
            <div className="text-xs text-gray-400">
              Password-protected, safe for cloud backup
            </div>
          </button>
          <button
            onClick={() => setFormat('plain')}
            className={`rounded-lg p-3 text-left border transition-colors ${
              format === 'plain'
                ? 'border-amber-500 bg-amber-900/20 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            <div className="text-sm font-medium mb-0.5">Plain text</div>
            <div className="text-xs text-gray-400">
              Unencrypted URIs, for migrating to other apps
            </div>
          </button>
        </div>

        {format === 'encrypted' ? (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Export passphrase
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 8 characters"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Remember this passphrase — you will need it to import the file.
            </p>
          </div>
        ) : (
          <div>
            <div className="bg-amber-900/30 border border-amber-700 text-amber-300 text-sm rounded-lg px-3 py-3">
              <strong>Warning:</strong> This export contains your unencrypted
              TOTP secrets. Anyone with this file can generate your 2FA codes.
              Keep it secure.
            </div>
            <label className="block text-sm font-medium text-gray-300 mt-3 mb-1.5">
              Type <span className="font-mono text-white">EXPORT</span> to
              confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="EXPORT"
              autoFocus
            />
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={!canSubmit || loading}
          className={`w-full font-medium rounded-lg py-2 text-sm transition-colors ${
            format === 'plain'
              ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 text-white disabled:cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white disabled:cursor-not-allowed'
          }`}
        >
          {loading ? 'Exporting...' : 'Download export file'}
        </button>
      </div>
    </Modal>
  );
}
