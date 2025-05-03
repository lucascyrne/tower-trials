'use client';

import { useAuth } from '@/resources/auth/auth-hook';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { JSX, useEffect } from 'react';
import FetchAuthState from './fetch-auth-layout';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

function AuthenticatedOnlyFeature({ children }: Props): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Verificar se o usuário está autenticado apenas no lado do cliente
    // e apenas quando temos certeza que o usuário não está autenticado (não undefined)
    if (typeof window !== 'undefined' && user === null && !loading.onAuthUserChanged) {
      const redirectUrl = `/auth?auth=${pathname}?${searchParams.toString()}`;
      router.push(redirectUrl);
    }
  }, [user, pathname, searchParams, loading.onAuthUserChanged]);

  // Mostrar loading enquanto verificamos a autenticação ou se o usuário não estiver definido
  if (user === null || user === undefined || loading.onAuthUserChanged) {
    return <LoadingSpin />;
  }

  // Se chegamos aqui, o usuário está autenticado
  return children;
}

export default function AuthenticatedOnlyFeatureWrapper({ children }: Props): JSX.Element {
  return (
    <FetchAuthState>
      <AuthenticatedOnlyFeature>{children}</AuthenticatedOnlyFeature>
    </FetchAuthState>
  );
}
