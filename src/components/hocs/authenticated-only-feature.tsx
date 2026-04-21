'use client';

import { useAuth } from '@/resources/auth/auth-hook';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { JSX, Suspense, useEffect } from 'react';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

function AuthenticatedOnlyFeatureInner({ children }: Props): JSX.Element {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && user === null && !isLoading) {
      const redirectUrl = `/auth?auth=${pathname}?${searchParams.toString()}`;
      router.push(redirectUrl);
    }
  }, [user, pathname, searchParams, isLoading, router]);

  if (isLoading || user === null) {
    return <LoadingSpin />;
  }

  return children;
}

export default function AuthenticatedOnlyFeature({ children }: Props): JSX.Element {
  return (
    <Suspense fallback={<LoadingSpin />}>
      <AuthenticatedOnlyFeatureInner>{children}</AuthenticatedOnlyFeatureInner>
    </Suspense>
  );
}
