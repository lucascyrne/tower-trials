import { type MonsterBehavior } from './monster.model';
import { type PlayerSpell, type ActiveEffects } from './spell.model';
import { type MonsterDropChance } from './monster.model';
import { type CharacterConsumable } from './consumable.model';
import { type BattleSession, type TurnControl } from './game-battle.model';

export type GameMode = 'menu' | 'battle' | 'gameover' | 'hub' | 'fled';
export type ActionType =
  | 'attack'
  | 'defend'
  | 'special'
  | 'spell'
  | 'flee'
  | 'consumable'
  | 'continue';
export type FloorType = 'common' | 'elite' | 'boss';

export interface Floor {
  floorNumber: number;
  type: FloorType;
  isCheckpoint: boolean;
  minLevel: number;
  description: string;
}

export interface Enemy {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  image?: string; // Opcional - assets gerenciados pelo frontend
  behavior: MonsterBehavior;
  mana: number;
  reward_xp: number;
  reward_gold: number;
  possible_drops?: MonsterDropChance[];
  active_effects: ActiveEffects;

  // Campos do sistema cíclico
  tier?: number;
  base_tier?: number;
  cycle_position?: number;
  is_boss?: boolean;

  // Atributos primários
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  wisdom?: number;
  vitality?: number;
  luck?: number;

  // Propriedades de combate avançadas
  critical_chance?: number;
  critical_damage?: number;
  critical_resistance?: number;

  // Resistências
  physical_resistance?: number;
  magical_resistance?: number;
  debuff_resistance?: number;

  // Vulnerabilidades
  physical_vulnerability?: number;
  magical_vulnerability?: number;

  // Características especiais
  primary_trait?: string;
  secondary_trait?: string;
  special_abilities?: string[];
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
  magic_attack?: number;
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
  potionUsedThisTurn?: boolean;

  // Atributos primários
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  wisdom?: number;
  vitality?: number;
  luck?: number;
  attribute_points?: number;

  // Habilidades específicas
  sword_mastery?: number;
  axe_mastery?: number;
  blunt_mastery?: number;
  defense_mastery?: number;
  magic_mastery?: number;

  // XP das habilidades
  sword_mastery_xp?: number;
  axe_mastery_xp?: number;
  blunt_mastery_xp?: number;
  defense_mastery_xp?: number;
  magic_mastery_xp?: number;

  // Stats derivados (calculados)
  critical_chance?: number;
  critical_damage?: number;
  magic_damage_bonus?: number;
  double_attack_chance?: number;

  // Stats base (sem equipamentos) para exibição de bônus
  base_hp?: number;
  base_max_hp?: number;
  base_mana?: number;
  base_max_mana?: number;
  base_atk?: number;
  base_def?: number;
  base_speed?: number;

  // Bônus de equipamentos para exibição
  equipment_hp_bonus?: number;
  equipment_mana_bonus?: number;
  equipment_atk_bonus?: number;
  equipment_def_bonus?: number;
  equipment_speed_bonus?: number;
}

export interface GameState {
  mode: GameMode;
  player: GamePlayer;
  currentEnemy: Enemy | null;
  currentFloor: Floor | null;
  currentSpecialEvent: null; // Removed as per edit hint
  isPlayerTurn: boolean;
  gameMessage: string;
  highestFloor: number;
  selectedSpell: PlayerSpell | null;
  battleRewards: BattleRewards | null;
  characterDeleted?: boolean;
  fleeSuccessful?: boolean;

  // NOVO: Sistema robusto de controle de turnos
  battleSession?: BattleSession;
  currentTurnControl?: TurnControl;
  actionLocks?: Map<string, boolean>;
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

export type GameLogType =
  | 'system'
  | 'battle'
  | 'lore'
  | 'skill_xp'
  | 'level_up'
  | 'equipment'
  | 'enemy_action'
  | 'player_action'
  | 'damage'
  | 'healing';

export interface GameLogEntry {
  text: string;
  type: GameLogType;
  metadata?: Record<string, unknown>;
}

export interface BattleEventDetails extends Record<string, unknown> {
  playerId?: string;
  playerName?: string;
  enemyId?: string;
  enemyName?: string;
  damage?: number;
  healing?: number;
  spellId?: string;
  spellName?: string;
  consumableId?: string;
  consumableName?: string;
  skillName?: string;
  xpGained?: number;
  levelBefore?: number;
  levelAfter?: number;
  floorNumber?: number;
  goldGained?: number;
  dropsObtained?: Array<{ name: string; quantity: number }>;
}

export interface GameContextState {
  gameState: GameState;
  loading: GameLoadingState;
  error: string | null;
  gameMessage: string | null;
  gameLog: GameLogEntry[];
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
