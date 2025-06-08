import { useContext } from 'react';
import { GameContext } from './game-context';

export function useGame() {
  const context = useContext(GameContext);
  
  if (!context) {
    throw new Error('useGame deve ser usado dentro de um GameProvider');
  }
  
  return context;
}

export { useGameState } from './providers/game-state.provider';
export { useGameLog } from './providers/log.provider';
export { useCharacter } from './providers/character.provider';
export { useBattle } from './providers/battle.provider';
export { useEvent } from './providers/event.provider'; 