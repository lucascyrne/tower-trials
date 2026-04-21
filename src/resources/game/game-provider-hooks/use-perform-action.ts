import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react';
import { ActionType, GameContextState, GameState } from '../game-model';
import { CharacterService } from '../character.service';
import { Character } from '../models/character.model';
import { advanceToNextFloor } from '../game-service/floor-and-enemy';
import { processEnemyActionWithDelay, processEnemyDefeat } from '../game-service/battle-enemy';
import { processPlayerAction } from '../game-service/battle-player';
import { processSpecialEventInteraction } from '../game-service/special-events';
import { clearAllCaches } from '../game-service/floor-and-enemy';

type LogType = 'system' | 'battle' | 'lore' | 'equipment' | 'skill_xp' | 'level_up' | 'enemy_action' | 'player_action' | 'damage' | 'healing';

interface LastActionRef {
  timestamp: number;
  action: string;
  processing: boolean;
}

interface UsePerformActionParams {
  state: GameContextState;
  selectedCharacter: Character | null;
  gameStateRef: MutableRefObject<GameState>;
  enemyTurnSeqRef: MutableRefObject<number>;
  lastActionRef: MutableRefObject<LastActionRef>;
  updateLoading: (key: 'loadProgress' | 'startGame' | 'performAction' | 'saveProgress', value: boolean) => void;
  addGameLogMessage: (message: string, type?: LogType) => void;
  setState: Dispatch<SetStateAction<GameContextState>>;
}

export function usePerformAction({
  state,
  selectedCharacter,
  gameStateRef,
  enemyTurnSeqRef,
  lastActionRef,
  updateLoading,
  addGameLogMessage,
  setState,
}: UsePerformActionParams) {
  return useCallback(
    (action: ActionType, spellId?: string, consumableId?: string) => {
      const now = Date.now();
      const timeSinceLastAction = now - lastActionRef.current.timestamp;
      const isSameAction = lastActionRef.current.action === action;

      if (!selectedCharacter || state.loading.performAction) return;
      if (gameStateRef.current.mode === 'gameover') return;
      if (lastActionRef.current.processing) return;
      if (isSameAction && timeSinceLastAction < 1000) return;
      if (timeSinceLastAction < 300) return;

      lastActionRef.current = { timestamp: now, action, processing: true };
      updateLoading('performAction', true);

      const cleanup = () => {
        lastActionRef.current.processing = false;
        updateLoading('performAction', false);
      };

      (async () => {
        try {
          if (action === 'continue') {
            if (!gameStateRef.current.battleRewards) {
              cleanup();
              return;
            }
            try {
              clearAllCaches();
              const newGameState = await advanceToNextFloor(gameStateRef.current);
              setState(prevState => ({
                ...prevState,
                gameState: { ...newGameState, battleRewards: null, isPlayerTurn: true },
              }));
              addGameLogMessage(`Avançou para o andar ${newGameState.player.floor}!`, 'system');
            } catch (error) {
              setState(prevState => ({
                ...prevState,
                gameState: {
                  ...prevState.gameState,
                  gameMessage: `Erro ao avançar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                },
              }));
            }
            cleanup();
            return;
          }

          if (action === 'interact_event') {
            if (gameStateRef.current.mode !== 'special_event') {
              cleanup();
              return;
            }
            try {
              const gsBefore = gameStateRef.current;
              const updatedState = await processSpecialEventInteraction(gsBefore);
              if (selectedCharacter && updatedState.player) {
                if (updatedState.player.hp !== gsBefore.player.hp || updatedState.player.mana !== gsBefore.player.mana) {
                  await CharacterService.updateCharacterHpMana(selectedCharacter.id, updatedState.player.hp, updatedState.player.mana);
                }
                const goldGained = updatedState.player.gold - gsBefore.player.gold;
                if (goldGained > 0) {
                  await CharacterService.grantSecureGold(selectedCharacter.id, goldGained, 'special_event');
                }
              }
              setState(prevState => ({
                ...prevState,
                gameState: { ...updatedState, mode: 'battle', currentSpecialEvent: null },
              }));
              addGameLogMessage(updatedState.gameMessage || 'Evento especial concluído!', 'system');
            } catch {
              // noop
            }
            cleanup();
            return;
          }

          if (gameStateRef.current.mode !== 'battle' || !gameStateRef.current.currentEnemy) {
            cleanup();
            return;
          }

          const playerResult = await processPlayerAction(action, gameStateRef.current, spellId, consumableId);
          const { newState, skipTurn, message, skillXpGains, gameLogMessages } = playerResult;

          if (gameLogMessages?.length) {
            gameLogMessages.forEach((logMsg: { message: string; type: LogType }) => addGameLogMessage(logMsg.message, logMsg.type));
          }

          if (skillXpGains?.length && selectedCharacter) {
            try {
              for (const skillGain of skillXpGains) {
                await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
              }
            } catch {
              // noop
            }
          }

          if (action === 'flee' && (newState.fleeSuccessful === true || newState.mode === 'fled')) {
            setState(prevState => ({
              ...prevState,
              gameState: {
                ...newState,
                mode: 'fled',
                fleeSuccessful: true,
                currentEnemy: null,
                battleRewards: null,
                isPlayerTurn: true,
              },
            }));
            addGameLogMessage(message, 'system');
            cleanup();
            return;
          }

          if (skipTurn) {
            setState(prevState => ({
              ...prevState,
              gameState: { ...newState, gameMessage: message },
            }));
            addGameLogMessage(message, 'system');
            cleanup();
            return;
          }

          if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
            const defeatedState = await processEnemyDefeat(newState);
            setState(prevState => ({ ...prevState, gameState: defeatedState }));
            addGameLogMessage(`${newState.currentEnemy.name} foi derrotado!`, 'system');
            cleanup();
            return;
          }

          if (newState.currentEnemy && !newState.fleeSuccessful) {
            setState(prevState => ({
              ...prevState,
              gameState: { ...newState, isPlayerTurn: false, gameMessage: message },
            }));
            addGameLogMessage(message, 'player_action');

            const scheduledTurn = ++enemyTurnSeqRef.current;
            setTimeout(async () => {
              if (scheduledTurn !== enemyTurnSeqRef.current) return;
              try {
                const enemyResult = await processEnemyActionWithDelay({ ...newState, isPlayerTurn: false }, action === 'defend', 1500);
                const { newState: finalState, skillXpGains: enemySkillXpGains } = enemyResult;

                if (enemySkillXpGains?.length && selectedCharacter) {
                  try {
                    for (const skillGain of enemySkillXpGains) {
                      await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
                    }
                  } catch {
                    // noop
                  }
                }

                if (finalState.mode === 'gameover') {
                  setState(prevState => ({ ...prevState, gameState: finalState }));
                  cleanup();
                  return;
                }

                if (selectedCharacter) {
                  await CharacterService.updateCharacterHpMana(selectedCharacter.id, finalState.player.hp, finalState.player.mana);
                }

                if (finalState.gameMessage?.trim()) {
                  const messageType =
                    finalState.gameMessage.includes('causou') && finalState.gameMessage.includes('dano') ? 'damage' : 'enemy_action';
                  addGameLogMessage(finalState.gameMessage, messageType);
                }

                setState(prevState => ({
                  ...prevState,
                  gameState: { ...finalState, isPlayerTurn: true },
                }));
                cleanup();
              } catch {
                cleanup();
              }
            }, 800);
          } else {
            setState(prevState => ({
              ...prevState,
              gameState: { ...newState, gameMessage: message },
            }));
            addGameLogMessage(message, 'player_action');
            cleanup();
          }
        } catch (error) {
          setState(prevState => ({
            ...prevState,
            gameState: {
              ...prevState.gameState,
              gameMessage: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            },
          }));
          cleanup();
        }
      })();
    },
    [
      addGameLogMessage,
      enemyTurnSeqRef,
      gameStateRef,
      lastActionRef,
      selectedCharacter,
      setState,
      state.loading.performAction,
      updateLoading,
    ],
  );
}
