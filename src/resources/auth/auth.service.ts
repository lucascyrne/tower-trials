import { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  type User,
  type SignInDTO,
  type SignUpDTO,
  type UpdateProfileDTO,
  type AuthResponse,
} from './auth-model';

export const AuthService = {
  // Verificar sessão atual
  getSession: async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error: unknown) {
      console.error('Erro ao obter sessão:', error instanceof Error ? error.message : error);
      return null;
    }
  },

  // Obter usuário atual
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error?.status === 403 || !user) {
        return null;
      }

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError.message);
        return null;
      }

      if (!profile) {
        return null;
      }

      return {
        ...user,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        highest_floor: profile.highest_floor,
        total_games: profile.total_games,
        total_victories: profile.total_victories,
        total_character_level: profile.total_character_level,
        max_character_slots: profile.max_character_slots,
        is_active: profile.is_active,
        last_login: profile.last_login,
      } as User;
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes('JWT')) {
        console.error('Erro ao obter usuário atual:', error.message);
      }
      return null;
    }
  },

  // Logout
  signOut: async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: unknown) {
      console.error('Erro ao fazer logout:', error instanceof Error ? error.message : error);
      throw error;
    }
  },

  // Login com Email/Senha
  signInWithEmail: async ({ email, password }: SignInDTO): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) {
        return { user: null, session: null, error: 'Usuário não encontrado' };
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError.message);
        return { user: null, session: data.session, error: 'Erro ao buscar perfil do usuário' };
      }

      if (!profile) {
        return { user: null, session: data.session, error: 'Perfil não encontrado' };
      }

      // Atualizar last_login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('uid', data.user.id);

      const fullUser: User = {
        ...data.user,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        highest_floor: profile.highest_floor,
        total_games: profile.total_games,
        total_victories: profile.total_victories,
        total_character_level: profile.total_character_level,
        max_character_slots: profile.max_character_slots,
        is_active: profile.is_active,
        last_login: profile.last_login,
      };

      return { user: fullUser, session: data.session };
    } catch (error: unknown) {
      return { user: null, session: null, error: String(error) };
    }
  },

  // Registrar com Email/Senha
  signUpWithEmail: async (signUpData: SignUpDTO): Promise<AuthResponse> => {
    try {
      const { email, password, username = email.split('@')[0] } = signUpData;

      // Primeiro, crie o usuário no Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Falha ao criar usuário');
      }

      // Aguardar um momento para garantir que o usuário foi criado no Auth
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Usar função RPC ou inserção direta com service_role
        await supabase.rpc('create_user_profile', {
          p_uid: data.user.id,
          p_username: username,
          p_email: email,
        });
      } catch (rpcError) {
        console.error('Erro ao chamar RPC:', rpcError);

        // Fallback: inserção direta se a RPC falhar
        try {
          const { error: insertError } = await supabase.from('users').insert({
            uid: data.user.id,
            username,
            email,
            role: 'PLAYER',
            highest_floor: 0,
            total_games: 0,
            total_victories: 0,
            total_character_level: 0,
            max_character_slots: 3,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error('Erro no fallback de inserção:', insertError);
            if (insertError.code === '23505') {
              // Duplicate key
              return {
                user: {
                  ...data.user,
                  username,
                  role: 'PLAYER',
                  highest_floor: 0,
                  total_games: 0,
                  total_victories: 0,
                  total_character_level: 0,
                  max_character_slots: 3,
                  is_active: true,
                } as User,
                session: data.session,
              };
            }
            throw insertError;
          }
        } catch (fallbackError) {
          console.error('Erro total no processo de criação de perfil:', fallbackError);
          // Se chegamos aqui, houve falha em todas as tentativas
          // Mas ainda assim retornamos o usuário para que possa prosseguir com confirmação de email
        }
      }

      return {
        user: {
          ...data.user,
          username,
          role: 'PLAYER',
          highest_floor: 0,
          total_games: 0,
          total_victories: 0,
          total_character_level: 0,
          max_character_slots: 3,
          is_active: true,
        } as User,
        session: data.session,
      };
    } catch (error: unknown) {
      console.error('Erro no registro:', error instanceof Error ? error.message : error);
      return { user: null, session: null, error: String(error) };
    }
  },

  updateProfile: async (profile: UpdateProfileDTO): Promise<AuthResponse> => {
    try {
      const session = await AuthService.getSession();
      if (!session?.user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('users')
        .update({
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('uid', session.user.id)
        .select()
        .single();

      if (error) throw error;

      const currentUser = await AuthService.getCurrentUser();
      return { user: currentUser, session };
    } catch (error: unknown) {
      return { user: null, session: null, error: String(error) };
    }
  },

  handleAuthError: (error: unknown): Error => {
    if (error instanceof AuthError) {
      switch (error.status) {
        case 400:
          if (error.message.includes('Email not confirmed')) {
            return new Error('Por favor, confirme seu e-mail antes de fazer login');
          }
          if (error.message.includes('Invalid login credentials')) {
            return new Error('E-mail ou senha incorretos');
          }
          if (error.message.includes('Password should be at least 6 characters')) {
            return new Error('A senha deve ter pelo menos 6 caracteres');
          }
          if (error.message.includes('User already registered')) {
            return new Error('Este e-mail já está cadastrado');
          }
          break;
        case 401:
          return new Error('Sessão expirada. Por favor, faça login novamente');
        case 422:
          return new Error('Dados inválidos. Verifique as informações e tente novamente');
        case 429:
          return new Error('Muitas tentativas. Por favor, aguarde alguns minutos');
      }
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Ocorreu um erro inesperado. Tente novamente mais tarde');
  },
};
