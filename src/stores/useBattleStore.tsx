import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { useEffect } from 'react';
import { type ActionType } from '@/models/game.model';
import { useGameStateStore } from './useGameStateStore';

import { GameService } from '../services/game.service';
import { CharacterService } from '../services/character.service';

interface BattleState {
  // Estados de controle de ação
  isProcessingAction: boolean;
  lastActionTimestamp: number;
  lastAction: string;

  // Estados de batalha
  currentTurnType: 'player' | 'enemy' | 'waiting' | null;
  battlePhase: 'idle' | 'player_action' | 'enemy_action' | 'processing' | 'ended';

  // Controle de sequência
  actionQueue: Array<{
    id: string;
    action: ActionType;
    spellId?: string;
    consumableId?: string;
    timestamp: number;
  }>;

  // Cache de dados de batalha
  currentBattleId: string | null;
  turnCount: number;

  // Estados para efeitos visuais (usado pelos componentes)
  showPlayerActionFeedback: boolean;
  showEnemyActionFeedback: boolean;
  lastPlayerActionMessage: string;
  lastEnemyActionMessage: string;
}

interface BattleActions {
  // Controle principal de ações
  performAction: (action: ActionType, spellId?: string, consumableId?: string) => Promise<void>;

  // Controle de batalha
  startBattle: (battleId?: string) => void;
  endBattle: () => void;
  resetBattleState: () => void;

  // Controle de turnos
  setTurnType: (turnType: BattleState['currentTurnType']) => void;
  setBattlePhase: (phase: BattleState['battlePhase']) => void;
  incrementTurnCount: () => void;

  // Controle de feedback visual
  setPlayerActionFeedback: (show: boolean, message?: string) => void;
  setEnemyActionFeedback: (show: boolean, message?: string) => void;

  // Controle interno
  setProcessingAction: (processing: boolean) => void;
  updateLastAction: (action: string, timestamp: number) => void;
  clearActionQueue: () => void;

  // Ações específicas de batalha
  processPlayerTurn: (action: ActionType, spellId?: string, consumableId?: string) => Promise<void>;
  processEnemyTurn: (playerAction: ActionType, playerDefended: boolean) => Promise<void>;
}

type BattleStore = BattleState & BattleActions;

export const useBattleStore = create<BattleStore>()(
  subscribeWithSelector((set, get) => ({
    // === ESTADO INICIAL ===
    isProcessingAction: false,
    lastActionTimestamp: 0,
    lastAction: '',
    currentTurnType: null,
    battlePhase: 'idle',
    actionQueue: [],
    currentBattleId: null,
    turnCount: 0,
    showPlayerActionFeedback: false,
    showEnemyActionFeedback: false,
    lastPlayerActionMessage: '',
    lastEnemyActionMessage: '',

    // === CONTROLE PRINCIPAL DE AÇÕES ===

    performAction: async (action: ActionType, spellId?: string, consumableId?: string) => {
      const state = get();

      // ✅ CORREÇÃO: Obter referências dos stores apenas uma vez
      const gameStateStore = useGameStateStore.getState();
      const currentGameState = gameStateStore.gameState;

      // Validações rigorosas
      if (!currentGameState.player) {
        console.warn('[BattleStore] Ação bloqueada - sem personagem no gameState');
        return;
      }

      if (state.isProcessingAction) {
        console.warn('[BattleStore] Ação bloqueada - já processando ação:', state.lastAction);
        return;
      }

      if (currentGameState.mode === 'gameover') {
        console.warn('[BattleStore] Ação bloqueada - personagem morto');
        return;
      }

      // Controle de debounce
      const now = Date.now();
      const timeSinceLastAction = now - state.lastActionTimestamp;
      const isSameAction = state.lastAction === action;

      if (isSameAction && timeSinceLastAction < 2000) {
        console.warn(
          `[BattleStore] Ação bloqueada - mesma ação muito rápida (${timeSinceLastAction}ms)`
        );
        return;
      }

      if (timeSinceLastAction < 500) {
        console.warn(`[BattleStore] Ação bloqueada - muito rápida (${timeSinceLastAction}ms)`);
        return;
      }

      console.log(`[BattleStore] === PROCESSANDO AÇÃO: ${action} ===`);

      // Marcar como processando e atualizar timestamps
      set(
        produce(draft => {
          draft.isProcessingAction = true;
          draft.lastActionTimestamp = now;
          draft.lastAction = action;
          draft.battlePhase = 'processing';
        })
      );

      gameStateStore.updateLoading('performAction', true);

      try {
        // Processar turno do jogador
        await get().processPlayerTurn(action, spellId, consumableId);
      } catch (error) {
        console.error('[BattleStore] Erro ao processar ação:', error);
        get().resetBattleState();
      }
    },

    // === PROCESSAMENTO DE TURNOS ===

    processPlayerTurn: async (action: ActionType, spellId?: string, consumableId?: string) => {
      // ✅ CORREÇÃO: Obter stores uma única vez
      const gameStateStore = useGameStateStore.getState();
      const initialGameState = gameStateStore.gameState;

      // Criar função de log simplificada para evitar dependências circulares
      const addGameLogMessage = (message: string, type: string) => {
        console.log(`[GameLog-${type}] ${message}`);
        // TODO: Integrar com store de log quando disponível
      };

      try {
        console.log('[BattleStore] Processando turno do jogador:', action);

        set(
          produce(draft => {
            draft.currentTurnType = 'player';
            draft.battlePhase = 'player_action';
          })
        );

        // Processar ação no GameService
        const playerResult = await GameService.processPlayerAction(
          action,
          initialGameState,
          spellId,
          consumableId
        );

        const { newState, skipTurn, message, skillXpGains, gameLogMessages } = playerResult;

        // Adicionar mensagens ao log
        if (gameLogMessages?.length) {
          gameLogMessages.forEach(logMsg => {
            addGameLogMessage(logMsg.message, logMsg.type);
          });
        }

        // ✅ CORREÇÃO: Aplicar skill XP usando player do gameState
        if (skillXpGains?.length && initialGameState.player?.id) {
          for (const skillGain of skillXpGains) {
            await CharacterService.addSkillXp(
              initialGameState.player.id,
              skillGain.skill,
              skillGain.xp
            );
          }
        }

        // Atualizar estado do jogo
        gameStateStore.setGameState(newState);

        // Mostrar feedback visual do jogador
        set(
          produce(draft => {
            draft.showPlayerActionFeedback = true;
            draft.lastPlayerActionMessage = message;
          })
        );

        // Verificar condições especiais
        if (action === 'flee' && (newState.fleeSuccessful === true || newState.mode === 'fled')) {
          console.log('[BattleStore] === FUGA BEM-SUCEDIDA ===');
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        if (skipTurn) {
          console.log('[BattleStore] === TURNO PULADO ===');
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
          console.log('[BattleStore] === INIMIGO DERROTADO ===');
          const defeatedState = await GameService.processEnemyDefeat();
          gameStateStore.setGameState(defeatedState);
          addGameLogMessage(`${newState.currentEnemy.name} foi derrotado!`, 'system');
          get().endBattle();
          return;
        }

        // Verificar ações especiais que não geram turno do inimigo
        if (
          (action === 'continue' && newState.battleRewards === null && newState.currentEnemy) ||
          (action === 'interact_event' && newState.mode === 'battle' && newState.currentEnemy)
        ) {
          console.log('[BattleStore] === AÇÃO ESPECIAL PROCESSADA ===');
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        // ✅ CORREÇÃO CRÍTICA: skipTurn = true significa PULAR o turno do inimigo (magias de suporte)
        // skipTurn = false significa PROCESSAR o turno do inimigo (ações ofensivas)
        if (!skipTurn && newState.currentEnemy && !newState.fleeSuccessful) {
          console.log('[BattleStore] === PROCESSANDO TURNO DO INIMIGO (AÇÃO OFENSIVA) ===');
          addGameLogMessage(message, 'player_action');

          // Delay para feedback visual
          setTimeout(() => {
            get().processEnemyTurn(action, action === 'defend');
          }, 1000);
        } else {
          // ✅ CRÍTICO: Para magias de suporte (skipTurn = true), o turno permanece com o jogador
          console.log('[BattleStore] === AÇÃO DE SUPORTE - TURNO PERMANECE COM O JOGADOR ===', {
            action,
            skipTurn,
            allowCombos: skipTurn,
          });
          addGameLogMessage(message, 'player_action');
          get().endBattle();
        }
      } catch (error) {
        console.error('[BattleStore] Erro no turno do jogador:', error);
        throw error;
      }
    },

    processEnemyTurn: async (_playerAction: ActionType, playerDefended: boolean) => {
      // ✅ CORREÇÃO: Obter stores uma única vez
      const gameStateStore = useGameStateStore.getState();
      const initialGameState = gameStateStore.gameState;

      // Criar função de log simplificada para evitar dependências circulares
      const addGameLogMessage = (message: string, type: string) => {
        console.log(`[GameLog-${type}] ${message}`);
        // TODO: Integrar com store de log quando disponível
      };

      try {
        console.log('[BattleStore] === INICIANDO TURNO DO INIMIGO ===');

        set(
          produce(draft => {
            draft.currentTurnType = 'enemy';
            draft.battlePhase = 'enemy_action';
            draft.showPlayerActionFeedback = false; // Limpar feedback do jogador
          })
        );

        // Atualizar estado para mostrar que não é turno do jogador
        gameStateStore.updateGameState(draft => {
          draft.isPlayerTurn = false;
        });

        // Processar ação do inimigo com delay
        const enemyResult = await GameService.processEnemyActionWithDelay(
          initialGameState,
          playerDefended,
          1500
        );

        const { newState: finalState, skillXpGains: enemySkillXpGains } = enemyResult;

        // ✅ CORREÇÃO: Aplicar skill XP usando player do gameState
        if (enemySkillXpGains?.length && initialGameState.player?.id) {
          for (const skillGain of enemySkillXpGains) {
            await CharacterService.addSkillXp(
              initialGameState.player.id,
              skillGain.skill,
              skillGain.xp
            );
          }
        }

        // Verificar se jogador morreu
        if (finalState.mode === 'gameover') {
          gameStateStore.setGameState(finalState);
          get().endBattle();
          return;
        }

        // ✅ CORREÇÃO: Atualizar HP/Mana usando player do gameState
        if (initialGameState.player?.id) {
          await CharacterService.updateCharacterHpMana(
            initialGameState.player.id,
            finalState.player.hp,
            finalState.player.mana
          );
        }

        // Mostrar feedback do inimigo
        if (finalState.gameMessage?.trim()) {
          const messageType =
            finalState.gameMessage.includes('causou') && finalState.gameMessage.includes('dano')
              ? 'damage'
              : 'enemy_action';
          addGameLogMessage(finalState.gameMessage, messageType);

          set(
            produce(draft => {
              draft.showEnemyActionFeedback = true;
              draft.lastEnemyActionMessage = finalState.gameMessage;
            })
          );
        }

        // Estado final - retorna turno ao jogador
        gameStateStore.setGameState({
          ...finalState,
          isPlayerTurn: true,
        });

        // Incrementar contador de turnos
        set(
          produce(draft => {
            draft.turnCount += 1;
          })
        );

        get().endBattle();
      } catch (error) {
        console.error('[BattleStore] Erro no turno do inimigo:', error);
        get().endBattle();
      }
    },

    // === CONTROLE DE BATALHA ===

    startBattle: (battleId?: string) => {
      console.log('[BattleStore] Iniciando batalha:', battleId);
      set(
        produce(draft => {
          draft.currentBattleId = battleId || `battle-${Date.now()}`;
          draft.battlePhase = 'idle';
          draft.currentTurnType = 'player';
          draft.turnCount = 0;
          draft.isProcessingAction = false;
          draft.actionQueue = [];
          draft.showPlayerActionFeedback = false;
          draft.showEnemyActionFeedback = false;
        })
      );
    },

    endBattle: () => {
      console.log('[BattleStore] Finalizando batalha');
      const gameStateStore = useGameStateStore.getState();

      set(
        produce(draft => {
          draft.isProcessingAction = false;
          draft.battlePhase = 'ended';
          draft.currentTurnType = null;
          draft.showPlayerActionFeedback = false;
          draft.showEnemyActionFeedback = false;
        })
      );

      gameStateStore.updateLoading('performAction', false);

      // Limpar feedback após um tempo
      setTimeout(() => {
        set(
          produce(draft => {
            draft.battlePhase = 'idle';
            draft.currentBattleId = null;
          })
        );
      }, 2000);
    },

    resetBattleState: () => {
      console.log('[BattleStore] Resetando estado de batalha');
      const gameStateStore = useGameStateStore.getState();

      set(
        produce(draft => {
          draft.isProcessingAction = false;
          draft.lastActionTimestamp = 0;
          draft.lastAction = '';
          draft.currentTurnType = null;
          draft.battlePhase = 'idle';
          draft.actionQueue = [];
          draft.currentBattleId = null;
          draft.turnCount = 0;
          draft.showPlayerActionFeedback = false;
          draft.showEnemyActionFeedback = false;
          draft.lastPlayerActionMessage = '';
          draft.lastEnemyActionMessage = '';
        })
      );

      gameStateStore.updateLoading('performAction', false);
    },

    // === AÇÕES DE CONTROLE ===

    setTurnType: turnType => {
      set(
        produce(draft => {
          draft.currentTurnType = turnType;
        })
      );
    },

    setBattlePhase: phase => {
      set(
        produce(draft => {
          draft.battlePhase = phase;
        })
      );
    },

    incrementTurnCount: () => {
      set(
        produce(draft => {
          draft.turnCount += 1;
        })
      );
    },

    setPlayerActionFeedback: (show, message = '') => {
      set(
        produce(draft => {
          draft.showPlayerActionFeedback = show;
          if (message) draft.lastPlayerActionMessage = message;
        })
      );
    },

    setEnemyActionFeedback: (show, message = '') => {
      set(
        produce(draft => {
          draft.showEnemyActionFeedback = show;
          if (message) draft.lastEnemyActionMessage = message;
        })
      );
    },

    setProcessingAction: processing => {
      set(
        produce(draft => {
          draft.isProcessingAction = processing;
        })
      );
    },

    updateLastAction: (action, timestamp) => {
      set(
        produce(draft => {
          draft.lastAction = action;
          draft.lastActionTimestamp = timestamp;
        })
      );
    },

    clearActionQueue: () => {
      set(
        produce(draft => {
          draft.actionQueue = [];
        })
      );
    },
  }))
);

// === SELETORES UTILITÁRIOS ===

export const useBattleState = () =>
  useBattleStore(state => ({
    isProcessingAction: state.isProcessingAction,
    currentTurnType: state.currentTurnType,
    battlePhase: state.battlePhase,
    turnCount: state.turnCount,
  }));

export const useBattleActions = () =>
  useBattleStore(state => ({
    performAction: state.performAction,
    startBattle: state.startBattle,
    endBattle: state.endBattle,
    resetBattleState: state.resetBattleState,
  }));

export const useBattleFeedback = () =>
  useBattleStore(state => ({
    showPlayerActionFeedback: state.showPlayerActionFeedback,
    showEnemyActionFeedback: state.showEnemyActionFeedback,
    lastPlayerActionMessage: state.lastPlayerActionMessage,
    lastEnemyActionMessage: state.lastEnemyActionMessage,
    setPlayerActionFeedback: state.setPlayerActionFeedback,
    setEnemyActionFeedback: state.setEnemyActionFeedback,
  }));

export const useBattleDebounce = () =>
  useBattleStore(state => ({
    lastActionTimestamp: state.lastActionTimestamp,
    lastAction: state.lastAction,
    isProcessingAction: state.isProcessingAction,
  }));

// === HOOK INTEGRADO PARA INICIALIZAÇÃO ===

/**
 * Hook que gerencia automaticamente o ciclo de vida da batalha
 * ✅ CORRIGIDO: Dependências estáveis para evitar loops infinitos
 */
export function useBattleManager() {
  // ✅ CORREÇÃO: Usar seletores específicos ao invés da store inteira
  const currentBattleId = useBattleStore(state => state.currentBattleId);
  const startBattle = useBattleStore(state => state.startBattle);
  const resetBattleState = useBattleStore(state => state.resetBattleState);

  // ✅ CORREÇÃO: Usar selector específico para evitar re-renders desnecessários
  const gameMode = useGameStateStore(state => state.gameState.mode);
  const hasEnemy = useGameStateStore(state => !!state.gameState.currentEnemy);

  // ✅ CORREÇÃO: Detectar início/fim de batalha com dependências mínimas
  useEffect(() => {
    if (gameMode === 'battle' && hasEnemy && !currentBattleId) {
      console.log('[BattleManager] Detectada nova batalha, inicializando...');
      startBattle();
    } else if (gameMode !== 'battle' && currentBattleId) {
      console.log('[BattleManager] Batalha finalizada, limpando estado...');
      resetBattleState();
    }
  }, [gameMode, hasEnemy, currentBattleId, startBattle, resetBattleState]); // ✅ CORREÇÃO: Dependências específicas

  return {
    isInBattle: gameMode === 'battle' && hasEnemy,
    currentBattleId,
  };
}
