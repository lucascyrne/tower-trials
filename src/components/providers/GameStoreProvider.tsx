import { type ReactNode, useEffect } from 'react';
import { useGameInitialization } from '../../stores/useGameStore';

interface GameStoreProviderProps {
  children: ReactNode;
}

/**
 * Provider opcional que facilita a migração gradual
 * Garante que os stores sejam inicializados quando o componente é montado
 */
export function GameStoreProvider({ children }: GameStoreProviderProps) {
  const { isInitialized } = useGameInitialization();

  // Log para desenvolvimento
  useEffect(() => {
    if (isInitialized) {
      console.log('[GameStoreProvider] Stores Zustand inicializados');
    }
  }, [isInitialized]);

  return <>{children}</>;
}
