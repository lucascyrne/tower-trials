export type MonsterBehavior = 'aggressive' | 'defensive' | 'balanced';

export interface Monster {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  mana: number;
  speed: number;
  behavior: MonsterBehavior;
  min_floor: number;
  reward_xp: number;
  reward_gold: number;
  possible_drops?: MonsterDropChance[]; // Lista de possíveis drops
}

// Interface para chances de drop
export interface MonsterDropChance {
  drop_id: string;
  drop_chance: number; // 0-1 (0-100%)
  min_quantity: number;
  max_quantity: number;
}

// Constantes para comportamentos dos monstros
export const MONSTER_BEHAVIOR = {
  AGGRESSIVE: {
    attack_multiplier: 1.2,
    defense_multiplier: 0.8,
    description: 'Prioriza ataques fortes, mas tem defesa reduzida'
  },
  DEFENSIVE: {
    attack_multiplier: 0.8,
    defense_multiplier: 1.2,
    description: 'Prioriza defesa, mas tem ataque reduzido'
  },
  BALANCED: {
    attack_multiplier: 1.0,
    defense_multiplier: 1.0,
    description: 'Mantém um equilíbrio entre ataque e defesa'
  }
} as const; 