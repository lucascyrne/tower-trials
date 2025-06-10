import { type ReactNode, createContext, useContext, useState, useMemo } from 'react';
import { type GameContextState, type GameLoadingState } from '../game-model';
import { initialGameState } from '../game-context';
import { toast } from 'sonner';

interface GameStateContextType {
  gameState: GameContextState['gameState'];
  loading: GameLoadingState;
  error: string | null;
  setGameState: (state: GameContextState['gameState']) => void;
  updateLoading: (key: keyof GameLoadingState, value: boolean) => void;
  setError: (error: string | null) => void;
  resetError: () => void;
}

const GameStateContext = createContext<GameStateContextType | null>(null);

interface GameStateProviderProps {
  children: ReactNode;
}

export function GameStateProvider({ children }: GameStateProviderProps) {
  const [state, setState] = useState<GameContextState>({
    gameState: initialGameState,
    loading: {
      loadProgress: false,
      startGame: false,
      performAction: false,
      saveProgress: false
    },
    error: null,
    gameMessage: 'Bem-vindo ao Tower Trials! Crie um personagem para iniciar sua aventura.',
    gameLog: [{ text: 'Bem-vindo ao Tower Trials!', type: 'system' }]
  });

  // Função auxiliar para atualizar estado de loading
  const updateLoading = (key: keyof GameLoadingState, value: boolean) => {
    setState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        [key]: value,
      },
    }));
  };

  // Função para atualizar o estado do jogo
  const setGameState = (newGameState: GameContextState['gameState']) => {
    setState(prev => ({
      ...prev,
      gameState: newGameState,
    }));
  };

  // Função para definir erro
  const setError = (error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
    }));

    if (error) {
      toast.error('Erro', {
        description: error,
      });
    }
  };

  // Função para limpar mensagens de erro
  const resetError = () => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  };

  const contextValue = useMemo<GameStateContextType>(
    () => ({
      gameState: state.gameState,
      loading: state.loading,
      error: state.error,
      setGameState,
      updateLoading,
      setError,
      resetError,
    }),
    [state]
  );

  return (
    <GameStateContext.Provider value={contextValue}>
      {children}
    </GameStateContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useGameState() {
  const context = useContext(GameStateContext);
  
  if (!context) {
    throw new Error('useGameState deve ser usado dentro de um GameStateProvider');
  }
  
  return context;
} 