import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client.ts';
import AccountTile, { type Account } from './AccountTile.tsx';
import AddAccountModal from './AddAccountModal.tsx';
import { useAuth } from '../auth/useAuth.ts';
import ExportModal from '../export/ExportModal.tsx';
import ImportModal from '../export/ImportModal.tsx';
import ChangePasswordModal from '../auth/ChangePasswordModal.tsx';
import ManagePasskeysModal from '../auth/ManagePasskeysModal.tsx';

type AccountWithSecret = Account & { secret?: string };

export default function AccountList() {
  const { logout, user } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showManagePasskeys, setShowManagePasskeys] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Account[]>('/accounts');
      setAccounts(data.map((a) => ({ ...a, secret: undefined })));

      // Fetch secrets for each account
      const secretPromises = data.map((a) =>
        apiClient
          .get<{ secret: string }>(`/accounts/${a.id}/secret`)
          .then(({ data: s }) => ({ id: a.id, secret: s.secret }))
          .catch(() => ({ id: a.id, secret: '' }))
      );

      const secrets = await Promise.all(secretPromises);
      setAccounts((prev) =>
        prev.map((a) => {
          const s = secrets.find((sec) => sec.id === a.id);
          return s ? { ...a, secret: s.secret } : a;
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? This cannot be undone.')) return;
    await apiClient.delete(`/accounts/${id}`);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdate = (id: string, updates: { issuer: string; account: string }) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (id: string) => setDragOverId(id);
  const handleDragEnd = () => {
    if (!dragId || !dragOverId || dragId === dragOverId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    setAccounts((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((a) => a.id === dragId);
      const toIdx = next.findIndex((a) => a.id === dragOverId);
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      // Persist new order — fire and forget
      next.forEach((a, i) => {
        void apiClient.patch(`/accounts/${a.id}`, { sort_order: i }).catch(() => null);
      });
      return next;
    });

    setDragId(null);
    setDragOverId(null);
  };

  const handleAccountAdded = () => {
    setShowAdd(false);
    void loadAccounts();
  };

  const handleImportDone = () => {
    setShowImport(false);
    void loadAccounts();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M28 4L8 13v14c0 12.4 8.5 24 20 27 11.5-3 20-14.6 20-27V13L28 4z" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="28" cy="26" r="6" fill="#3b82f6"/>
                <rect x="25" y="30" width="6" height="8" rx="1" fill="#3b82f6"/>
              </svg>
            <h1 className="text-white font-semibold">AuthOne</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M10 4v12M4 10h12" />
              </svg>
              Add
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                {user?.username ?? ''}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-40">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowImport(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Import accounts
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowExport(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Export accounts
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowManagePasskeys(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Manage passkeys
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowChangePassword(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Change password
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => void logout()}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-24"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-4">
              <svg width="64" height="64" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M28 4L8 13v14c0 12.4 8.5 24 20 27 11.5-3 20-14.6 20-27V13L28 4z" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="28" cy="26" r="6" fill="#3b82f6"/>
                <rect x="25" y="30" width="6" height="8" rx="1" fill="#3b82f6"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No accounts yet
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Add your first 2FA account to get started
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((account) => (
              <AccountTile
                key={account.id}
                account={account}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                isDragging={dragId === account.id}
                isDragOver={dragOverId === account.id && dragId !== account.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAccountAdded}
        />
      )}

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={handleImportDone} />
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {showManagePasskeys && (
        <ManagePasskeysModal onClose={() => setShowManagePasskeys(false)} />
      )}
    </div>
  );
}
