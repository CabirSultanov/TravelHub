import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { api } from '@/services/api';
import { deleteToken, getToken, saveToken } from '@/services/auth';
import type { AuthUser } from '@/types/auth';
import { canAccessMobileApp } from '@/utils/mobileAccess';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function clearSession() {
    try {
      await deleteToken();
    } finally {
      setUser(null);
    }
  }

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getToken();
        if (!token) {
          return;
        }

        const currentUser = await api.getCurrentUser(token);
        if (!canAccessMobileApp(currentUser.role)) {
          await clearSession();
          return;
        }

        setUser(currentUser);
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    }

    void restoreSession();
  }, []);

  async function signIn(email: string, password: string) {
    setIsSigningIn(true);

    try {
      const response = await api.login({ email: email.trim(), password });
      if (!canAccessMobileApp(response.user.role)) {
        await clearSession();
        throw new Error('This application is available only for taxi drivers, admins, and super admins.');
      }

      await saveToken(response.accessToken);
      setUser(response.user);
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isSigningIn, signIn, signOut: clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
