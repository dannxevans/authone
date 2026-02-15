import { useState } from 'react';
import Modal from '../components/Modal.tsx';
import ManualEntry from './ManualEntry.tsx';
import QrScanner from './QrScanner.tsx';
import QrUpload from './QrUpload.tsx';
import { apiClient } from '../api/client.ts';

type Tab = 'scan' | 'upload' | 'manual';

interface OtpauthPrefill {
  secret?: string;
  issuer?: string;
  account?: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

function parseOtpauth(uri: string): OtpauthPrefill {
  try {
    const url = new URL(uri);
    const label = decodeURIComponent(url.pathname.slice(1));
    let issuer = url.searchParams.get('issuer') ?? '';
    let account = label;

    if (label.includes(':')) {
      const idx = label.indexOf(':');
      if (!issuer) issuer = label.slice(0, idx).trim();
      account = label.slice(idx + 1).trim();
    }

    return {
      secret: url.searchParams.get('secret') ?? '',
      issuer,
      account,
      algorithm: url.searchParams.get('algorithm') ?? 'SHA1',
      digits: parseInt(url.searchParams.get('digits') ?? '6'),
      period: parseInt(url.searchParams.get('period') ?? '30'),
    };
  } catch {
    return {};
  }
}

interface AddAccountModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddAccountModal({
  onClose,
  onAdded,
}: AddAccountModalProps) {
  const [tab, setTab] = useState<Tab>('scan');
  const [prefill, setPrefill] = useState<OtpauthPrefill | null>(null);
  const [uriError, setUriError] = useState('');
  const [uriLoading, setUriLoading] = useState(false);

  const handleQrDetected = async (uri: string) => {
    setUriLoading(true);
    setUriError('');
    try {
      await apiClient.post('/accounts', { uri });
      onAdded();
    } catch {
      // Fall back to manual entry with prefilled data
      setPrefill(parseOtpauth(uri));
      setTab('manual');
      setUriError('Could not auto-add. Please verify and submit manually.');
    } finally {
      setUriLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'scan', label: 'Scan QR' },
    { id: 'upload', label: 'Upload image' },
    { id: 'manual', label: 'Manual entry' },
  ];

  return (
    <Modal title="Add account" onClose={onClose}>
      {uriLoading && (
        <div className="text-center py-8 text-gray-400">Adding account...</div>
      )}

      {!uriLoading && (
        <>
          {/* Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-0.5 mb-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {uriError && (
            <div className="mb-3 bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-xs rounded-lg px-3 py-2">
              {uriError}
            </div>
          )}

          {tab === 'scan' && <QrScanner onDetected={handleQrDetected} />}
          {tab === 'upload' && <QrUpload onDetected={handleQrDetected} />}
          {tab === 'manual' && (
            <ManualEntry prefill={prefill ?? undefined} onAdded={onAdded} />
          )}
        </>
      )}
    </Modal>
  );
}
