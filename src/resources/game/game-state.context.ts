import { createContext } from 'react';
import { type GameContextState, type GameLoadingState } from './game-model';

export interface GameStateContextType {
  gameState: GameContextState['gameState'];
  loading: GameLoadingState;
  error: string | null;
  setGameState: (state: GameContextState['gameState']) => void;
  updateLoading: (key: keyof GameLoadingState, value: boolean) => void;
  setError: (error: string | null) => void;
  resetError: () => void;
}

export const GameStateContext = createContext<GameStateContextType | null>(null);
