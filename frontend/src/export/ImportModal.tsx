import { useState, useRef } from 'react';
import Modal from '../components/Modal.tsx';
import { apiClient } from '../api/client.ts';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Format = 'encrypted' | 'plain';

export default function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [format, setFormat] = useState<Format>('encrypted');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    imported: number;
    failed: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    // Auto-detect format from filename
    if (file.name.includes('encrypted')) setFormat('encrypted');
    else if (file.name.includes('plain')) setFormat('plain');

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError('');
    setLoading(true);

    try {
      const { data } = await apiClient.post<{
        imported: number;
        failed: number;
      }>('/import', {
        data: fileContent,
        format,
        passphrase: format === 'encrypted' ? passphrase : undefined,
      });
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Import failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    fileContent.length > 0 &&
    (format === 'plain' || passphrase.length >= 1);

  return (
    <Modal title="Import accounts" onClose={onClose} maxWidth="max-w-md">
      {result ? (
        <div className="text-center py-4">
          <div className="flex justify-center mb-3">
            {result.failed === 0 ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#16a34a" fillOpacity="0.15" stroke="#16a34a" strokeWidth="1.5"/>
                <path d="M7.5 12l3 3 6-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L22 20H2L12 3z" fill="#d97706" fillOpacity="0.15" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 10v4" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1" fill="#d97706"/>
              </svg>
            )}
          </div>
          <p className="text-white font-semibold text-lg mb-1">
            Import complete
          </p>
          <p className="text-gray-400 text-sm">
            {result.imported} account{result.imported !== 1 ? 's' : ''} imported
            {result.failed > 0 ? `, ${result.failed} failed` : ''}
          </p>
          <button
            onClick={onImported}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg py-2 px-5 text-sm transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            {fileName ? (
              <p className="text-white text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <div className="flex justify-center mb-1">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-gray-300 text-sm">Click to select export file</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              File format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['encrypted', 'plain'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-lg py-2 px-3 text-sm font-medium border transition-colors ${
                    format === f
                      ? 'border-blue-500 bg-blue-900/30 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {f === 'encrypted' ? 'Encrypted' : 'Plain text'}
                </button>
              ))}
            </div>
          </div>

          {format === 'encrypted' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Passphrase
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Export passphrase"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!canSubmit || loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      )}
    </Modal>
  );
}
