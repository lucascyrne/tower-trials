export type EquipmentType =
  | 'weapon'
  | 'armor'
  | 'chest'
  | 'helmet'
  | 'legs'
  | 'boots'
  | 'ring'
  | 'necklace'
  | 'amulet';
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

export type EquipmentFilter = 'all' | 'weapon' | 'armor' | 'accessory';
export type WeaponSubtypeFilter = 'all' | 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger';
export type RarityFilter = 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

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

// ✅ ATUALIZADO: Slots expandidos para incluir novos tipos de armadura e acessórios
export type EquipmentSlotType =
  | 'main_hand'
  | 'off_hand'
  | 'armor'
  | 'chest'
  | 'helmet'
  | 'legs'
  | 'boots'
  | 'ring_1'
  | 'ring_2'
  | 'necklace'
  | 'amulet';

export interface EquipmentSlots {
  main_hand?: Equipment;
  off_hand?: Equipment;
  armor?: Equipment; // Mantido para compatibilidade com escudos
  chest?: Equipment;
  helmet?: Equipment;
  legs?: Equipment;
  boots?: Equipment;
  ring_1?: Equipment;
  ring_2?: Equipment;
  necklace?: Equipment;
  amulet?: Equipment;
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
  legendary: 3.0,
} as const;

// Interface para compatibilidade com código legado
export interface LegacyEquipmentSlots {
  weapon: Equipment | null;
  armor: Equipment | null;
  accessory: Equipment | null;
}

// ✅ ATUALIZADO: Função para calcular bônus total dos equipamentos com novos slots
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
    magic_damage: 0,
  };

  // Função helper para adicionar bônus de um equipamento
  const addEquipmentBonus = (equipment: Equipment | null, isOffHand: boolean = false) => {
    if (equipment) {
      // Sistema de nerf para off-hand weapons (20% de redução)
      const offHandMultiplier = isOffHand && equipment.type === 'weapon' ? 0.8 : 1.0;

      totalBonus.atk += Math.floor((equipment.atk_bonus || 0) * offHandMultiplier);
      totalBonus.def += Math.floor((equipment.def_bonus || 0) * offHandMultiplier);
      totalBonus.mana += Math.floor((equipment.mana_bonus || 0) * offHandMultiplier);
      totalBonus.speed += Math.floor((equipment.speed_bonus || 0) * offHandMultiplier);
      totalBonus.hp += Math.floor((equipment.hp_bonus || 0) * offHandMultiplier);
      totalBonus.critical_chance += (equipment.critical_chance_bonus || 0) * offHandMultiplier;
      totalBonus.critical_damage += (equipment.critical_damage_bonus || 0) * offHandMultiplier;
      totalBonus.double_attack_chance +=
        (equipment.double_attack_chance_bonus || 0) * offHandMultiplier;
      totalBonus.magic_damage += (equipment.magic_damage_bonus || 0) * offHandMultiplier;
    }
  };

  // ✅ ATUALIZADO: Adicionar bônus de todos os slots incluindo novos tipos de armadura e acessórios
  addEquipmentBonus(slots.main_hand ?? null, false);
  addEquipmentBonus(slots.off_hand ?? null, true);
  addEquipmentBonus(slots.armor ?? null, false); // Escudos
  addEquipmentBonus(slots.chest ?? null, false);
  addEquipmentBonus(slots.helmet ?? null, false);
  addEquipmentBonus(slots.legs ?? null, false);
  addEquipmentBonus(slots.boots ?? null, false);
  addEquipmentBonus(slots.ring_1 ?? null, false);
  addEquipmentBonus(slots.ring_2 ?? null, false);
  addEquipmentBonus(slots.necklace ?? null, false);
  addEquipmentBonus(slots.amulet ?? null, false);

  // ✅ NOVO: Bônus especial para conjuntos de acessórios
  const accessoriesCount = getEquippedAccessoriesCount(slots);
  const armorPiecesCount = getEquippedArmorPiecesCount(slots);

  // ✅ NOVO: Bônus de conjunto para armadura completa (4 peças)
  if (armorPiecesCount >= 4) {
    totalBonus.def = Math.floor(totalBonus.def * 1.2); // +20% defesa
    totalBonus.hp = Math.floor(totalBonus.hp * 1.15); // +15% HP
    // Resistência crítica seria aplicada aqui se fosse implementada
  }
  // Bônus de conjunto para 3+ peças de armadura
  else if (armorPiecesCount >= 3) {
    totalBonus.def = Math.floor(totalBonus.def * 1.1); // +10% defesa
  }
  // Bônus de conjunto para 2 peças de armadura
  else if (armorPiecesCount >= 2) {
    totalBonus.hp = Math.floor(totalBonus.hp * 1.05); // +5% HP
  }

  // Bônus de conjunto para acessórios (2 anéis + colar + amuleto)
  if (accessoriesCount >= 4) {
    totalBonus.atk = Math.floor(totalBonus.atk * 1.1); // +10% ataque
    totalBonus.critical_chance = totalBonus.critical_chance * 1.15; // +15% chance crítica
  }
  // Bônus de conjunto para 3+ acessórios
  else if (accessoriesCount >= 3) {
    totalBonus.critical_chance = totalBonus.critical_chance * 1.1; // +10% chance crítica
    totalBonus.speed = Math.floor(totalBonus.speed * 1.05); // +5% velocidade
  }
  // Bônus de conjunto para 2 anéis
  else if (getEquippedRingsCount(slots) >= 2) {
    totalBonus.critical_damage = totalBonus.critical_damage * 1.05; // +5% dano crítico
  }

  // Bônus especial para dual-wielding (15% extra de ataque se ambas as mãos tiverem armas)
  if (
    slots.main_hand &&
    slots.off_hand &&
    slots.main_hand.type === 'weapon' &&
    slots.off_hand.type === 'weapon'
  ) {
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
    {
      name: 'Velocidade',
      current: currentEquipment?.speed_bonus || 0,
      new: newEquipment.speed_bonus,
    },
    { name: 'HP', current: currentEquipment?.hp_bonus || 0, new: newEquipment.hp_bonus },
    {
      name: 'Chance Crítica',
      current: currentEquipment?.critical_chance_bonus || 0,
      new: newEquipment.critical_chance_bonus,
    },
    {
      name: 'Dano Crítico',
      current: currentEquipment?.critical_damage_bonus || 0,
      new: newEquipment.critical_damage_bonus,
    },
    {
      name: 'Duplo Ataque',
      current: currentEquipment?.double_attack_chance_bonus || 0,
      new: newEquipment.double_attack_chance_bonus,
    },
    {
      name: 'Dano Mágico',
      current: currentEquipment?.magic_damage_bonus || 0,
      new: newEquipment.magic_damage_bonus,
    },
  ];

  stats.forEach(stat => {
    const difference = stat.new - stat.current;
    if (difference !== 0) {
      comparisons.push({
        stat_name: stat.name,
        current_value: stat.current,
        new_value: stat.new,
        difference,
        is_improvement: difference > 0,
      });
    }
  });

  return comparisons;
};

/**
 * ✅ NOVO: Verifica se o personagem tem um anel equipado em um slot específico
 */
export function hasRingInSlot(slots: EquipmentSlots, slotNumber: 1 | 2): boolean {
  const slotKey = `ring_${slotNumber}` as keyof EquipmentSlots;
  return !!(slots[slotKey]?.type === 'ring');
}

/**
 * ✅ NOVO: Verifica se o personagem tem colar equipado
 */
export function hasNecklace(slots: EquipmentSlots): boolean {
  return !!(slots.necklace?.type === 'necklace');
}

/**
 * ✅ NOVO: Verifica se o personagem tem amuleto equipado
 */
export function hasAmulet(slots: EquipmentSlots): boolean {
  return !!(slots.amulet?.type === 'amulet');
}

/**
 * ✅ NOVO: Conta quantos anéis estão equipados
 */
export function getEquippedRingsCount(slots: EquipmentSlots): number {
  let count = 0;
  if (hasRingInSlot(slots, 1)) count++;
  if (hasRingInSlot(slots, 2)) count++;
  return count;
}

/**
 * ✅ NOVO: Conta quantos acessórios estão equipados (anéis, colar, amuleto)
 */
export function getEquippedAccessoriesCount(slots: EquipmentSlots): number {
  return getEquippedRingsCount(slots) + (hasNecklace(slots) ? 1 : 0) + (hasAmulet(slots) ? 1 : 0);
}

/**
 * ✅ NOVO: Conta quantas peças de armadura estão equipadas (chest, helmet, legs, boots)
 */
export function getEquippedArmorPiecesCount(slots: EquipmentSlots): number {
  let count = 0;
  if (slots.chest?.type === 'chest') count++;
  if (slots.helmet?.type === 'helmet') count++;
  if (slots.legs?.type === 'legs') count++;
  if (slots.boots?.type === 'boots') count++;
  return count;
}

/**
 * ✅ NOVO: Verifica se tem set completo de armadura (4 peças)
 */
export function hasFullArmorSet(slots: EquipmentSlots): boolean {
  return getEquippedArmorPiecesCount(slots) >= 4;
}

/**
 * ✅ NOVO: Verifica se uma peça de armadura específica está equipada
 */
export function hasArmorPiece(
  slots: EquipmentSlots,
  type: 'chest' | 'helmet' | 'legs' | 'boots'
): boolean {
  return !!(slots[type]?.type === type);
}

/**
 * ✅ NOVO: Obtém o primeiro slot vazio para anéis
 */
export function getFirstEmptyRingSlot(slots: EquipmentSlots): 'ring_1' | 'ring_2' | null {
  if (!hasRingInSlot(slots, 1)) return 'ring_1';
  if (!hasRingInSlot(slots, 2)) return 'ring_2';
  return null;
}
