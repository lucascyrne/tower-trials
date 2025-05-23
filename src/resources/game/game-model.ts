import { MonsterBehavior } from './models/monster.model';
import { PlayerSpell, ActiveEffects } from './models/spell.model';
import { MonsterDropChance } from './models/monster.model';
import { CharacterConsumable } from './models/consumable.model';

export type GameMode = 'menu' | 'battle' | 'gameover' | 'hub' | 'special_event';
export type ActionType = 'attack' | 'defend' | 'special' | 'spell' | 'flee' | 'consumable' | 'continue' | 'interact_event';
export type FloorType = 'common' | 'elite' | 'event' | 'boss';
export type SpecialEventType = 'bonfire' | 'treasure_chest' | 'magic_fountain';

export interface Floor {
  floorNumber: number;
  type: FloorType;
  isCheckpoint: boolean;
  minLevel: number;
  description: string;
}

export interface SpecialEvent {
  id: string;
  name: string;
  type: SpecialEventType;
  description: string;
  hp_restore_percent: number;
  mana_restore_percent: number;
  gold_reward_min: number;
  gold_reward_max: number;
  chance_weight: number;
  min_floor: number;
}

export interface SpecialEventResult {
  success: boolean;
  message: string;
  hp_restored: number;
  mana_restored: number;
  gold_gained: number;
}

export interface Enemy {
  id: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  image: string;
  behavior: MonsterBehavior;
  mana: number;
  reward_xp: number;
  reward_gold: number;
  possible_drops?: MonsterDropChance[];
  active_effects: ActiveEffects;
}

export interface GamePlayer {
  id: string;
  user_id: string;
  name: string;
  level: number;
  xp: number;
  xp_next_level: number;
  gold: number;
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  created_at: string;
  updated_at: string;
  isPlayerTurn: boolean;
  specialCooldown: number;
  defenseCooldown: number;
  isDefending: boolean;
  floor: number;
  spells: PlayerSpell[];
  consumables?: CharacterConsumable[];
  active_effects: ActiveEffects;
}

export interface GameState {
  mode: GameMode;
  player: GamePlayer;
  currentEnemy: Enemy | null;
  currentFloor: Floor | null;
  currentSpecialEvent: SpecialEvent | null;
  isPlayerTurn: boolean;
  gameMessage: string;
  highestFloor: number;
  selectedSpell: PlayerSpell | null;
  battleRewards: BattleRewards | null;
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
  gameLog: { text: string; type: 'system' | 'battle' | 'lore' | 'skill_xp' | 'level_up' | 'equipment' }[];
}

export interface BattleActionResult {
  enemyDefeated?: boolean;
  rewards?: {
    xp: number;
    gold: number;
    drops: { name: string; quantity: number }[];
    leveledUp: boolean;
    newLevel?: number;
  };
} 

export interface BattleRewards {
  xp: number;
  gold: number;
  drops: { name: string; quantity: number }[];
  leveledUp: boolean;
  newLevel?: number;
}