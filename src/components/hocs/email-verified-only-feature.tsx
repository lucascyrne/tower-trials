'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';

export function EmailVerifiedOnlyFeature({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.email_confirmed_at) {
      router.push('/auth/verify-email');
    }
  }, [user]);

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return <>{children}</>;
}
