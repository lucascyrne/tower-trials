'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import LoadingSpin from '@/components/ui/loading-sping';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleRedirect = useCallback(() => {
    if (pathname === '/auth/verify-email') {
      return;
    }

    if (user) {
      router.replace('/game');
    } else {
      router.replace('/auth');
    }
  }, [user, pathname, router]);

  useEffect(() => {
    if (!isLoading) {
      handleRedirect();
    }
  }, [isLoading]);

  // Mostrar loading enquanto verificamos a autenticação
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <LoadingSpin />
    </div>
  );
}
