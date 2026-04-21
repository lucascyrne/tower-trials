import { createClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '@/utils/supabase/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabasePublishableKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
}

export const supabase = createBrowserClient();
export const supabaseServer = createClient(supabaseUrl, supabasePublishableKey);

// Helper para obter o token da sessão atual
export const getSupabaseToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

export const getCurrentEnvironment = () => {
  return process.env.NEXT_PUBLIC_ENV;
};

export const isLocalEnvironment = () => {
  return process.env.NEXT_PUBLIC_ENV === 'LOCAL';
};