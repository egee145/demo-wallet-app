import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AccountType, AuthUser, RegisterInput, TokenResponse } from '../../domain/types';
import { api, configureApiAuth } from '../api/api-client';
import { tokenStore } from '../storage/token-store';
import { deactivatePushDevice } from '../notifications/notification-service';

type AuthContextValue = {
  user: AuthUser | null;
  restoring: boolean;
  login: (email: string, password: string, accountType: AccountType) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    configureApiAuth({ token: null });
    void tokenStore.clear();
  }, []);

  useEffect(() => {
    configureApiAuth({ onAuthFailure: clearSession });
    void tokenStore
      .load()
      .then((tokens) => {
        if (tokens) {
          setUser(tokens.user);
          configureApiAuth({ token: tokens.accessToken, onAuthFailure: clearSession });
        }
      })
      .finally(() => setRestoring(false));
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string, accountType: AccountType) => {
      const response = await api.post<TokenResponse>('/auth/login', {
        email,
        password,
        accountType,
      });
      await tokenStore.save(response.data);
      configureApiAuth({ token: response.data.accessToken, onAuthFailure: clearSession });
      setUser(response.data.user);
    },
    [clearSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await api.post<TokenResponse>('/auth/register', input);
      await tokenStore.save(response.data);
      configureApiAuth({ token: response.data.accessToken, onAuthFailure: clearSession });
      setUser(response.data.user);
    },
    [clearSession],
  );

  const logout = useCallback(async () => {
    const tokens = await tokenStore.load();
    if (tokens) {
      try {
        await deactivatePushDevice();
      } catch {
        // Device deactivation is best effort; token rotation still protects the account.
      }
      try {
        await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
      } catch {
        // Local logout must still finish when the backend is unreachable.
      }
    }
    await tokenStore.clear();
    configureApiAuth({ token: null });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, restoring, login, register, logout }),
    [user, restoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
