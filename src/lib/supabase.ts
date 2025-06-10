import { createClient } from '@supabase/supabase-js';
import env, { Environment } from '@/config/env';

// Configurações por ambiente
const getSupabaseConfig = () => {
  const environment = env.VITE_ENV;

  switch (environment) {
    case Environment.LOCAL:
      // Ambiente local (Docker)
      return {
        url: env.VITE_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321',
        anonKey:
          env.VITE_SUPABASE_LOCAL_ANON_KEY ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        serviceRoleKey:
          env.VITE_SERVICE_ROLE ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      };

    case Environment.DEV:
    case Environment.PROD:
    default:
      // Ambientes remotos (DEV/PROD usam as mesmas URLs por enquanto)
      return {
        url: env.VITE_SUPABASE_URL,
        anonKey: env.VITE_SUPABASE_ANON_KEY,
        serviceRoleKey: env.VITE_SERVICE_ROLE,
      };
  }
};

const config = getSupabaseConfig();

// Cliente principal para uso na aplicação
export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage, // Usar localStorage em ambiente web
  },
});

// Cliente com service_role para funções administrativas (uso restrito)
export const supabaseAdmin = createClient(config.url, config.serviceRoleKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper para obter o token da sessão atual
export const getSupabaseToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
};

// Função para verificar qual ambiente está sendo usado
export const getCurrentEnvironment = () => {
  return env.VITE_ENV;
};

// Função para verificar se está no ambiente local
export const isLocalEnvironment = () => {
  return env.VITE_ENV === Environment.LOCAL;
};

// Log para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log(`🏗️ Supabase conectado ao ambiente: ${env.VITE_ENV}`);
  console.log(`📡 URL: ${config.url}`);
}
