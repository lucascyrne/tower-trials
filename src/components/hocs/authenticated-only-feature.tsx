import { useAuth } from '@/resources/auth/auth-hook';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { type JSX, useEffect, useRef, useLayoutEffect } from 'react';
import FetchAuthState from './fetch-auth-layout';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

function AuthenticatedOnlyFeature({ children }: Props): JSX.Element {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectAttempted = useRef(false);
  const lastAuthCheck = useRef<boolean | null>(null);

  // Usar useLayoutEffect para sincronizar com DOM antes de renderizar
  useLayoutEffect(() => {
    // Verificar se o estado de autenticação mudou
    const currentAuthState = user !== null;

    // Se o estado não mudou, não fazer nada
    if (lastAuthCheck.current === currentAuthState) {
      return;
    }

    lastAuthCheck.current = currentAuthState;

    // Resetar flag quando o estado de auth muda
    redirectAttempted.current = false;
  }, [user]);

  useEffect(() => {
    // Apenas executar no lado do cliente
    if (typeof window === 'undefined') {
      return;
    }

    // Esperar o loading terminar antes de tomar decisões
    if (loading.onAuthUserChanged) {
      return;
    }

    // Se usuário não está autenticado e não tentamos redirecionar ainda
    if (user === null && !redirectAttempted.current) {
      redirectAttempted.current = true;

      // Evitar redirecionamento se já estamos na página de auth
      if (location.pathname.startsWith('/auth')) {
        return;
      }

      // Construir path atual de forma segura
      const currentPath = `${location.pathname}${location.search || ''}`;

      // Validar e redirecionar
      if (currentPath && currentPath !== '/auth') {
        try {
          // Garantir que o path é uma string válida antes de codificar
          const pathToEncode = typeof currentPath === 'string' ? currentPath : '/game';
          const encodedPath = encodeURIComponent(pathToEncode);

          navigate({
            to: '/auth',
            search: { auth: encodedPath },
            replace: true, // Usar replace para evitar histórico desnecessário
          });
        } catch (error) {
          console.warn('Erro ao codificar path:', error);
          navigate({
            to: '/auth',
            search: { auth: encodeURIComponent('/game') },
            replace: true,
          });
        }
      } else {
        // Se não temos um path válido, redirecionar com parâmetro vazio
        navigate({
          to: '/auth',
          search: { auth: '' },
          replace: true,
        });
      }
    }
  }, [user, loading.onAuthUserChanged, location.pathname, location.search]);

  // Mostrar loading enquanto verificamos a autenticação
  if (loading.onAuthUserChanged || user === undefined) {
    return <LoadingSpin />;
  }

  // Se usuário não está autenticado, mostrar loading (redirecionamento em andamento)
  if (user === null) {
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
