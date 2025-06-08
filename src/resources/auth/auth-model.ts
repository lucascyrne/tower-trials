import { z } from 'zod';
import { type Session, type User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'PLAYER' | 'ADMIN';

// Tipos para autenticação e gerenciamento de usuários
export interface User extends SupabaseUser {
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: UserRole;
  highest_floor: number;
  total_games: number;
  total_victories: number;
  total_character_level: number;
  max_character_slots: number;
  is_active: boolean;
  last_login: string;
}

export interface AuthLoadingState {
  onAuthUserChanged: boolean;
  signIn: boolean;
  signUp: boolean;
  signOut: boolean;
  updateProfile: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null | undefined;
  loading: AuthLoadingState;
}

// DTOs para operações de autenticação
export interface SignInDTO {
  email: string;
  password: string;
}

export interface SignUpDTO {
  email: string;
  password: string;
  username?: string;
  display_name?: string;
}

export interface UpdateProfileDTO {
  display_name?: string;
  avatar_url?: string;
}

// Resposta da API para operações de autenticação
export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error?: string;
}

// Esquemas de validação Zod
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
