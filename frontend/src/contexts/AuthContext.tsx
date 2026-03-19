import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface UserProfile { firstName: string; lastName: string; businessName?: string; address?: string; }
interface AuthUser { id: string; email: string; role: string; isPhoneVerified: boolean; phoneNumber?: string; profile: UserProfile; }

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    const r = await api.get('/users/profile');
    const u = r.data.data;
    setUser({ id: u._id, email: u.email, role: u.role, isPhoneVerified: u.isPhoneVerified, phoneNumber: u.phoneNumber, profile: u.profile });
  };

  useEffect(() => {
    const stored = localStorage.getItem('authToken');
    if (stored) {
      fetchUser()
        .catch(() => { localStorage.removeItem('authToken'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: u, tokens } = res.data.data;
    localStorage.setItem('authToken', tokens.accessToken);
    setToken(tokens.accessToken);
    setUser({ id: u.id, email: u.email, role: u.role, isPhoneVerified: u.isPhoneVerified, phoneNumber: u.phoneNumber, profile: u.profile });
  };

  const refreshUser = async () => { await fetchUser(); };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
