import { z } from 'zod';

export enum Environment {
  LOCAL = 'LOCAL',
  DEV = 'DEV',
  PROD = 'PROD'
}

// Schema de validação para variáveis de ambiente do Vite
const envSchema = z.object({
  VITE_ENV: z.nativeEnum(Environment),
  VITE_BASE_URL: z.string().url().optional(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string(),
  VITE_SERVICE_ROLE: z.string().optional(),
  VITE_LOGIN_URL: z.string().url().optional(),
  
  // URLs locais do Supabase (quando rodando via Docker)
  VITE_SUPABASE_LOCAL_URL: z.string().url().optional(),
  VITE_SUPABASE_LOCAL_ANON_KEY: z.string().optional(),
});

// Função para obter e validar variáveis de ambiente do Vite
function createViteEnv() {
  const env = {
    VITE_ENV: import.meta.env.VITE_ENV as Environment,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL || 'http://localhost:5173',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SERVICE_ROLE: import.meta.env.VITE_SERVICE_ROLE,
    VITE_LOGIN_URL: import.meta.env.VITE_LOGIN_URL || 'http://localhost:5173/auth',
    VITE_SUPABASE_LOCAL_URL: import.meta.env.VITE_SUPABASE_LOCAL_URL,
    VITE_SUPABASE_LOCAL_ANON_KEY: import.meta.env.VITE_SUPABASE_LOCAL_ANON_KEY,
  };

  // Validar variáveis de ambiente obrigatórias
  try {
    return envSchema.parse(env);
  } catch (error) {
    console.error('❌ Erro de configuração de ambiente:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    console.error('\n📋 Variáveis necessárias:');
    console.error('- VITE_ENV (LOCAL, DEV, ou PROD)');
    console.error('- VITE_SUPABASE_URL');
    console.error('- VITE_SUPABASE_ANON_KEY');
    console.error('\n💡 Crie um arquivo .env.local com essas variáveis');
    
    throw new Error('Configuração de ambiente inválida');
  }
}

const environment = createViteEnv();

export default environment;
