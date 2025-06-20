import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { useEffect } from 'react';
import { type ActionType } from '../models/game.model';
import { type Character } from '../models/character.model';
import { useGameStateStore } from './useGameStateStore';
import { GameStateService } from '../services/game-state.service';
import { CharacterService } from '../services/character.service';
import { toast } from 'sonner';

interface GameStoreState {
  // Controle de ações
  isProcessingAction: boolean;
  lastActionTimestamp: number;

  // Cache de dados
  availableCharacters: Character[];

  // Estado de sessão
  sessionId: string | null;
  isInitialized: boolean;
}

interface GameStoreActions {
  // Inicialização e controle de sessão
  initializeGame: () => void;
  clearGame: () => void;

  // Ações de personagem
  startGame: (characterId: string) => Promise<void>;
  loadCharacterForHub: (characterId: string) => Promise<void>;

  // Ações de jogo
  performAction: (action: ActionType, spellId?: string, consumableId?: string) => Promise<void>;
  saveProgress: () => Promise<void>;
  returnToMenu: () => void;

  // Ações de controle
  setProcessingAction: (processing: boolean) => void;
  updateLastActionTimestamp: () => void;

  // Cache management
  setAvailableCharacters: (characters: Character[]) => void;
  refreshCharacterData: (characterId: string) => Promise<void>;
}

type GameStore = GameStoreState & GameStoreActions;

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // === ESTADO INICIAL ===
    isProcessingAction: false,
    lastActionTimestamp: 0,
    availableCharacters: [],
    sessionId: null,
    isInitialized: false,

    // === INICIALIZAÇÃO ===

    initializeGame: () => {
      console.log('[GameStore] Inicializando sistema de jogo');
      const sessionId = `game-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      set(
        produce(draft => {
          draft.sessionId = sessionId;
          draft.isInitialized = true;
          draft.lastActionTimestamp = Date.now();
        })
      );

      // Resetar estado do jogo
      useGameStateStore.getState().resetGameState();
    },

    clearGame: () => {
      console.log('[GameStore] Limpando estado do jogo');
      set(
        produce(draft => {
          draft.isProcessingAction = false;
          draft.lastActionTimestamp = 0;
          draft.availableCharacters = [];
          draft.sessionId = null;
          draft.isInitialized = false;
        })
      );

      // Resetar estado do jogo
      useGameStateStore.getState().resetGameState();
    },

    // === AÇÕES DE PERSONAGEM ===

    startGame: async (characterId: string) => {
      const gameStateStore = useGameStateStore.getState();

      try {
        console.log('[GameStore] Iniciando jogo com personagem:', characterId);
        gameStateStore.updateLoading('startGame', true);

        // Carregar dados do personagem para o jogo
        const player = await GameStateService.loadPlayerForGame(characterId);

        // Atualizar estado do jogo
        gameStateStore.updateGameState(draft => {
          draft.mode = 'hub';
          draft.player = player;
          draft.gameMessage = `Bem-vindo de volta, ${player.name}!`;
        });

        // Atualizar timestamp da última ação
        get().updateLastActionTimestamp();

        toast.success('Jogo iniciado', {
          description: `Bem-vindo de volta, ${player.name}!`,
        });
      } catch (error) {
        console.error('[GameStore] Erro ao iniciar jogo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao iniciar jogo';
        gameStateStore.setError(errorMessage);
      } finally {
        gameStateStore.updateLoading('startGame', false);
      }
    },

    loadCharacterForHub: async (characterId: string) => {
      const gameStateStore = useGameStateStore.getState();

      try {
        console.log('[GameStore] Carregando personagem para hub:', characterId);
        gameStateStore.updateLoading('loadProgress', true);

        // Carregar dados completos do personagem
        const player = await GameStateService.loadPlayerForGame(characterId);

        // Atualizar estado do jogo
        gameStateStore.updateGameState(draft => {
          draft.mode = 'hub';
          draft.player = player;
          draft.gameMessage = 'Escolha sua próxima ação.';
        });
      } catch (error) {
        console.error('[GameStore] Erro ao carregar personagem:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar personagem';
        gameStateStore.setError(errorMessage);
      } finally {
        gameStateStore.updateLoading('loadProgress', false);
      }
    },

    // === AÇÕES DE JOGO ===

    performAction: async (action: ActionType, spellId?: string, consumableId?: string) => {
      const state = get();
      const gameStateStore = useGameStateStore.getState();

      // Controle de debounce
      const now = Date.now();
      const timeSinceLastAction = now - state.lastActionTimestamp;

      if (state.isProcessingAction) {
        console.warn('[GameStore] Ação bloqueada - já processando outra ação');
        return;
      }

      if (timeSinceLastAction < 500) {
        // 500ms debounce
        console.warn('[GameStore] Ação bloqueada - debounce ativo');
        return;
      }

      try {
        console.log('[GameStore] Processando ação:', action, { spellId, consumableId });

        set(
          produce(draft => {
            draft.isProcessingAction = true;
            draft.lastActionTimestamp = now;
          })
        );

        gameStateStore.updateLoading('performAction', true);

        // Aqui seria a lógica de processamento da ação
        // Por exemplo, chamar GameService.processPlayerAction
        // Para agora, apenas simulo uma atualização

        gameStateStore.updateGameState(draft => {
          draft.gameMessage = `Ação ${action} processada com sucesso!`;
        });

        // Simular delay de processamento
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('[GameStore] Erro ao processar ação:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao processar ação';
        gameStateStore.setError(errorMessage);
      } finally {
        set(
          produce(draft => {
            draft.isProcessingAction = false;
          })
        );
        gameStateStore.updateLoading('performAction', false);
      }
    },

    saveProgress: async () => {
      const gameStateStore = useGameStateStore.getState();
      const currentGameState = gameStateStore.gameState;

      if (!currentGameState.player?.id) {
        console.warn('[GameStore] Não é possível salvar - nenhum jogador ativo');
        return;
      }

      try {
        console.log('[GameStore] Salvando progresso do personagem:', currentGameState.player.id);
        gameStateStore.updateLoading('saveProgress', true);

        // Atualizar stats do personagem
        await CharacterService.updateCharacterHpMana(
          currentGameState.player.id,
          currentGameState.player.hp,
          currentGameState.player.mana
        );

        // Atualizar andar atual
        if (currentGameState.player.floor > 0) {
          await CharacterService.updateCharacterFloor(
            currentGameState.player.id,
            currentGameState.player.floor
          );
        }

        toast.success('Progresso salvo', {
          description: 'Seus dados foram salvos com sucesso.',
        });
      } catch (error) {
        console.error('[GameStore] Erro ao salvar progresso:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar progresso';
        gameStateStore.setError(errorMessage);
      } finally {
        gameStateStore.updateLoading('saveProgress', false);
      }
    },

    returnToMenu: () => {
      console.log('[GameStore] Retornando ao menu principal');
      const gameStateStore = useGameStateStore.getState();

      // Salvar progresso antes de voltar ao menu
      get().saveProgress();

      // Voltar ao estado de menu
      gameStateStore.updateGameState(draft => {
        draft.mode = 'menu';
        draft.gameMessage = 'Bem-vindo ao Tower Trials!';
        draft.currentEnemy = null;
        draft.currentFloor = null;
        draft.battleRewards = null;
      });
    },

    // === AÇÕES DE CONTROLE ===

    setProcessingAction: (processing: boolean) => {
      set(
        produce(draft => {
          draft.isProcessingAction = processing;
        })
      );
    },

    updateLastActionTimestamp: () => {
      set(
        produce(draft => {
          draft.lastActionTimestamp = Date.now();
        })
      );
    },

    // === CACHE MANAGEMENT ===

    setAvailableCharacters: (characters: Character[]) => {
      set(
        produce(draft => {
          draft.availableCharacters = characters;
        })
      );
    },

    refreshCharacterData: async (characterId: string) => {
      try {
        console.log('[GameStore] Atualizando dados do personagem:', characterId);
        const response = await CharacterService.getCharacter(characterId);

        if (response.success && response.data) {
          const gameStateStore = useGameStateStore.getState();

          // Atualizar dados do jogador atual se for o mesmo personagem
          if (gameStateStore.gameState.player?.id === characterId) {
            gameStateStore.updateGameState(draft => {
              Object.assign(draft.player!, response.data!);
            });
          }

          // Atualizar cache de personagens disponíveis
          set(
            produce(draft => {
              const index = draft.availableCharacters.findIndex((c: Character) => c.id === characterId);
              if (index !== -1) {
                draft.availableCharacters[index] = response.data!;
              }
            })
          );
        }
      } catch (error) {
        console.error('[GameStore] Erro ao atualizar dados do personagem:', error);
      }
    },
  }))
);

// === SELETORES UTILITÁRIOS ===

export const useGameSession = () =>
  useGameStore(state => ({
    sessionId: state.sessionId,
    isInitialized: state.isInitialized,
    isProcessingAction: state.isProcessingAction,
  }));

export const useGameActions = () =>
  useGameStore(state => ({
    startGame: state.startGame,
    loadCharacterForHub: state.loadCharacterForHub,
    performAction: state.performAction,
    saveProgress: state.saveProgress,
    returnToMenu: state.returnToMenu,
  }));

export const useAvailableCharacters = () => useGameStore(state => state.availableCharacters);

// === HOOK INTEGRADO PARA INICIALIZAÇÃO ===

/**
 * Hook que inicializa automaticamente o sistema de jogo
 */
export function useGameInitialization() {
  const gameStore = useGameStore();

  useEffect(() => {
    if (!gameStore.isInitialized) {
      gameStore.initializeGame();
    }

    // Cleanup ao desmontar
    return () => {
      // Opcional: limpar estado ao desmontar
      // gameStore.clearGame();
    };
  }, [gameStore.isInitialized, gameStore.initializeGame]);

  return {
    isInitialized: gameStore.isInitialized,
    sessionId: gameStore.sessionId,
  };
}
