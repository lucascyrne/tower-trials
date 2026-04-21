import { createContext } from 'react';
import {
  AuthState,
  AuthLoadingState,
  SignInDTO,
  SignUpDTO,
  UpdateProfileDTO,
} from './auth-model';

const initialLoadingState: AuthLoadingState = {
  signIn: false,
  signUp: false,
  signOut: false,
  updateProfile: false,
};

export const initialState: AuthState = {
  user: null,
  session: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  loading: initialLoadingState,
};

type AuthResult = { success: boolean; error?: string };

export interface AuthContextType extends AuthState {
  signInWithEmail: (data: SignInDTO) => Promise<AuthResult>;
  signUpWithEmail: (data: SignUpDTO) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (data: UpdateProfileDTO) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextType>({
  ...initialState,
  signInWithEmail: async () => ({ success: false }),
  signUpWithEmail: async () => ({ success: false }),
  signOut: async () => {},
  updateProfile: async () => ({ success: false }),
});
