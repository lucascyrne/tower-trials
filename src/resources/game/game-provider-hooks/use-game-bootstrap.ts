import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import { GameContextState, GameLoadingState } from '../game-model';
import { CharacterService } from '../character.service';
import { Character } from '../models/character.model';

interface UseGameBootstrapParams {
  userId?: string;
  actionControlRef: MutableRefObject<{ isProcessing: boolean }>;
  updateLoading: (key: keyof GameLoadingState, value: boolean) => void;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setState: Dispatch<SetStateAction<GameContextState>>;
}

export function useGameBootstrap({
  userId,
  actionControlRef,
  updateLoading,
  setCharacters,
  setState,
}: UseGameBootstrapParams) {
  useEffect(() => {
    const loadCharacters = async () => {
      if (!userId || actionControlRef.current.isProcessing) {
        return;
      }

      try {
        actionControlRef.current.isProcessing = true;
        updateLoading('loadProgress', true);
        const response = await CharacterService.getUserCharacters(userId);

        if (response.success && response.data) {
          const userCharacters = response.data;
          setCharacters(userCharacters);
          setState(prev => ({
            ...prev,
            gameMessage:
              userCharacters.length > 0
                ? prev.gameState.mode === 'menu'
                  ? 'Selecione um personagem para jogar!'
                  : prev.gameMessage
                : 'Você ainda não tem personagens. Crie um para começar!',
          }));
        } else if (response.error) {
          setState(prev => ({ ...prev, error: response.error }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao carregar personagens',
        }));
      } finally {
        updateLoading('loadProgress', false);
        actionControlRef.current.isProcessing = false;
      }
    };

    loadCharacters();
  }, [actionControlRef, setCharacters, setState, updateLoading, userId]);
}
