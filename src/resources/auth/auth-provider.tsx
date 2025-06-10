import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './auth-context';
import { AuthService } from './auth.service';
import {
  type AuthLoadingState,
  type AuthState,
  type SignInDTO,
  type SignUpDTO,
  type UpdateProfileDTO,
} from './auth-model';
import { supabase } from '@/lib/supabase';
import { useNavigate } from '@tanstack/react-router';

const initialLoadingState: AuthLoadingState = {
  onAuthUserChanged: true,
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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(initialState);

  const loadUser = useCallback(async () => {
    setState(prev => {
      if (!prev.isLoading) return prev;
      
      return {
        ...prev,
        loading: { ...prev.loading, onAuthUserChanged: true }
      };
    });

    try {
      const session = await AuthService.getSession();
      
      if (!session) {
        setState({
          ...initialState,
          isLoading: false,
          loading: { ...initialLoadingState, onAuthUserChanged: false },
        });
        return;
      }

      const user = await AuthService.getCurrentUser();
      setState({
        ...initialState,
        user,
        session,
        isAuthenticated: !!user,
        isLoading: false,
        loading: { ...initialLoadingState, onAuthUserChanged: false },
      });
    } catch (error: unknown) {
      console.error('Erro ao carregar usuário:', error instanceof Error ? error.message : error);
      setState({
        ...initialState,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
        loading: { ...initialLoadingState, onAuthUserChanged: false },
      });
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => {
        if (JSON.stringify(session) === JSON.stringify(prev.session)) {
          return prev;
        }
        
        return {
          ...prev,
          session,
          isLoading: true,
          loading: { ...prev.loading, onAuthUserChanged: true },
        };
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.isLoading) {
      loadUser();
    }
  }, [state.isLoading, loadUser]);

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
        loading: { ...prev.loading, signIn: false, onAuthUserChanged: true },
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
        loading: { ...prev.loading, signUp: false, onAuthUserChanged: true },
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
      setState({
        ...initialState,
        isLoading: false,
        loading: { ...initialLoadingState, onAuthUserChanged: false },
      });
      navigate({ to: '/auth', search: { auth: 'logout' } });
    } catch (error: unknown) {
      console.error('Erro ao fazer logout:', error instanceof Error ? error.message : error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        loading: { ...prev.loading, signOut: false },
      }));
    }
  }, [navigate]);

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
        loading: { ...prev.loading, updateProfile: false, onAuthUserChanged: true },
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
    [state],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
