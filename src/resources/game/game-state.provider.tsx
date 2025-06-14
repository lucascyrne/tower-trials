import { type ReactNode, useState, useMemo } from 'react';
import { type GameContextState, type GameLoadingState } from './game-model.ts';
import { initialGameState } from './game-context.ts';
import { toast } from 'sonner';
import { GameStateContext, type GameStateContextType } from './game-state.context.ts';

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
      saveProgress: false,
    },
    error: null,
    gameMessage: 'Bem-vindo ao Tower Trials! Crie um personagem para iniciar sua aventura.',
    gameLog: [{ text: 'Bem-vindo ao Tower Trials!', type: 'system' }],
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

  return <GameStateContext.Provider value={contextValue}>{children}</GameStateContext.Provider>;
}
