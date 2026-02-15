import { useAuthStore } from './authStore.ts';
import { apiClient } from '../api/client.ts';

export function useAuth() {
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();

  const login = async (username: string, password: string) => {
    const { data } = await apiClient.post<{
      accessToken: string;
      user: { id: string; username: string };
    }>('/auth/login', { username, password });
    setAuth(data.accessToken, data.user);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuth();
    }
  };

  return {
    isAuthenticated: !!accessToken,
    user,
    login,
    logout,
  };
}
