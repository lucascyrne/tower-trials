import { useAuth } from '@/resources/auth/auth-hook';
import { type JSX, useEffect, useState } from 'react';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

export default function FetchAuthState({ children }: Props) {
  const { loading } = useAuth();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Executar apenas no lado do cliente
    if (typeof window === 'undefined') return;

    // Verificar autenticação apenas uma vez na montagem do componente
    if (!initialCheckDone) {
      setInitialCheckDone(true);
    }
  }, [initialCheckDone]);

  // Mostrar loading durante a verificação inicial
  if (!initialCheckDone || loading.onAuthUserChanged) {
    return <LoadingSpin />;
  }

  return children;
}
