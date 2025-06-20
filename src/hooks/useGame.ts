import { useGameStateStore } from '@/stores/useGameStateStore';
import { useEvent } from '@/hooks/useEvent';
import { useGameLog } from '@/stores/useLogStore';
import { useCharacterManagement } from '@/stores/useCharacterStore';
import type { CharacterConsumable } from '@/models/consumable.model';

export function useGame() {
  const gameState = useGameStateStore();
  const gameLog = useGameLog();
  const character = useCharacterManagement();
  const event = useEvent();

  return {
    // GameState provider
    gameState: gameState.gameState,
    loading: gameState.loading,
    error: gameState.error,
    setGameState: gameState.setGameState,
    updateLoading: gameState.updateLoading,
    setError: gameState.setError,
    resetError: gameState.resetError,

    // GameLog provider
    gameMessage: gameLog.gameMessage,
    gameLog: gameLog.gameLog,
    addGameLogMessage: gameLog.addGameLogMessage,
    setGameMessage: gameLog.setGameMessage,

    // Character provider
    characters: character.characters,
    selectedCharacter: character.selectedCharacter,
    createCharacter: character.createCharacter,
    selectCharacter: character.selectCharacter,
    reloadCharacters: character.reloadCharacters,

    // Event provider
    interactWithEvent: event.interactWithEvent,

    // Legacy methods for compatibility
    startGame: character.createCharacter,
    clearGameState: () => {
      // Reset game state to initial
      gameState.setGameState({
        mode: 'menu',
        player: {
          id: '',
          user_id: '',
          name: '',
          level: 1,
          xp: 0,
          xp_next_level: 150,
          gold: 0,
          hp: 50,
          max_hp: 50,
          mana: 20,
          max_mana: 20,
          atk: 10,
          def: 5,
          speed: 10,
          created_at: '',
          updated_at: '',
          isPlayerTurn: true,
          specialCooldown: 0,
          defenseCooldown: 0,
          isDefending: false,
          floor: 1,
          spells: [],
          consumables: [],
          potionUsedThisTurn: false,
          active_effects: {
            buffs: [],
            debuffs: [],
            dots: [],
            hots: [],
            attribute_modifications: [],
          },
          strength: 10,
          dexterity: 10,
          intelligence: 10,
          wisdom: 10,
          vitality: 10,
          luck: 10,
          critical_chance: 0,
          critical_damage: 110,
          double_attack_chance: 0,
          magic_attack: 0,
          magic_mastery: 1,
          magic_damage_bonus: 0,
        },
        currentEnemy: null,
        currentFloor: null,
        currentSpecialEvent: null,
        isPlayerTurn: true,
        gameMessage: '',
        highestFloor: 1,
        selectedSpell: null,
        battleRewards: null,
        fleeSuccessful: false,
        characterDeleted: false,
      });
    },
    returnToMenu: () => {
      gameState.setGameState({
        ...gameState.gameState,
        mode: 'menu',
      });
    },
    saveProgress: async () => {
      // TODO: Implement save progress if needed
    },
    updatePlayerConsumables: (consumables: CharacterConsumable[]) => {
      gameState.setGameState({
        ...gameState.gameState,
        player: {
          ...gameState.gameState.player,
          consumables,
        },
      });
    },
  };
}

export { useGameState } from '@/stores/useGameStateStore';
export { useGameLog } from '@/stores/useLogStore';
export { useCharacterManagement } from '@/stores/useCharacterStore';
export { useEvent } from '@/hooks/useEvent';
