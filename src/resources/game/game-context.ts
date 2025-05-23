import { createContext } from 'react';
import { ActionType, GameState, GamePlayer } from './game-model';
import { GAME_CONSTANTS } from './models/character.model';
import { ActiveEffects } from './models/spell.model';
import { Character } from './models/character.model';

const initialActiveEffects: ActiveEffects = {
  buffs: [],
  debuffs: [],
  dots: [],
  hots: []
};

// Valores padrão para o jogador
export const defaultPlayer: GamePlayer = {
  id: '',
  user_id: '',
  name: '',
  level: 1,
  xp: 0,
  xp_next_level: GAME_CONSTANTS.BASE_XP_NEXT_LEVEL,
  gold: 0,
  hp: GAME_CONSTANTS.BASE_STATS.hp,
  max_hp: GAME_CONSTANTS.BASE_STATS.hp,
  mana: GAME_CONSTANTS.BASE_STATS.mana,
  max_mana: GAME_CONSTANTS.BASE_STATS.mana,
  atk: GAME_CONSTANTS.BASE_STATS.atk,
  def: GAME_CONSTANTS.BASE_STATS.def,
  speed: GAME_CONSTANTS.BASE_STATS.speed,
  created_at: '',
  updated_at: '',
  isPlayerTurn: true,
  specialCooldown: 0,
  defenseCooldown: 0,
  isDefending: false,
  floor: 0,
  spells: [],
  active_effects: initialActiveEffects
};

// Estado inicial do jogo
export const initialGameState: GameState = {
  mode: 'menu',
  player: defaultPlayer,
  currentEnemy: null,
  currentFloor: null,
  currentSpecialEvent: null,
  isPlayerTurn: true,
  gameMessage: '',
  highestFloor: 0,
  selectedSpell: null,
  battleRewards: null
};

// Tipo do contexto do jogo
export interface GameContextType {
  gameState: GameState;
  loading: {
    loadProgress: boolean;
    startGame: boolean;
    performAction: boolean;
    saveProgress: boolean;
  };
  error: string | null;
  gameMessage: string;
  gameLog: { text: string; type: 'system' | 'battle' | 'lore' | 'equipment' | 'skill_xp' | 'level_up' }[];
  characters: Character[];
  selectedCharacter: Character | null;
  startGame: (name: string) => Promise<void>;
  selectCharacter: (character: Character) => Promise<void>;
  loadCharacterForHub: (character: Character) => Promise<void>;
  clearGameState: () => void;
  performAction: (action: ActionType, spellId?: string, consumableId?: string) => void;
  returnToMenu: () => void;
  resetError: () => void;
  addGameLogMessage: (message: string, type?: 'system' | 'battle' | 'lore' | 'equipment' | 'skill_xp' | 'level_up') => void;
  saveProgress: () => Promise<void>;
}

// Criar o contexto
export const GameContext = createContext<GameContextType>({
  gameState: initialGameState,
  loading: {
    loadProgress: false,
    startGame: false,
    performAction: false,
    saveProgress: false,
  },
  error: null,
  gameMessage: '',
  gameLog: [],
  characters: [],
  selectedCharacter: null,
  startGame: async () => {},
  selectCharacter: async () => {},
  loadCharacterForHub: async () => {},
  clearGameState: () => {},
  performAction: () => {},
  returnToMenu: () => {},
  resetError: () => {},
  addGameLogMessage: () => {},
  saveProgress: async () => {}
}); 