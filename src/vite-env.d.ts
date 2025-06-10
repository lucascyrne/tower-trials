/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: 'LOCAL' | 'DEV' | 'PROD';
  readonly VITE_BASE_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SERVICE_ROLE?: string;
  readonly VITE_LOGIN_URL?: string;
  readonly VITE_SUPABASE_LOCAL_URL?: string;
  readonly VITE_SUPABASE_LOCAL_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
