export type EquipmentType = 'weapon' | 'armor' | 'accessory';
export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Equipment {
  id: string;
  name: string;
  description: string;
  type: EquipmentType;
  rarity: EquipmentRarity;
  level_requirement: number;
  atk_bonus: number;
  def_bonus: number;
  mana_bonus: number;
  speed_bonus: number;
  price: number;
  is_unlocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterEquipment {
  id: string;
  character_id: string;
  equipment_id: string;
  is_equipped: boolean;
  equipment?: Equipment; // Para quando carregarmos com join
  created_at: string;
  updated_at: string;
}

// Constantes para bônus de raridade
export const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2.0,
  legendary: 3.0
} as const;

// Interface para os slots de equipamento do personagem
export interface EquipmentSlots {
  weapon: Equipment | null;
  armor: Equipment | null;
  accessory: Equipment | null;
}

// Função para calcular bônus total dos equipamentos
export const calculateEquipmentBonus = (slots: EquipmentSlots) => {
  const totalBonus = {
    atk: 0,
    def: 0,
    speed: 0,
    mana: 0
  };

  // Função helper para adicionar bônus de um equipamento
  const addEquipmentBonus = (equipment: Equipment | null) => {
    if (equipment) {
      const multiplier = RARITY_MULTIPLIERS[equipment.rarity];
      totalBonus.atk += Math.floor(equipment.atk_bonus * multiplier);
      totalBonus.def += Math.floor(equipment.def_bonus * multiplier);
      totalBonus.mana += Math.floor(equipment.mana_bonus * multiplier);
      totalBonus.speed += Math.floor(equipment.speed_bonus * multiplier);
    }
  };

  // Adicionar bônus de cada slot
  addEquipmentBonus(slots.weapon);
  addEquipmentBonus(slots.armor);
  addEquipmentBonus(slots.accessory);

  return totalBonus;
}; 