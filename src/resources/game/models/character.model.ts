import { type EquipmentSlots } from './equipment.model';

// Constantes do jogo
export const GAME_CONSTANTS = {
  BASE_XP_NEXT_LEVEL: 100,
  BASE_STATS: {
    hp: 100,
    mana: 50,
    atk: 20,
    def: 10,
    speed: 10,
  },
  STAT_GROWTH_PER_LEVEL: {
    hp: 10,
    mana: 5,
    atk: 2,
    def: 1,
    speed: 1,
  },
  CHARACTER_SLOTS: {
    BASE_SLOTS: 3,
    LEVELS_PER_SLOT: 15, // Níveis totais necessários por slot adicional
  }
};

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
  floor: number;
  
  // Atributos primários
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
  attribute_points: number;
  
  // Habilidades específicas
  sword_mastery: number;
  axe_mastery: number;
  blunt_mastery: number;
  defense_mastery: number;
  magic_mastery: number;
  
  // XP das habilidades
  sword_mastery_xp: number;
  axe_mastery_xp: number;
  blunt_mastery_xp: number;
  defense_mastery_xp: number;
  magic_mastery_xp: number;
  
  // Stats derivados (calculados)
  critical_chance?: number;
  critical_damage?: number;
  
  // Status do personagem
  is_alive?: boolean;
  
  last_activity?: string;
  created_at: string;
  updated_at: string;
  equipment_slots?: EquipmentSlots;
}

export interface CreateCharacterDTO {
  user_id: string;
  name: string;
}

export interface CharacterProgressionInfo {
  total_character_level: number;
  max_character_slots: number;
  current_character_count: number;
  next_slot_required_level: number;
  progress_to_next_slot: number;
}

export interface CharacterLimitInfo {
  can_create: boolean;
  current_count: number;
  available_slots: number;
  total_level: number;
  next_slot_required_level: number;
}

export interface UpdateCharacterStatsResult {
  leveled_up: boolean;
  new_level: number;
  new_xp: number;
  new_xp_next_level: number;
  slots_unlocked?: boolean;
  new_available_slots?: number;
}

// Função para calcular stats base por nível
export function calculateBaseStats(level: number, equipmentSlots?: EquipmentSlots) {
  const baseStats = {
    hp: GAME_CONSTANTS.BASE_STATS.hp + (GAME_CONSTANTS.STAT_GROWTH_PER_LEVEL.hp * (level - 1)),
    mana: GAME_CONSTANTS.BASE_STATS.mana + (GAME_CONSTANTS.STAT_GROWTH_PER_LEVEL.mana * (level - 1)),
    atk: GAME_CONSTANTS.BASE_STATS.atk + (GAME_CONSTANTS.STAT_GROWTH_PER_LEVEL.atk * (level - 1)),
    def: GAME_CONSTANTS.BASE_STATS.def + (GAME_CONSTANTS.STAT_GROWTH_PER_LEVEL.def * (level - 1)),
    speed: GAME_CONSTANTS.BASE_STATS.speed + (GAME_CONSTANTS.STAT_GROWTH_PER_LEVEL.speed * (level - 1)),
  };

  // Adicionar bônus de equipamentos se fornecidos
  if (equipmentSlots) {
    const slots = [equipmentSlots.main_hand, equipmentSlots.off_hand, equipmentSlots.armor, equipmentSlots.accessory];
    slots.forEach(equipment => {
      if (equipment) {
        baseStats.mana += equipment.mana_bonus || 0;
        baseStats.atk += equipment.atk_bonus || 0;
        baseStats.def += equipment.def_bonus || 0;
        baseStats.speed += equipment.speed_bonus || 0;
      }
    });
  }

  return baseStats;
}

// Função para calcular o nível necessário para desbloquear um slot específico
export function calculateRequiredLevelForSlot(slotNumber: number): number {
  if (slotNumber <= GAME_CONSTANTS.CHARACTER_SLOTS.BASE_SLOTS) {
    return 0; // Slots 1-3 são gratuitos
  }
  return (slotNumber - GAME_CONSTANTS.CHARACTER_SLOTS.BASE_SLOTS) * GAME_CONSTANTS.CHARACTER_SLOTS.LEVELS_PER_SLOT;
}

// Função para calcular quantos slots um usuário pode ter baseado no nível total
export function calculateAvailableSlots(totalCharacterLevel: number): number {
  let slots = GAME_CONSTANTS.CHARACTER_SLOTS.BASE_SLOTS;
  let currentSlot = GAME_CONSTANTS.CHARACTER_SLOTS.BASE_SLOTS + 1;
  
  while (totalCharacterLevel >= calculateRequiredLevelForSlot(currentSlot)) {
    slots = currentSlot;
    currentSlot++;
    
    // Limite de segurança
    if (currentSlot > 20) break;
  }
  
  return slots;
}

// Enums para sistema de atributos
export enum AttributeType {
  STRENGTH = 'strength',
  DEXTERITY = 'dexterity',
  INTELLIGENCE = 'intelligence',
  WISDOM = 'wisdom',
  VITALITY = 'vitality',
  LUCK = 'luck'
}

export enum SkillType {
  SWORD_MASTERY = 'sword',
  AXE_MASTERY = 'axe',
  BLUNT_MASTERY = 'blunt',
  DEFENSE_MASTERY = 'defense',
  MAGIC_MASTERY = 'magic'
}

// Interface para distribuição de atributos
export interface AttributeDistribution {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
}

// Interface para stats completos do personagem
export interface CharacterStats {
  // Básicos
  level: number;
  xp: number;
  xp_next_level: number;
  gold: number;
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  magic_attack?: number;
  def: number;
  speed: number;
  
  // Atributos primários
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
  attribute_points: number;
  
  // Stats derivados
  critical_chance: number;
  critical_damage: number;
  magic_damage_bonus: number;
  
  // Habilidades
  sword_mastery: number;
  axe_mastery: number;
  blunt_mastery: number;
  defense_mastery: number;
  magic_mastery: number;
  
  // XP das habilidades
  sword_mastery_xp: number;
  axe_mastery_xp: number;
  blunt_mastery_xp: number;
  defense_mastery_xp: number;
  magic_mastery_xp: number;
  
  // Stats base (sem equipamentos) para exibição de bônus
  base_hp?: number;
  base_max_hp?: number;
  base_mana?: number;
  base_max_mana?: number;
  base_atk?: number;
  base_def?: number;
  base_speed?: number;
  
  // Bônus de equipamentos para exibição
  equipment_hp_bonus?: number;
  equipment_mana_bonus?: number;
  equipment_atk_bonus?: number;
  equipment_def_bonus?: number;
  equipment_speed_bonus?: number;
}

// Interface para resultado de ganho de XP de habilidade
export interface SkillXpResult {
  skill_leveled_up: boolean;
  new_skill_level: number;
  new_skill_xp: number;
}

// Interface para resultado de distribuição de atributos
export interface AttributeDistributionResult {
  success: boolean;
  message: string;
  new_stats?: CharacterStats;
}

// Interface para informações de build do personagem
export interface CharacterBuild {
  name: string;
  description: string;
  primary_attributes: AttributeType[];
  primary_skills: SkillType[];
  playstyle: 'tank' | 'dps' | 'balanced' | 'caster' | 'assassin' | 'hybrid';
  recommended_equipment_types: string[];
}

// Builds pré-definidas para sugestões
export const PREDEFINED_BUILDS: CharacterBuild[] = [
  {
    name: 'Guerreiro Tanque',
    description: 'Foco em sobrevivência e defesa. Alta vitalidade e força para aguentar dano.',
    primary_attributes: [AttributeType.VITALITY, AttributeType.STRENGTH, AttributeType.WISDOM],
    primary_skills: [SkillType.DEFENSE_MASTERY, SkillType.SWORD_MASTERY],
    playstyle: 'tank',
    recommended_equipment_types: ['armor', 'weapon']
  },
  {
    name: 'Berserker',
    description: 'Dano físico explosivo com foco em força e sorte para críticos devastadores.',
    primary_attributes: [AttributeType.STRENGTH, AttributeType.LUCK, AttributeType.DEXTERITY],
    primary_skills: [SkillType.AXE_MASTERY, SkillType.BLUNT_MASTERY],
    playstyle: 'dps',
    recommended_equipment_types: ['weapon']
  },
  {
    name: 'Assassino Ágil',
    description: 'Velocidade e precisão. Ataca rápido e esquiva com destreza superior.',
    primary_attributes: [AttributeType.DEXTERITY, AttributeType.LUCK, AttributeType.INTELLIGENCE],
    primary_skills: [SkillType.SWORD_MASTERY, SkillType.MAGIC_MASTERY],
    playstyle: 'assassin',
    recommended_equipment_types: ['weapon', 'accessory']
  },
  {
    name: 'Mago Sábio',
    description: 'Mestre da magia com inteligência e sabedoria. Sustentação de mana e dano mágico.',
    primary_attributes: [AttributeType.INTELLIGENCE, AttributeType.WISDOM, AttributeType.VITALITY],
    primary_skills: [SkillType.MAGIC_MASTERY, SkillType.DEFENSE_MASTERY],
    playstyle: 'caster',
    recommended_equipment_types: ['weapon', 'accessory']
  },
  {
    name: 'Explorador Sortudo',
    description: 'Balanceado com foco em sorte para melhores drops e críticos ocasionais.',
    primary_attributes: [AttributeType.LUCK, AttributeType.DEXTERITY, AttributeType.VITALITY],
    primary_skills: [SkillType.SWORD_MASTERY, SkillType.DEFENSE_MASTERY],
    playstyle: 'balanced',
    recommended_equipment_types: ['weapon', 'armor', 'accessory']
  }
];

// Utilitários para cálculos de atributos
export function calculateSkillXpRequired(currentLevel: number): number {
  // Base: 50 XP * (1.4 ^ level)
  return Math.floor(50 * Math.pow(1.4, currentLevel - 1));
}

export function getAttributeDescription(attribute: AttributeType): string {
  const descriptions = {
    [AttributeType.STRENGTH]: 'Aumenta ataque físico e dano crítico. Cada ponto = +2 Ataque + 0.5% Dano Crítico.',
    [AttributeType.DEXTERITY]: 'Aumenta velocidade e chance crítica. Cada ponto = +1.5 Velocidade + 0.3% Crítico.',
    [AttributeType.INTELLIGENCE]: 'Aumenta mana máxima e dano mágico. Cada ponto = +5 Mana + 10% Dano Mágico.',
    [AttributeType.WISDOM]: 'Aumenta regeneração, resistências e cura. Cada ponto = +1 Defesa + 5% Dano Mágico + 12% Cura.',
    [AttributeType.VITALITY]: 'Aumenta HP máximo e resistência. Cada ponto = +8 HP + 1 Defesa.',
    [AttributeType.LUCK]: 'Aumenta drops e chance crítica. Cada ponto = +0.5% Crítico + 1% Dano Crítico.'
  };
  return descriptions[attribute];
}

export function getSkillDescription(skill: SkillType): string {
  const descriptions = {
    [SkillType.SWORD_MASTERY]: 'Maestria com espadas. Aumenta ataque (+1), chance crítica (+0.2%) e dano crítico (+3%) por nível.',
    [SkillType.AXE_MASTERY]: 'Maestria com machados. Aumenta ataque (+1), chance crítica (+0.2%) e dano crítico (+3%) por nível.',
    [SkillType.BLUNT_MASTERY]: 'Maestria com armas de concussão. Aumenta ataque (+1), chance crítica (+0.2%) e dano crítico (+3%) por nível.',
    [SkillType.DEFENSE_MASTERY]: 'Maestria defensiva. Aumenta defesa (+2) por nível e reduz dano recebido.',
    [SkillType.MAGIC_MASTERY]: 'Maestria mágica. Aumenta mana (+3), dano mágico (+15%) e cura (+10%) por nível.'
  };
  return descriptions[skill];
} 