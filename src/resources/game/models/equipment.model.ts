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
  hp_bonus: number;
  critical_chance_bonus: number;
  critical_damage_bonus: number;
  double_attack_chance_bonus: number;
  magic_damage_bonus: number;
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

/**
 * Verifica se o personagem está usando dual wielding (duas armas)
 */
export function isDualWielding(slots: EquipmentSlots): boolean {
  return !!(slots.main_hand?.type === 'weapon' && slots.off_hand?.type === 'weapon');
}

/**
 * Verifica se o personagem tem um escudo equipado
 */
export function hasShield(slots: EquipmentSlots): boolean {
  return !!(slots.off_hand?.type === 'armor' && !slots.off_hand?.weapon_subtype);
}

/**
 * Obtém a arma principal
 */
export function getMainWeapon(slots: EquipmentSlots): Equipment | undefined {
  return slots.main_hand?.type === 'weapon' ? slots.main_hand : undefined;
}

/**
 * Obtém a arma secundária (se houver dual wielding)
 */
export function getOffHandWeapon(slots: EquipmentSlots): Equipment | undefined {
  return slots.off_hand?.type === 'weapon' ? slots.off_hand : undefined;
}

/**
 * Verifica se há um staff na off-hand para bônus mágico
 */
export function hasOffHandStaff(slots: EquipmentSlots): boolean {
  return !!(slots.off_hand?.type === 'weapon' && slots.off_hand?.weapon_subtype === 'staff');
}

/**
 * Calcula eficiência da arma off-hand baseado no tipo
 * - Armas: 80% de eficiência
 * - Escudos: 100% de eficiência
 * - Staffs mágicos: 100% de eficiência para magia, 80% para físico
 */
export function getOffHandEfficiency(equipment: Equipment, forMagic: boolean = false): number {
  if (equipment.type === 'weapon') {
    if (equipment.weapon_subtype === 'staff' && forMagic) {
      return 1.0; // Staffs mantêm 100% para magia
    }
    return 0.8; // Armas físicas 80%
  }
  if (equipment.type === 'armor') {
    return 1.0; // Escudos 100%
  }
  return 1.0; // Fallback
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
    mana: 0,
    hp: 0,
    critical_chance: 0,
    critical_damage: 0,
    double_attack_chance: 0,
    magic_damage: 0
  };

  // Função helper para adicionar bônus de um equipamento
  const addEquipmentBonus = (equipment: Equipment | null) => {
    if (equipment) {
      totalBonus.atk += equipment.atk_bonus || 0;
      totalBonus.def += equipment.def_bonus || 0;
      totalBonus.mana += equipment.mana_bonus || 0;
      totalBonus.speed += equipment.speed_bonus || 0;
      totalBonus.hp += equipment.hp_bonus || 0;
      totalBonus.critical_chance += equipment.critical_chance_bonus || 0;
      totalBonus.critical_damage += equipment.critical_damage_bonus || 0;
      totalBonus.double_attack_chance += equipment.double_attack_chance_bonus || 0;
      totalBonus.magic_damage += equipment.magic_damage_bonus || 0;
    }
  };

  // Adicionar bônus de cada slot - atualizado para dual-wielding
  addEquipmentBonus(slots.main_hand ?? null);
  addEquipmentBonus(slots.off_hand ?? null);
  addEquipmentBonus(slots.armor ?? null);
  addEquipmentBonus(slots.accessory ?? null);
  addEquipmentBonus(slots.accessory_2 ?? null);

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

// Interface para comparação de equipamentos
export interface EquipmentComparison {
  stat_name: string;
  current_value: number;
  new_value: number;
  difference: number;
  is_improvement: boolean;
}

// Função para comparar dois equipamentos
export const compareEquipment = (
  currentEquipment: Equipment | null,
  newEquipment: Equipment
): EquipmentComparison[] => {
  const comparisons: EquipmentComparison[] = [];
  
  const stats = [
    { name: 'Ataque', current: currentEquipment?.atk_bonus || 0, new: newEquipment.atk_bonus },
    { name: 'Defesa', current: currentEquipment?.def_bonus || 0, new: newEquipment.def_bonus },
    { name: 'Mana', current: currentEquipment?.mana_bonus || 0, new: newEquipment.mana_bonus },
    { name: 'Velocidade', current: currentEquipment?.speed_bonus || 0, new: newEquipment.speed_bonus },
    { name: 'HP', current: currentEquipment?.hp_bonus || 0, new: newEquipment.hp_bonus },
    { name: 'Chance Crítica', current: currentEquipment?.critical_chance_bonus || 0, new: newEquipment.critical_chance_bonus },
    { name: 'Dano Crítico', current: currentEquipment?.critical_damage_bonus || 0, new: newEquipment.critical_damage_bonus },
    { name: 'Duplo Ataque', current: currentEquipment?.double_attack_chance_bonus || 0, new: newEquipment.double_attack_chance_bonus },
    { name: 'Dano Mágico', current: currentEquipment?.magic_damage_bonus || 0, new: newEquipment.magic_damage_bonus },
  ];
  
  stats.forEach(stat => {
    const difference = stat.new - stat.current;
    if (difference !== 0) {
      comparisons.push({
        stat_name: stat.name,
        current_value: stat.current,
        new_value: stat.new,
        difference,
        is_improvement: difference > 0
      });
    }
  });
  
  return comparisons;
}; 