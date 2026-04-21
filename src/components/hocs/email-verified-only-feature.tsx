'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import LoadingSpin from '../ui/loading-sping';

export function EmailVerifiedOnlyFeature({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.email_confirmed_at) {
      router.push('/auth/verify-email');
    }
  }, [user, router]);

  if (!user || !user.email_confirmed_at) {
    return <LoadingSpin />;
  }

  return <>{children}</>;
}
