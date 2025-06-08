import { useAuth } from '@/resources/auth/auth-hook';
import { type JSX, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

export default function AdministratorOnlyFeature({ children }: Props): JSX.Element {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading.onAuthUserChanged && user && user.role !== 'ADMIN') {
      toast.error('Você não tem permissão para acessar esta página');
      navigate({ to: '/403' });
    }
  }, [user, loading.onAuthUserChanged, navigate]);

  if (loading.onAuthUserChanged || !user) {
    return <LoadingSpin />;
  }

  if (user.role !== 'ADMIN') {
    return <></>;
  }

  return children;
}
