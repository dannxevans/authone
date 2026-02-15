import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LoginPage from './auth/LoginPage.tsx';
import AccountList from './accounts/AccountList.tsx';
import { useAuthStore } from './auth/authStore.ts';
import axios from 'axios';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { accessToken, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(!accessToken);

  useEffect(() => {
    if (accessToken) return;

    // Try a silent token refresh on page load
    axios
      .post<{ accessToken: string }>(
        '/api/auth/refresh',
        {},
        { withCredentials: true }
      )
      .then(async ({ data }) => {
        const meRes = await axios.get<{ id: string; username: string }>(
          '/api/auth/me',
          {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          }
        );
        setAuth(data.accessToken, meRes.data);
      })
      .catch(() => {
        // No valid session, stay on login
      })
      .finally(() => setChecking(false));
  }, [accessToken, setAuth]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AccountList />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
