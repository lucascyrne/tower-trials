import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export enum Environment {
  LOCAL = 'LOCAL',
  DEV = 'DEV',
  PROD = 'PROD'
}

const environment = createEnv({
  /*
   * Serverside environment variables, not exposed to the client
   * Will throw if you try to access them in the client
   */
  server: {},
  /*
   * Environment variables that are shared between the client and server
   * You'll get type errors if these are not prefixed with NEXT_PUBLIC_
   */
  client: {
    NEXT_PUBLIC_ENV: z.nativeEnum(Environment),
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    NEXT_PUBLIC_SERVICE_ROLE: z.string().optional(),
    NEXT_PUBLIC_LOGIN_URL: z.string().url(),
    
    // URLs locais do Supabase (quando rodando via Docker)
    NEXT_PUBLIC_SUPABASE_LOCAL_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY: z.string().optional(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle
   * You'll get type erroors if not all variables from `server` & `client` are included here
   */
  runtimeEnv: {
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SERVICE_ROLE: process.env.NEXT_PUBLIC_SERVICE_ROLE,
    NEXT_PUBLIC_LOGIN_URL: process.env.NEXT_PUBLIC_LOGIN_URL,
    NEXT_PUBLIC_SUPABASE_LOCAL_URL: process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY,
  }
});

export default environment;
