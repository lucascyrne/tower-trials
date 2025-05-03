'use client';

import { useAuth } from '@/resources/auth/auth-hook';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, JSX } from 'react';
import LoadingSpin from '../ui/loading-sping';
import FetchAuthState from './fetch-auth-layout';
import { toast } from 'sonner';

interface Props {
  children: React.ReactNode;
}

function PublicOnlyFeature({ children }: Props): React.ReactNode {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authLastPath = searchParams.get('auth');
  const pathname = usePathname();

  const alreadyLoggedOut = useRef(false);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Executar apenas no lado do cliente e quando temos certeza do estado de autenticação
    if (typeof window === 'undefined' || user === undefined || loading.onAuthUserChanged) {
      return;
    }

    // Lidar com a página de logout
    if (pathname === '/logout' && user) {
      toast.error('Sessão expirada, faça o login novamente.');
      signOut();
      alreadyLoggedOut.current = true;
      return;
    } else if (pathname === '/logout' && alreadyLoggedOut.current) {
      router.push('/login');
      return;
    }

    // Permitir acesso à página de verificação de email mesmo quando autenticado
    if (pathname === '/auth/verify-email') {
      return;
    }

    // Redirecionar usuários autenticados para área protegida
    if (user && !redirectAttempted.current) {
      redirectAttempted.current = true;
      if (authLastPath) {
        router.push(`${authLastPath}`);
      } else {
        router.replace('/game');
      }
    }
  }, [user, authLastPath, pathname, loading.onAuthUserChanged]);

  // Mostrar loading enquanto verificamos a autenticação
  if (user === undefined || loading.onAuthUserChanged) {
    return <LoadingSpin />;
  }

  // Se o usuário estiver autenticado e não estiver na página de verificação, mostrar loading
  if (user && !alreadyLoggedOut.current && pathname !== '/auth/verify-email') {
    return <LoadingSpin />;
  }

  // Se chegamos aqui, o usuário não está autenticado ou está na página de verificação
  return children;
}

export default function PublicOnlyFeatureWrapper({ children }: Props): JSX.Element {
  return (
    <FetchAuthState>
      <PublicOnlyFeature>{children}</PublicOnlyFeature>
    </FetchAuthState>
  );
}
