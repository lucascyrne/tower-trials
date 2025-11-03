import { type Character } from '@/models/character.model';
import { type GamePlayer } from '@/models/game.model';
import { CharacterStatsService } from '@/services/character-stats.service';
import { EquipmentService } from '@/services/equipment.service';
import { SpellService } from '@/services/spell.service';

interface EquipmentBonuses {
  total_atk_bonus: number;
  total_def_bonus: number;
  total_mana_bonus: number;
  total_speed_bonus: number;
  total_hp_bonus: number;
  total_critical_chance_bonus: number;
  total_critical_damage_bonus: number;
}

interface DerivedStats {
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  critical_chance: number;
  critical_damage: number;
  magic_damage_bonus: number;
  magic_attack: number;
  double_attack_chance: number;
}

interface StatsCalculation {
  baseStats: {
    hp: number;
    max_hp: number;
    mana: number;
    max_mana: number;
    atk: number;
    def: number;
    speed: number;
  };
  totalStats: {
    hp: number;
    max_hp: number;
    mana: number;
    max_mana: number;
    atk: number;
    def: number;
    speed: number;
  };
  derivedStats: DerivedStats;
  equipmentBonuses: EquipmentBonuses;
}

/**
 * Calcular stats base e totais (com equipamentos)
 */
export async function calculateStatsWithEquipment(
  character: Character,
  characterId: string
): Promise<StatsCalculation> {
  // Calcular stats derivados (base, sem equipamentos)
  const derivedStats = await CharacterStatsService.calculateDerivedStats(character);

  // Buscar bônus de equipamentos
  const equipmentBonusResponse = await EquipmentService.getEquipmentBonuses(characterId);
  const equipmentBonuses: EquipmentBonuses =
    equipmentBonusResponse.success && equipmentBonusResponse.data
      ? equipmentBonusResponse.data
      : {
          total_atk_bonus: 0,
          total_def_bonus: 0,
          total_mana_bonus: 0,
          total_speed_bonus: 0,
          total_hp_bonus: 0,
          total_critical_chance_bonus: 0,
          total_critical_damage_bonus: 0,
        };

  // Stats base (sem equipamentos)
  const baseStats = {
    hp: derivedStats.hp,
    max_hp: derivedStats.max_hp,
    mana: derivedStats.mana,
    max_mana: derivedStats.max_mana,
    atk: derivedStats.atk,
    def: derivedStats.def,
    speed: derivedStats.speed,
  };

  // Stats totais (base + equipamentos)
  const totalStats = {
    hp: baseStats.hp + equipmentBonuses.total_hp_bonus,
    max_hp: baseStats.max_hp + equipmentBonuses.total_hp_bonus,
    mana: baseStats.mana + equipmentBonuses.total_mana_bonus,
    max_mana: baseStats.max_mana + equipmentBonuses.total_mana_bonus,
    atk: baseStats.atk + equipmentBonuses.total_atk_bonus,
    def: baseStats.def + equipmentBonuses.total_def_bonus,
    speed: baseStats.speed + equipmentBonuses.total_speed_bonus,
  };

  return {
    baseStats,
    totalStats,
    derivedStats,
    equipmentBonuses,
  };
}

/**
 * Converter Character para GamePlayer
 * Função pura e reutilizável que consolida toda a lógica de conversão
 */
export async function convertCharacterToGamePlayer(
  character: Character,
  characterId: string,
  options?: { loadSpells?: boolean }
): Promise<GamePlayer> {
  const { loadSpells = true } = options || {};

  // Calcular todos os stats
  const { baseStats, totalStats, derivedStats, equipmentBonuses } =
    await calculateStatsWithEquipment(character, characterId);

  // Criar GamePlayer
  const gamePlayer: GamePlayer = {
    id: character.id,
    user_id: character.user_id,
    name: character.name,
    level: character.level,
    xp: character.xp,
    xp_next_level: character.xp_next_level,
    gold: character.gold,
    hp: totalStats.hp,
    max_hp: totalStats.max_hp,
    mana: totalStats.mana,
    max_mana: totalStats.max_mana,
    atk: totalStats.atk,
    def: totalStats.def,
    speed: totalStats.speed,
    created_at: character.created_at,
    updated_at: character.updated_at,
    isPlayerTurn: true,
    specialCooldown: 0,
    defenseCooldown: 0,
    isDefending: false,
    floor: character.floor,
    spells: [],
    consumables: [],
    active_effects: {
      buffs: [],
      debuffs: [],
      dots: [],
      hots: [],
      attribute_modifications: [],
    },

    // Atributos primários
    strength: character.strength || 10,
    dexterity: character.dexterity || 10,
    intelligence: character.intelligence || 10,
    wisdom: character.wisdom || 10,
    vitality: character.vitality || 10,
    luck: character.luck || 10,
    attribute_points: character.attribute_points || 0,

    // Habilidades
    sword_mastery: character.sword_mastery || 1,
    axe_mastery: character.axe_mastery || 1,
    blunt_mastery: character.blunt_mastery || 1,
    defense_mastery: character.defense_mastery || 1,
    magic_mastery: character.magic_mastery || 1,

    sword_mastery_xp: character.sword_mastery_xp || 0,
    axe_mastery_xp: character.axe_mastery_xp || 0,
    blunt_mastery_xp: character.blunt_mastery_xp || 0,
    defense_mastery_xp: character.defense_mastery_xp || 0,
    magic_mastery_xp: character.magic_mastery_xp || 0,

    // Stats derivados (incluindo bônus de equipamentos)
    critical_chance: derivedStats.critical_chance + equipmentBonuses.total_critical_chance_bonus,
    critical_damage: derivedStats.critical_damage + equipmentBonuses.total_critical_damage_bonus,
    magic_damage_bonus: derivedStats.magic_damage_bonus,
    magic_attack: derivedStats.magic_attack,
    double_attack_chance: derivedStats.double_attack_chance,

    // Stats base (sem equipamentos) para exibição
    base_hp: baseStats.hp,
    base_max_hp: baseStats.max_hp,
    base_mana: baseStats.mana,
    base_max_mana: baseStats.max_mana,
    base_atk: baseStats.atk,
    base_def: baseStats.def,
    base_speed: baseStats.speed,

    // Bônus reais de equipamentos para exibição
    equipment_hp_bonus: equipmentBonuses.total_hp_bonus,
    equipment_mana_bonus: equipmentBonuses.total_mana_bonus,
    equipment_atk_bonus: equipmentBonuses.total_atk_bonus,
    equipment_def_bonus: equipmentBonuses.total_def_bonus,
    equipment_speed_bonus: equipmentBonuses.total_speed_bonus,
  };

  // Carregar magias equipadas se solicitado
  if (loadSpells) {
    try {
      const spellsResponse = await SpellService.getCharacterEquippedSpells(characterId);
      gamePlayer.spells = spellsResponse.success && spellsResponse.data ? spellsResponse.data : [];
    } catch (spellError) {
      console.warn('[CharacterConversionUtils] Erro ao carregar magias (não crítico):', spellError);
      gamePlayer.spells = [];
    }
  }

  return gamePlayer;
}

/**
 * Verificar se o cache de um personagem ainda é válido
 */
export function isCacheValid(
  cacheTimestamp: number | null,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutos padrão
): boolean {
  if (!cacheTimestamp) return false;

  const cacheAge = Date.now() - cacheTimestamp;
  return cacheAge < maxAgeMs;
}
