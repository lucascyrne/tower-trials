import { useAuth } from '@/resources/auth/auth-hook';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { type JSX, useEffect } from 'react';
import FetchAuthState from './fetch-auth-layout';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

function AuthenticatedOnlyFeature({ children }: Props): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Verificar se o usuário está autenticado apenas no lado do cliente
    // e apenas quando temos certeza que o usuário não está autenticado (não undefined)
    if (typeof window !== 'undefined' && user === null && !loading.onAuthUserChanged) {
      const currentPath = location.pathname + location.search;
      navigate({ to: '/auth', search: { auth: currentPath } });
    }
  }, [user, location.pathname, location.search, loading.onAuthUserChanged, navigate]);

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
