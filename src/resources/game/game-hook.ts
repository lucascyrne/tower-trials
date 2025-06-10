import { useGameState } from './providers/game-state.provider';
import { useGameLog } from './providers/log.provider';
import { useCharacter } from './providers/character.provider';
import { useBattle } from './providers/battle.provider';
import { useEvent } from './providers/event.provider';

export function useGame() {
  const gameState = useGameState();
  const gameLog = useGameLog();
  const character = useCharacter();
  const battle = useBattle();
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
    loadCharacterForHub: character.loadCharacterForHub,
    updatePlayerStats: character.updatePlayerStats,
    reloadCharacters: character.reloadCharacters,
    
    // Battle provider
    performAction: battle.performAction,
    
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
            attribute_modifications: []
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
          magic_damage_bonus: 0
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
        characterDeleted: false
      });
    },
    returnToMenu: () => {
      gameState.setGameState({
        ...gameState.gameState,
        mode: 'menu'
      });
    },
    saveProgress: async () => {
      // TODO: Implement save progress if needed
    },
    updatePlayerConsumables: (consumables: import('./models/consumable.model').CharacterConsumable[]) => {
      gameState.setGameState({
        ...gameState.gameState,
        player: {
          ...gameState.gameState.player,
          consumables
        }
      });
    }
  };
}

export { useGameState } from './providers/game-state.provider';
export { useGameLog } from './providers/log.provider';
export { useCharacter } from './providers/character.provider';
export { useBattle } from './providers/battle.provider';
export { useEvent } from './providers/event.provider'; 