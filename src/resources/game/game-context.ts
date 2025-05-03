import { createContext } from 'react';
import { ActionType, GameContextState, GameState, GamePlayer } from './game-model';
import { GAME_CONSTANTS } from './models/character.model';
import { ActiveEffects } from './models/spell.model';

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
  isPlayerTurn: true,
  gameMessage: '',
  highestFloor: 0,
  selectedSpell: null
};

// Estado inicial do contexto
export const initialContextState: GameContextState = {
  gameState: initialGameState,
  loading: {
    startGame: false,
    performAction: false,
    saveProgress: false,
    loadProgress: false
  },
  error: null,
  gameMessage: null
};

// Interface do contexto com todos os métodos disponíveis
export interface GameContextType extends GameContextState {
  startGame: (playerName: string) => void;
  performAction: (action: ActionType, spellId?: string) => void;
  returnToMenu: () => void;
  saveProgress: () => Promise<void>;
  resetError: () => void;
}

// Criar o contexto
export const GameContext = createContext<GameContextType>({
  ...initialContextState,
  startGame: () => {},
  performAction: () => {},
  returnToMenu: () => {},
  saveProgress: async () => {},
  resetError: () => {}
}); 