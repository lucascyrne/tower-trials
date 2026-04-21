'use client';

import { useAuth } from '@/resources/auth/auth-hook';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import LoadingSpin from '../ui/loading-sping';
import { toast } from 'sonner';

interface Props {
  children: React.ReactNode;
}

function PublicOnlyFeatureInner({ children }: Props): React.ReactNode {
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authLastPath = searchParams.get('auth');
  const pathname = usePathname();

  const alreadyLoggedOut = useRef(false);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) {
      return;
    }

    if (pathname === '/logout' && user) {
      toast.error('Sessão expirada, faça o login novamente.');
      signOut();
      alreadyLoggedOut.current = true;
      return;
    } else if (pathname === '/logout' && alreadyLoggedOut.current) {
      router.push('/login');
      return;
    }

    if (pathname === '/auth/verify-email') {
      return;
    }

    if (user && !redirectAttempted.current) {
      redirectAttempted.current = true;
      if (authLastPath) {
        router.push(`${authLastPath}`);
      } else {
        router.replace('/game');
      }
    }
  }, [user, authLastPath, pathname, isLoading, router, signOut]);

  if (isLoading) {
    return <LoadingSpin />;
  }

  if (user && !alreadyLoggedOut.current && pathname !== '/auth/verify-email') {
    return <LoadingSpin />;
  }

  return children;
}

export default function PublicOnlyFeature({ children }: Props): React.ReactNode {
  return (
    <Suspense fallback={<LoadingSpin />}>
      <PublicOnlyFeatureInner>{children}</PublicOnlyFeatureInner>
    </Suspense>
  );
}
