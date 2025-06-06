export type EquipmentType = 'weapon' | 'armor' | 'accessory';
export type WeaponSubtype = 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger';
export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Equipment {
  id: string;
  name: string;
  description: string;
  type: EquipmentType;
  weapon_subtype?: WeaponSubtype;
  rarity: EquipmentRarity;
  level_requirement: number;
  atk_bonus: number;
  def_bonus: number;
  mana_bonus: number;
  speed_bonus: number;
  price: number;
  is_unlocked: boolean;
  craftable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterEquipment {
  id: string;
  character_id: string;
  equipment_id: string;
  is_equipped: boolean;
  slot_type?: string;
  equipment?: Equipment;
  created_at: string;
  updated_at: string;
}

// Interface para ingredientes de crafting de equipamentos
export interface EquipmentCraftingIngredient {
  item_id: string;
  item_type: 'monster_drop' | 'consumable' | 'equipment';
  quantity: number;
}

// Interface para receitas de crafting de equipamentos
export interface EquipmentCraftingRecipe {
  id: string;
  result_equipment_id: string;
  name: string;
  description: string;
  ingredients: EquipmentCraftingIngredient[];
  equipment?: Equipment;
}

// Definir slots para dual-wielding (já existia)
export type EquipmentSlotType = 'main_hand' | 'off_hand' | 'armor' | 'accessory' | 'accessory_2';

export interface EquipmentSlots {
  main_hand?: Equipment;
  off_hand?: Equipment;
  armor?: Equipment;
  accessory?: Equipment;
  accessory_2?: Equipment;
}

// Função para verificar se é dual wielding
export function isDualWielding(slots: EquipmentSlots): boolean {
  return !!(slots.main_hand?.type === 'weapon' && slots.off_hand?.type === 'weapon');
}

// Função para verificar se tem escudo
export function hasShield(slots: EquipmentSlots): boolean {
  return slots.off_hand?.name?.toLowerCase().includes('escudo') || false;
}

// Função para obter arma principal
export function getMainWeapon(slots: EquipmentSlots): Equipment | undefined {
  return slots.main_hand?.type === 'weapon' ? slots.main_hand : undefined;
}

// Função para obter arma secundária (se dual wielding)
export function getOffHandWeapon(slots: EquipmentSlots): Equipment | undefined {
  return isDualWielding(slots) ? slots.off_hand : undefined;
}

// Constantes para bônus de raridade
export const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2.0,
  legendary: 3.0
} as const;

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

// Função para obter arma principal
export const getMainWeaponLegacy = (slots: LegacyEquipmentSlots): Equipment | null => {
  return slots.weapon;
};

// Função para obter escudo ou segunda arma
export const getOffHandItemLegacy = (slots: LegacyEquipmentSlots): Equipment | null => {
  return slots.armor;
};

// Função para verificar se tem escudo equipado
export const hasShieldLegacy = (slots: LegacyEquipmentSlots): boolean => {
  return !!(slots.armor && slots.armor.type === 'armor');
}; 