import { useContext } from 'react';
import { GameStateContext, type GameStateContextType } from './game-state.context';

// Hook personalizado para usar o contexto
export function useGameState(): GameStateContextType {
  const context = useContext(GameStateContext);

  if (!context) {
    throw new Error('useGameState deve ser usado dentro de um GameStateProvider');
  }

  return context;
}
