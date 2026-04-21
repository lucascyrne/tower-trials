'use client';

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';
import { AuthService } from './auth.service';
import {
  AuthLoadingState,
  AuthState,
  SignInDTO,
  SignUpDTO,
  UpdateProfileDTO,
} from './auth-model';
import { supabase } from '@/lib/supabase';

const initialLoadingState: AuthLoadingState = {
  signIn: false,
  signUp: false,
  signOut: false,
  updateProfile: false,
};

const initialState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  loading: initialLoadingState,
};

function sessionAuthKey(session: Session | null): string | null {
  if (!session?.access_token || !session.user?.id) return null;
  return `${session.access_token}:${session.user.id}`;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);
  const router = useRouter();
  const sessionKeyRef = useRef<string | null>(null);
  const loadUserSeq = useRef(0);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionKeyRef.current = null;
        setState(prev => ({
          ...prev,
          session: null,
          isLoading: true,
        }));
        return;
      }

      const key = sessionAuthKey(session);
      if (key != null && key === sessionKeyRef.current) {
        return;
      }

      sessionKeyRef.current = key;
      setState(prev => ({
        ...prev,
        session,
        isLoading: true,
      }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!state.isLoading) return;

    const seq = ++loadUserSeq.current;

    (async () => {
      try {
        const session = await AuthService.getSession();

        if (seq !== loadUserSeq.current) return;

        if (!session) {
          sessionKeyRef.current = null;
          setState({
            ...initialState,
            isLoading: false,
          });
          return;
        }

        const user = await AuthService.getCurrentUser();

        if (seq !== loadUserSeq.current) return;

        sessionKeyRef.current = sessionAuthKey(session);
        setState({
          ...initialState,
          user,
          session,
          isAuthenticated: !!user,
          isLoading: false,
        });
      } catch (error: unknown) {
        if (seq !== loadUserSeq.current) return;
        console.error('Erro ao carregar usuário:', error instanceof Error ? error.message : error);
        setState({
          ...initialState,
          error: error instanceof Error ? error.message : String(error),
          isLoading: false,
        });
      }
    })();
  }, [state.isLoading]);

  const signInWithEmail = useCallback(async (data: SignInDTO) => {
    setState(prev => ({ ...prev, loading: { ...prev.loading, signIn: true } }));
    try {
      const result = await AuthService.signInWithEmail(data);
      if (result.error) {
        setState(prev => ({
          ...prev,
          error: result.error,
          loading: { ...prev.loading, signIn: false },
        }));
        return { success: false, error: result.error };
      }
      setState(prev => ({
        ...prev,
        isLoading: true,
        loading: { ...prev.loading, signIn: false },
      }));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';
      setState(prev => ({
        ...prev,
        error: message,
        loading: { ...prev.loading, signIn: false },
      }));
      return { success: false, error: message };
    }
  }, []);

  const signUpWithEmail = useCallback(async (data: SignUpDTO) => {
    setState(prev => ({ ...prev, loading: { ...prev.loading, signUp: true } }));
    try {
      const result = await AuthService.signUpWithEmail(data);
      if (result.error) {
        setState(prev => ({
          ...prev,
          error: result.error,
          loading: { ...prev.loading, signUp: false },
        }));
        return { success: false, error: result.error };
      }
      setState(prev => ({
        ...prev,
        isLoading: true,
        loading: { ...prev.loading, signUp: false },
      }));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      setState(prev => ({
        ...prev,
        error: message,
        loading: { ...prev.loading, signUp: false },
      }));
      return { success: false, error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, signOut: true },
    }));

    try {
      await AuthService.signOut();
      sessionKeyRef.current = null;
      setState({
        ...initialState,
        isLoading: false,
      });
      router.push('/auth');
    } catch (error: unknown) {
      console.error('Erro ao fazer logout:', error instanceof Error ? error.message : error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        loading: { ...prev.loading, signOut: false },
      }));
    }
  }, [router]);

  const updateProfile = useCallback(async (data: UpdateProfileDTO) => {
    setState(prev => ({ ...prev, loading: { ...prev.loading, updateProfile: true } }));
    try {
      const result = await AuthService.updateProfile(data);
      if (result.error) {
        setState(prev => ({
          ...prev,
          error: result.error,
          loading: { ...prev.loading, updateProfile: false },
        }));
        return { success: false, error: result.error };
      }
      setState(prev => ({
        ...prev,
        isLoading: true,
        loading: { ...prev.loading, updateProfile: false },
      }));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      setState(prev => ({
        ...prev,
        error: message,
        loading: { ...prev.loading, updateProfile: false },
      }));
      return { success: false, error: message };
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
    }),
    [state, signInWithEmail, signUpWithEmail, signOut, updateProfile],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
