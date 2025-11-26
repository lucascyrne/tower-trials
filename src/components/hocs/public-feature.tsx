import { useAuth } from '@/resources/auth/auth-hook';
import FetchAuthState from './fetch-auth-layout';
import LoadingSpin from '../ui/loading-sping';
import type { JSX } from 'react';

interface Props {
  children: JSX.Element;
}

function PublicFeature({ children }: Props): React.ReactNode {
  const { loading } = useAuth();

  // Aguardar o carregamento de autenticação, mas não redirecionar
  if (loading.onAuthUserChanged) {
    return <LoadingSpin />;
  }

  // Renderizar conteúdo públicamente acessível
  return children;
}

export default function PublicFeatureWrapper({ children }: Props): JSX.Element {
  return (
    <FetchAuthState>
      <PublicFeature>{children}</PublicFeature>
    </FetchAuthState>
  );
}



