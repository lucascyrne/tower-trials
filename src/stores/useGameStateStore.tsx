import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { type GameState, type GameLoadingState } from '../models/game.model';
import { toast } from 'sonner';

const initialGameState: GameState = {
  mode: 'menu',
  player: null!,
  currentEnemy: null,
  currentFloor: null,
  currentSpecialEvent: null,
  isPlayerTurn: true,
  gameMessage: '',
  highestFloor: 1,
  selectedSpell: null,
  battleRewards: null,
};

interface GameStateStoreState {
  gameState: GameState;
  loading: GameLoadingState;
  error: string | null;
}

interface GameStateStoreActions {
  // Ações do estado do jogo
  setGameState: (gameState: GameState) => void;
  updateGameState: (updater: (draft: GameState) => void) => void;
  resetGameState: () => void;

  // Ações de loading
  updateLoading: (key: keyof GameLoadingState, value: boolean) => void;
  setAllLoading: (loading: GameLoadingState) => void;

  // Ações de erro
  setError: (error: string | null) => void;
  resetError: () => void;

  // Ações específicas do jogo
  setGameMode: (mode: GameState['mode']) => void;
  setGameMessage: (message: string) => void;
  setPlayerTurn: (isPlayerTurn: boolean) => void;
  updatePlayerStats: (hp: number, mana: number) => void;
  updatePlayerGold: (gold: number) => void;
  updatePlayerFloor: (floor: number) => void;
}

type GameStateStore = GameStateStoreState & GameStateStoreActions;

export const useGameStateStore = create<GameStateStore>()(
  subscribeWithSelector(set => ({
    // === ESTADO INICIAL ===
    gameState: initialGameState,
    loading: {
      loadProgress: false,
      startGame: false,
      performAction: false,
      saveProgress: false,
    },
    error: null,

    // === AÇÕES DO ESTADO DO JOGO ===

    setGameState: (gameState: GameState) => {
      console.log('[GameStateStore] Atualizando estado completo do jogo');
      set(
        produce(draft => {
          draft.gameState = gameState;
        })
      );
    },

    updateGameState: (updater: (draft: GameState) => void) => {
      set(
        produce(draft => {
          updater(draft.gameState);
        })
      );
    },

    resetGameState: () => {
      console.log('[GameStateStore] Resetando estado do jogo');
      set(
        produce(draft => {
          draft.gameState = structuredClone(initialGameState);
          draft.error = null;
        })
      );
    },

    // === AÇÕES DE LOADING ===

    updateLoading: (key: keyof GameLoadingState, value: boolean) => {
      set(
        produce(draft => {
          draft.loading[key] = value;
        })
      );
    },

    setAllLoading: (loading: GameLoadingState) => {
      set(
        produce(draft => {
          draft.loading = loading;
        })
      );
    },

    // === AÇÕES DE ERRO ===

    setError: (error: string | null) => {
      set(
        produce(draft => {
          draft.error = error;
        })
      );

      // Side effect: mostrar toast de erro
      if (error) {
        toast.error('Erro', {
          description: error,
        });
      }
    },

    resetError: () => {
      set(
        produce(draft => {
          draft.error = null;
        })
      );
    },

    // === AÇÕES ESPECÍFICAS DO JOGO ===

    setGameMode: (mode: GameState['mode']) => {
      console.log('[GameStateStore] Mudando modo do jogo para:', mode);
      set(
        produce(draft => {
          draft.gameState.mode = mode;
        })
      );
    },

    setGameMessage: (message: string) => {
      set(
        produce(draft => {
          draft.gameState.gameMessage = message;
        })
      );
    },

    setPlayerTurn: (isPlayerTurn: boolean) => {
      set(
        produce(draft => {
          draft.gameState.isPlayerTurn = isPlayerTurn;
        })
      );
    },

    updatePlayerStats: (hp: number, mana: number) => {
      set(
        produce(draft => {
          if (draft.gameState.player) {
            draft.gameState.player.hp = Math.max(0, hp);
            draft.gameState.player.mana = Math.max(0, mana);
          }
        })
      );
    },

    updatePlayerGold: (gold: number) => {
      set(
        produce(draft => {
          if (draft.gameState.player) {
            draft.gameState.player.gold = Math.max(0, gold);
          }
        })
      );
    },

    updatePlayerFloor: (floor: number) => {
      set(
        produce(draft => {
          if (draft.gameState.player) {
            draft.gameState.player.floor = floor;
            draft.gameState.highestFloor = Math.max(draft.gameState.highestFloor, floor);
          }
        })
      );
    },
  }))
);

// === SELETORES UTILITÁRIOS ===

export const useGameState = () => useGameStateStore(state => state.gameState);
export const useGameLoading = () => useGameStateStore(state => state.loading);
export const useGameError = () => useGameStateStore(state => state.error);

export const useGamePlayer = () => useGameStateStore(state => state.gameState.player);
export const useGameMode = () => useGameStateStore(state => state.gameState.mode);
export const useGameMessage = () => useGameStateStore(state => state.gameState.gameMessage);

// Seletores para batalha
export const useBattleState = () =>
  useGameStateStore(state => ({
    currentEnemy: state.gameState.currentEnemy,
    isPlayerTurn: state.gameState.isPlayerTurn,
    battleRewards: state.gameState.battleRewards,
    currentFloor: state.gameState.currentFloor,
  }));

// Seletor para estado completo de loading
export const useLoadingState = (key?: keyof GameLoadingState) =>
  useGameStateStore(state => (key ? state.loading[key] : state.loading));
