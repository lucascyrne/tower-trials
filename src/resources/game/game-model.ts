import { Character } from './models/character.model';
import { MonsterBehavior } from './models/monster.model';
import { PlayerSpell, ActiveEffects } from './models/spell.model';

export type GameMode = 'menu' | 'battle' | 'gameover';
export type ActionType = 'attack' | 'defend' | 'special' | 'spell';
export type FloorType = 'common' | 'elite' | 'event' | 'boss';

export interface Floor {
  floorNumber: number;
  type: FloorType;
  isCheckpoint: boolean;
  minLevel: number;
  description: string;
}

export interface Enemy {
  id: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  image: string;
  behavior: MonsterBehavior;
  mana: number;
  reward_xp: number;
  reward_gold: number;
  active_effects: ActiveEffects;
}

export interface GamePlayer extends Character {
  isPlayerTurn: boolean;
  specialCooldown: number;
  floor: number;
  spells: PlayerSpell[];
  active_effects: ActiveEffects;
}

export interface GameState {
  mode: GameMode;
  player: GamePlayer;
  currentEnemy: Enemy | null;
  currentFloor: Floor | null;
  isPlayerTurn: boolean;
  gameMessage: string;
  highestFloor: number;
  selectedSpell: PlayerSpell | null;
}

export interface GameLoadingState {
  startGame: boolean;
  performAction: boolean;
  saveProgress: boolean;
  loadProgress: boolean;
}

export interface GameResponse {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface GameContextState {
  gameState: GameState;
  loading: GameLoadingState;
  error: string | null;
  gameMessage: string | null;
} 