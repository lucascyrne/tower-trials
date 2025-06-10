import { useAuth } from '@/resources/auth/auth-hook';
import { type JSX, useEffect, useState, useRef } from 'react';
import LoadingSpin from '../ui/loading-sping';

interface Props {
  children: JSX.Element;
}

export default function FetchAuthState({ children }: Props) {
  const { loading } = useAuth();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const mountedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Executar apenas no lado do cliente
    if (typeof window === 'undefined') return;

    // Evitar múltiplas execuções
    if (mountedRef.current) return;

    // Marcar como montado
    mountedRef.current = true;

    // Verificar autenticação com timeout para evitar loading eterno
    if (!initialCheckDone) {
      // Se não há loading ativo, marcar como pronto imediatamente
      if (!loading.onAuthUserChanged) {
        setInitialCheckDone(true);
      } else {
        // Timeout de segurança de 5 segundos
        timeoutRef.current = setTimeout(() => {
          setInitialCheckDone(true);
        }, 5000);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading.onAuthUserChanged, initialCheckDone]);

  // Marcar como pronto quando loading terminar
  useEffect(() => {
    if (!loading.onAuthUserChanged && !initialCheckDone) {
      setInitialCheckDone(true);

      // Limpar timeout se ainda existir
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [loading.onAuthUserChanged, initialCheckDone]);

  // Mostrar loading durante a verificação inicial
  if (!initialCheckDone) {
    return <LoadingSpin />;
  }

  return children;
}
