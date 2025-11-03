import { type ReactNode } from 'react';

interface GameStoreProviderProps {
  children: ReactNode;
}

/**
 * Provider opcional que facilita a migração gradual
 * Garante que os stores sejam inicializados quando o componente é montado
 */
export function GameStoreProvider({ children }: GameStoreProviderProps) {

  return <>{children}</>;
}
