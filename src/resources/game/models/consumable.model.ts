export type ConsumableType = 'potion' | 'elixir' | 'antidote' | 'buff';

export interface Consumable {
  id: string;
  name: string;
  description: string;
  type: ConsumableType;
  effect_value: number;
  price: number;
  level_requirement: number;
  is_unlocked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterConsumable {
  id: string;
  character_id: string;
  consumable_id: string;
  quantity: number;
  consumable?: Consumable; // Para quando carregarmos com join
  created_at: string;
  updated_at: string;
}

// Tipos de efeitos de consumíveis
export const CONSUMABLE_EFFECTS = {
  HEALTH_POTION: {
    name: 'Poção de Vida',
    description: 'Recupera uma quantidade de HP',
    type: 'potion' as ConsumableType,
    effect: 'restore_hp'
  },
  MANA_POTION: {
    name: 'Poção de Mana',
    description: 'Recupera uma quantidade de Mana',
    type: 'potion' as ConsumableType,
    effect: 'restore_mana'
  },
  ANTIDOTE: {
    name: 'Antídoto',
    description: 'Remove efeitos negativos',
    type: 'antidote' as ConsumableType,
    effect: 'remove_debuff'
  },
  STRENGTH_ELIXIR: {
    name: 'Elixir de Força',
    description: 'Aumenta o ataque temporariamente',
    type: 'buff' as ConsumableType,
    effect: 'buff_attack'
  },
  DEFENSE_ELIXIR: {
    name: 'Elixir de Defesa',
    description: 'Aumenta a defesa temporariamente',
    type: 'buff' as ConsumableType,
    effect: 'buff_defense'
  }
} as const;

// Interface para ingredientes de crafting
export interface CraftingIngredient {
  item_id: string;
  item_type: 'monster_drop' | 'consumable' | 'equipment';
  quantity: number;
}

// Interface para receitas de crafting
export interface CraftingRecipe {
  id: string;
  result_id: string;
  name: string;
  description: string;
  ingredients: CraftingIngredient[];
}

// Interface para drops de monstros
export interface MonsterDrop {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  value: number; // valor de venda
} 