import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { useEffect } from 'react';
import { type ActionType } from '@/models/game.model';
import { useGameStateStore } from './useGameStateStore';
import { useLogStore } from './useLogStore';

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
      const logStore = useLogStore.getState();
      const initialGameState = gameStateStore.gameState;

      // ✅ CORREÇÃO: Usar o sistema de logs real ao invés de função simplificada
      const addGameLogMessage = (
        message: string,
        type:
          | 'system'
          | 'battle'
          | 'player_action'
          | 'enemy_action'
          | 'damage'
          | 'healing'
          | 'skill_xp'
          | 'level_up'
          | 'equipment'
          | 'lore'
      ) => {
        logStore.addGameLogMessage(message, type);
        console.log(`[GameLog-${type}] ${message}`);
      };

      try {
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

        // ✅ CORREÇÃO CRÍTICA: Adicionar mensagens do resultado ao log de jogo
        if (gameLogMessages?.length) {
          gameLogMessages.forEach(logMsg => {
            addGameLogMessage(
              logMsg.message,
              logMsg.type as
                | 'system'
                | 'battle'
                | 'player_action'
                | 'enemy_action'
                | 'damage'
                | 'healing'
                | 'skill_xp'
                | 'level_up'
                | 'equipment'
                | 'lore'
            );
          });
        }

        // ✅ CORREÇÃO CRÍTICA: Aplicar skill XP e registrar nos logs
        if (skillXpGains?.length && initialGameState.player?.id) {
          try {
            const { messages: skillMessages, skillLevelUps } = await import(
              '../services/skill-xp.service'
            ).then(m => m.SkillXpService.applySkillXp(initialGameState.player.id, skillXpGains));

            // ✅ REGISTRAR MENSAGENS DE SKILL XP NO LOG
            for (const skillMessage of skillMessages) {
              if (skillMessage.includes('subiu para nível')) {
                addGameLogMessage(skillMessage, 'level_up');
              } else {
                addGameLogMessage(skillMessage, 'skill_xp');
              }
            }

            // ✅ REGISTRAR LEVEL UPS DE SKILLS
            for (const levelUp of skillLevelUps) {
              const skillDisplayName = await import('../services/skill-xp.service').then(m =>
                m.SkillXpService.getSkillDisplayName(levelUp.skill)
              );
              addGameLogMessage(
                `🎉 ${skillDisplayName} subiu para nível ${levelUp.newLevel}!`,
                'level_up'
              );
            }
          } catch (skillError) {
            console.error('[BattleStore] Erro ao aplicar skill XP:', skillError);
            addGameLogMessage('Erro ao aplicar experiência de habilidade', 'system');
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

        // ✅ REGISTRAR AÇÃO PRINCIPAL NO LOG
        if (message && message.trim()) {
          const logType =
            action === 'attack'
              ? 'player_action'
              : action === 'defend'
                ? 'player_action'
                : action === 'spell'
                  ? 'player_action'
                  : 'system';
          addGameLogMessage(message, logType);
        }

        // Verificar condições especiais
        if (action === 'flee' && (newState.fleeSuccessful === true || newState.mode === 'fled')) {
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        if (skipTurn) {
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
          const defeatedState = await GameService.processEnemyDefeat();
          gameStateStore.setGameState(defeatedState);
          addGameLogMessage(`${newState.currentEnemy.name} foi derrotado!`, 'battle');
          get().endBattle();
          return;
        }

        // Verificar ações especiais que não geram turno do inimigo
        if (
          (action === 'continue' && newState.battleRewards === null && newState.currentEnemy) ||
          (action === 'interact_event' && newState.mode === 'battle' && newState.currentEnemy)
        ) {
          addGameLogMessage(message, 'system');
          get().endBattle();
          return;
        }

        // ✅ CORREÇÃO CRÍTICA: skipTurn = true significa PULAR o turno do inimigo (magias de suporte)
        // skipTurn = false significa PROCESSAR o turno do inimigo (ações ofensivas)
        if (!skipTurn && newState.currentEnemy && !newState.fleeSuccessful) {
          // Delay para feedback visual
          setTimeout(() => {
            get().processEnemyTurn(action, action === 'defend');
          }, 1000);
        } else {
          get().endBattle();
        }
      } catch (error) {
        console.error('[BattleStore] Erro no turno do jogador:', error);
        addGameLogMessage('Erro durante ação do jogador', 'system');
        throw error;
      }
    },

    processEnemyTurn: async (_playerAction: ActionType, playerDefended: boolean) => {
      // ✅ CORREÇÃO: Obter stores uma única vez
      const gameStateStore = useGameStateStore.getState();
      const logStore = useLogStore.getState();
      const initialGameState = gameStateStore.gameState;

      // ✅ CORREÇÃO: Usar o sistema de logs real
      const addGameLogMessage = (
        message: string,
        type:
          | 'system'
          | 'battle'
          | 'player_action'
          | 'enemy_action'
          | 'damage'
          | 'healing'
          | 'skill_xp'
          | 'level_up'
          | 'equipment'
          | 'lore'
      ) => {
        logStore.addGameLogMessage(message, type);
        console.log(`[GameLog-${type}] ${message}`);
      };

      try {
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

        // ✅ CORREÇÃO CRÍTICA: Aplicar skill XP do turno do inimigo (ex: defesa)
        if (enemySkillXpGains?.length && initialGameState.player?.id) {
          try {
            const { messages: skillMessages, skillLevelUps } = await import(
              '../services/skill-xp.service'
            ).then(m =>
              m.SkillXpService.applySkillXp(initialGameState.player.id, enemySkillXpGains)
            );

            // ✅ REGISTRAR MENSAGENS DE SKILL XP NO LOG
            for (const skillMessage of skillMessages) {
              if (skillMessage.includes('subiu para nível')) {
                addGameLogMessage(skillMessage, 'level_up');
              } else {
                addGameLogMessage(skillMessage, 'skill_xp');
              }
            }

            // ✅ REGISTRAR LEVEL UPS DE SKILLS
            for (const levelUp of skillLevelUps) {
              const skillDisplayName = await import('../services/skill-xp.service').then(m =>
                m.SkillXpService.getSkillDisplayName(levelUp.skill)
              );
              addGameLogMessage(
                `🎉 ${skillDisplayName} subiu para nível ${levelUp.newLevel}!`,
                'level_up'
              );
            }
          } catch (skillError) {
            console.error(
              '[BattleStore] Erro ao aplicar skill XP do turno do inimigo:',
              skillError
            );
          }
        }

        // Verificar se jogador morreu
        if (finalState.mode === 'gameover') {
          gameStateStore.setGameState(finalState);
          addGameLogMessage('Você foi derrotado!', 'battle');
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

        // ✅ REGISTRAR AÇÃO DO INIMIGO NO LOG
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
        addGameLogMessage('Erro durante turno do inimigo', 'system');
        get().endBattle();
      }
    },

    // === CONTROLE DE BATALHA ===

    startBattle: (battleId?: string) => {
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
