import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { CookieMethodsBrowser } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente para uso no navegador
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Cliente para uso no servidor
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

// Função para criar cliente no middleware (SSR)
export const createServerClientHelper = (cookieStore: {
  get: (name: string) => { value: string } | undefined;
}) => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
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