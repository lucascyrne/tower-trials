'use client';

import { useAuth } from '@/resources/auth/auth-hook';
import { useRouter } from 'next/navigation';
import { JSX, useEffect } from 'react';
import { toast } from 'sonner';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

export default function AdministratorOnlyFeature({ children }: Props): JSX.Element {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== 'ADMIN') {
      toast.error('Você não tem permissão para acessar esta página');
      router.push('/403');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingSpin />;
  }

  if (user.role !== 'ADMIN') {
    return <></>;
  }

  return children;
}
