import { useAuth } from '@/resources/auth/auth-hook';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import LoadingSpin from '../ui/loading-sping';
import FetchAuthState from './fetch-auth-layout';

function RootRedirectFeature(): React.ReactNode {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Aguardar até que o estado de autenticação seja verificado
    if (loading.onAuthUserChanged) {
      return;
    }

    // Evitar múltiplos redirecionamentos
    if (redirectAttempted.current) {
      return;
    }

    redirectAttempted.current = true;

    // Se autenticado: ir para /game
    if (user) {
      navigate({ to: '/game', replace: true });
      return;
    }

    // Se não autenticado: ir para /home
    if (!user) {
      navigate({ to: '/home', replace: true });
      return;
    }
  }, [user, loading.onAuthUserChanged, navigate]);

  // Mostrar loading durante a verificação
  if (loading.onAuthUserChanged) {
    return <LoadingSpin />;
  }

  // Este componente é apenas para redirecionamento, não renderiza children
  return null;
}

export default function RootRedirectWrapper(): React.ReactNode {
  return (
    <FetchAuthState>
      <RootRedirectFeature />
    </FetchAuthState>
  );
}
