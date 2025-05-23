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
  main_hand: Equipment | null;
  off_hand: Equipment | null; // Para dual-wielding
  armor: Equipment | null;
  accessory: Equipment | null;
}

// Interface para compatibilidade com código legado
export interface LegacyEquipmentSlots {
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

  // Adicionar bônus de cada slot - atualizado para dual-wielding
  addEquipmentBonus(slots.main_hand);
  addEquipmentBonus(slots.off_hand);
  addEquipmentBonus(slots.armor);
  addEquipmentBonus(slots.accessory);

  // Bônus especial para dual-wielding (15% extra de ataque se ambas as mãos tiverem armas)
  if (slots.main_hand && slots.off_hand && 
      slots.main_hand.type === 'weapon' && slots.off_hand.type === 'weapon') {
    totalBonus.atk = Math.floor(totalBonus.atk * 1.15);
  }

  return totalBonus;
};

// Função para verificar se está em dual-wielding
export const isDualWielding = (slots: EquipmentSlots): boolean => {
  return !!(slots.main_hand && slots.off_hand && 
           slots.main_hand.type === 'weapon' && slots.off_hand.type === 'weapon');
};

// Função para obter arma principal
export const getMainWeapon = (slots: EquipmentSlots): Equipment | null => {
  return slots.main_hand && slots.main_hand.type === 'weapon' ? slots.main_hand : null;
};

// Função para obter escudo ou segunda arma
export const getOffHandItem = (slots: EquipmentSlots): Equipment | null => {
  return slots.off_hand;
};

// Função para verificar se tem escudo equipado
export const hasShield = (slots: EquipmentSlots): boolean => {
  return !!(slots.off_hand && slots.off_hand.type === 'armor');
}; 