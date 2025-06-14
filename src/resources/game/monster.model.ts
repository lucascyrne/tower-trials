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

  // Novos campos para sistema cíclico
  tier?: number; // Representa o "elo" ou ciclo do monstro (1, 2, 3, etc.)
  base_tier?: number; // Tier original do monstro (para referência)
  cycle_position?: number; // Posição dentro do ciclo (1-20 por exemplo)
  is_boss?: boolean; // Se é um monstro boss

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
  // Incluir informações do drop para referência
  drop_info?: {
    id: string;
    name: string;
    description: string;
    rarity: string;
    value: number;
  };
}

// Constantes para o sistema cíclico
export const MONSTER_CYCLE_CONFIG = {
  FLOORS_PER_CYCLE: 20, // Quantos andares por ciclo
  BOSS_FLOORS: [5, 10, 15, 20], // Andares que sempre têm boss
  TIER_SCALING_FACTOR: 1.8, // Multiplicador de stats por tier
  BASE_LEVEL_PER_TIER: 20, // Níveis base adicionados por tier
} as const;

// Constantes para comportamentos dos monstros
export const MONSTER_BEHAVIOR = {
  AGGRESSIVE: {
    attack_multiplier: 1.2,
    defense_multiplier: 0.8,
    description: 'Prioriza ataques fortes, mas tem defesa reduzida',
  },
  DEFENSIVE: {
    attack_multiplier: 0.8,
    defense_multiplier: 1.2,
    description: 'Prioriza defesa, mas tem ataque reduzido',
  },
  BALANCED: {
    attack_multiplier: 1.0,
    defense_multiplier: 1.0,
    description: 'Mantém um equilíbrio entre ataque e defesa',
  },
} as const;
