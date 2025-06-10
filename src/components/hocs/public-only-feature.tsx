import { useAuth } from '@/resources/auth/auth-hook';
import { useNavigate, useLocation, useSearch } from '@tanstack/react-router';
import { type JSX, useEffect, useRef, useLayoutEffect } from 'react';
import LoadingSpin from '../ui/loading-sping';
import FetchAuthState from './fetch-auth-layout';
import { toast } from 'sonner';

interface Props {
  children: React.ReactNode;
}

function PublicOnlyFeature({ children }: Props): React.ReactNode {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const search = useSearch({ strict: false }) as { auth?: string };
  const authLastPath = search.auth;

  const alreadyLoggedOut = useRef(false);
  const redirectAttempted = useRef(false);
  const lastAuthCheck = useRef<boolean | null>(null);

  // Usar useLayoutEffect para sincronizar mudanças de estado
  useLayoutEffect(() => {
    const currentAuthState = user !== null;
    
    // Se o estado não mudou, não fazer nada
    if (lastAuthCheck.current === currentAuthState) {
      return;
    }
    
    lastAuthCheck.current = currentAuthState;
    
    // Resetar flags quando o estado de auth muda
    if (!currentAuthState) {
      redirectAttempted.current = false;
      alreadyLoggedOut.current = false;
    }
  }, [user]);

  useEffect(() => {
    // Executar apenas no lado do cliente
    if (typeof window === 'undefined') {
      return;
    }

    // Esperar loading terminar antes de tomar decisões
    if (loading.onAuthUserChanged || user === undefined) {
      return;
    }

    // Lidar com a página de logout
    if (location.pathname === '/logout') {
      if (user && !alreadyLoggedOut.current) {
        toast.error('Sessão expirada, faça o login novamente.');
        signOut();
        alreadyLoggedOut.current = true;
        return;
      } else if (!user && alreadyLoggedOut.current) {
        const currentPath = `${location.pathname}${location.search || ''}`;
        try {
          // Garantir que o path é uma string válida antes de codificar
          const pathToEncode = typeof currentPath === 'string' ? currentPath : '';
          const encodedPath = pathToEncode ? encodeURIComponent(pathToEncode) : '';
          navigate({ 
            to: '/auth', 
            search: { auth: encodedPath },
            replace: true
          });
        } catch (error) {
          console.warn('Erro ao codificar path:', error);
          navigate({ 
            to: '/auth',
            search: { auth: '' },
            replace: true
          });
        }
        return;
      }
    }

    // Permitir acesso à página de verificação de email mesmo quando autenticado
    if (location.pathname === '/auth/verify-email') {
      return;
    }

    // Redirecionar usuários autenticados para área protegida
    if (user && !redirectAttempted.current && !alreadyLoggedOut.current) {
      redirectAttempted.current = true;
      
      try {
        if (authLastPath && typeof authLastPath === 'string' && authLastPath.trim() !== '' && authLastPath !== 'true') {
          // Tentar decodificar e validar o path
          const decodedPath = decodeURIComponent(authLastPath);
          if (decodedPath && decodedPath.startsWith('/') && !decodedPath.includes('[object') && !decodedPath.startsWith('/auth')) {
            navigate({ to: decodedPath, replace: true });
            return;
          }
        }
        
        // Fallback para página padrão
        navigate({ to: '/game', replace: true });
      } catch (error) {
        console.warn('Erro ao processar redirecionamento:', error);
        navigate({ to: '/game', replace: true });
      }
    }
  }, [
    user, 
    authLastPath, 
    location.pathname, 
    location.search, 
    loading.onAuthUserChanged, 
    signOut, 
    navigate
  ]);

  // Mostrar loading enquanto verificamos a autenticação
  if (loading.onAuthUserChanged || user === undefined) {
    return <LoadingSpin />;
  }

  // Se o usuário estiver autenticado e não estiver na página de verificação ou logout
  if (user && 
      !alreadyLoggedOut.current && 
      location.pathname !== '/auth/verify-email' &&
      location.pathname !== '/logout') {
    return <LoadingSpin />;
  }

  // Se chegamos aqui, o usuário não está autenticado ou está em página permitida
  return children;
}

export default function PublicOnlyFeatureWrapper({ children }: Props): JSX.Element {
  return (
    <FetchAuthState>
      <PublicOnlyFeature>{children}</PublicOnlyFeature>
    </FetchAuthState>
  );
}
