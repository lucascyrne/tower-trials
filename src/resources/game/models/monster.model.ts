export type MonsterBehavior = 'aggressive' | 'defensive' | 'balanced';

export interface Monster {
  id: string;
  name: string;
  level?: number;
  hp: number;
  atk: number;
  def: number;
  mana: number;
  speed: number;
  behavior: MonsterBehavior;
  min_floor: number;
  reward_xp: number;
  reward_gold: number;
  image?: string;
  possible_drops?: MonsterDropChance[];
  
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