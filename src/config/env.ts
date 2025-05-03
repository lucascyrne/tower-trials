import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export enum Environment {
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
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_ENV: z.nativeEnum(Environment)
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle
   * You'll get type erroors if not all variables from `server` & `client` are included here
   */
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV
  }
});

export default environment;
