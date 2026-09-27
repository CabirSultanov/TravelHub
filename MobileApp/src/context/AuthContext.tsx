import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { api } from '@/services/api';
import { deleteToken, saveToken } from '@/services/auth';
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
    let mounted = true;
    setUser(null);
    setIsLoading(true);
    // A fresh app runtime requires sign-in; normal background/foreground keeps this session.
    void deleteToken().catch(() => {
      // Never restore the old token, even if secure storage is temporarily unavailable.
    }).finally(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
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
