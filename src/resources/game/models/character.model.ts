import { EquipmentSlots, calculateEquipmentBonus } from './equipment.model';

export interface Character {
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
  equipment_slots?: EquipmentSlots;
}

export interface CreateCharacterDTO {
  user_id: string;
  name: string;
}

export interface UpdateCharacterStatsDTO {
  hp?: number;
  max_hp?: number;
  mana?: number;
  max_mana?: number;
  atk?: number;
  def?: number;
  speed?: number;
  xp?: number;
  gold?: number;
}

// Constantes para cálculos de jogo
export const GAME_CONSTANTS = {
  BASE_XP_NEXT_LEVEL: 100,
  XP_MULTIPLIER: 1.5,
  BASE_STATS: {
    hp: 100,
    mana: 50,
    atk: 20,
    def: 10,
    speed: 10,
  },
  STATS_PER_LEVEL: {
    hp: 10,
    mana: 5,
    atk: 2,
    def: 1,
    speed: 1,
  },
} as const;

// Funções auxiliares para cálculos
export const calculateXPForNextLevel = (currentLevel: number): number => {
  return Math.floor(GAME_CONSTANTS.BASE_XP_NEXT_LEVEL * Math.pow(GAME_CONSTANTS.XP_MULTIPLIER, currentLevel - 1));
};

export const calculateBaseStats = (level: number, equipmentSlots?: EquipmentSlots) => {
  const baseStats = {
    hp: GAME_CONSTANTS.BASE_STATS.hp + GAME_CONSTANTS.STATS_PER_LEVEL.hp * (level - 1),
    mana: GAME_CONSTANTS.BASE_STATS.mana + GAME_CONSTANTS.STATS_PER_LEVEL.mana * (level - 1),
    atk: GAME_CONSTANTS.BASE_STATS.atk + GAME_CONSTANTS.STATS_PER_LEVEL.atk * (level - 1),
    def: GAME_CONSTANTS.BASE_STATS.def + GAME_CONSTANTS.STATS_PER_LEVEL.def * (level - 1),
    speed: GAME_CONSTANTS.BASE_STATS.speed + GAME_CONSTANTS.STATS_PER_LEVEL.speed * (level - 1),
  };

  // Adicionar bônus de equipamento se disponível
  if (equipmentSlots) {
    const equipmentBonus = calculateEquipmentBonus(equipmentSlots);
    baseStats.atk += equipmentBonus.atk;
    baseStats.def += equipmentBonus.def;
    baseStats.mana += equipmentBonus.mana;
  }

  return baseStats;
}; 