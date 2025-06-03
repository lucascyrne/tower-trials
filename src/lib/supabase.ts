import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { CookieMethodsBrowser } from '@supabase/ssr';
import env, { Environment } from '@/config/env';

// Configurações por ambiente
const getSupabaseConfig = () => {
  const environment = env.NEXT_PUBLIC_ENV;
  
  switch (environment) {
    case Environment.LOCAL:
      // Ambiente local (Docker)
      return {
        url: env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321',
        anonKey: env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        serviceRoleKey: env.NEXT_PUBLIC_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
      };
    
    case Environment.DEV:
    case Environment.PROD:
    default:
      // Ambientes remotos (DEV/PROD usam as mesmas URLs por enquanto)
      return {
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        serviceRoleKey: env.NEXT_PUBLIC_SERVICE_ROLE
      };
  }
};

const config = getSupabaseConfig();

// Cliente para uso no navegador
export const supabase = createBrowserClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Cliente para uso no servidor
export const supabaseServer = createClient(config.url, config.anonKey);

// Cliente com service_role para funções administrativas (uso restrito)
export const supabaseAdmin = createClient(config.url, config.serviceRoleKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função para criar cliente no middleware (SSR)
export const createServerClientHelper = (cookieStore: {
  get: (name: string) => { value: string } | undefined;
}) => {
  return createBrowserClient(config.url, config.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
      getAll() { return [] },
      setAll() {},
    } as CookieMethodsBrowser,
  });
};

// Helper para obter o token da sessão atual
export const getSupabaseToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Função para verificar qual ambiente está sendo usado
export const getCurrentEnvironment = () => {
  return env.NEXT_PUBLIC_ENV;
};

// Função para verificar se está no ambiente local
export const isLocalEnvironment = () => {
  return env.NEXT_PUBLIC_ENV === Environment.LOCAL;
};

// Log para debug (apenas em desenvolvimento)
if (typeof window !== 'undefined' && env.NEXT_PUBLIC_ENV !== Environment.PROD) {
  console.log(`🏗️ Supabase conectado ao ambiente: ${env.NEXT_PUBLIC_ENV}`);
  console.log(`📡 URL: ${config.url}`);
} 