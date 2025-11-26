import { type Character } from '@/resources/character/character.model';
import { type GamePlayer } from '@/resources/game/game.model';
import { type CharacterStats } from '@/resources/character/character.model';
import { CharacterStatsService } from '@/resources/character/character-stats.service';

// =====================================
// INTERFACES INTERNAS
// =====================================

interface AttributeDistribution {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
}

interface StatsBreakdown {
  base: number;
  fromAttributes: number;
  fromMasteries: number;
  fromEquipment: number;
  total: number;
}

export interface PreviewImprovements {
  hp: number;
  mana: number;
  atk: number;
  speed: number;
  critChance: number;
}

// =====================================
// CLASSE UTILITÁRIA CENTRALIZADORA
// =====================================

export class CharacterUtils {
  // =====================================
  // CONVERSÕES ÚNICAS (FONTE DA VERDADE)
  // =====================================

  /**
   * ✅ FONTE ÚNICA: Converter Character para GamePlayer
   * Elimina duplicação e garante consistência
   */
  static async convertToGamePlayer(character: Character): Promise<GamePlayer> {
    // ✅ CRÍTICO: Usar CharacterStatsService como fonte única da verdade
    const derivedStats = await CharacterStatsService.calculateDerivedStats(character);

    return {
      id: character.id,
      user_id: character.user_id,
      name: character.name,
      level: character.level,
      xp: character.xp,
      xp_next_level: character.xp_next_level,
      gold: character.gold,
      hp: character.hp || derivedStats.hp,
      max_hp: character.max_hp || derivedStats.max_hp,
      mana: character.mana || derivedStats.mana,
      max_mana: character.max_mana || derivedStats.max_mana,
      atk: character.atk || derivedStats.atk,
      def: character.def || derivedStats.def,
      speed: character.speed || derivedStats.speed,
      created_at: character.created_at,
      updated_at: character.updated_at,
      floor: character.floor,

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

      // ✅ CRÍTICO: Stats derivados SEMPRE do service
      critical_chance: derivedStats.critical_chance,
      critical_damage: derivedStats.critical_damage,
      magic_damage_bonus: derivedStats.magic_damage_bonus,
      magic_attack: derivedStats.magic_attack,
      double_attack_chance: derivedStats.double_attack_chance,

      // Stats base para exibição
      base_hp: character.hp || derivedStats.hp,
      base_max_hp: character.max_hp || derivedStats.max_hp,
      base_mana: character.mana || derivedStats.mana,
      base_max_mana: character.max_mana || derivedStats.max_mana,
      base_atk: character.atk || derivedStats.atk,
      base_def: character.def || derivedStats.def,
      base_speed: character.speed || derivedStats.speed,

      // Bônus de equipamentos (zerados aqui, calculados separadamente)
      equipment_hp_bonus: 0,
      equipment_mana_bonus: 0,
      equipment_atk_bonus: 0,
      equipment_def_bonus: 0,
      equipment_speed_bonus: 0,

      // Estado de batalha
      isPlayerTurn: true,
      specialCooldown: 0,
      defenseCooldown: 0,
      isDefending: false,
      spells: [],
      consumables: [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
    };
  }

  /**
   * ✅ FONTE ÚNICA: Converter GamePlayer para CharacterStats
   */
  static convertToCharacterStats(gamePlayer: GamePlayer): CharacterStats {
    return {
      level: gamePlayer.level,
      xp: gamePlayer.xp,
      xp_next_level: gamePlayer.xp_next_level,
      gold: gamePlayer.gold,
      hp: gamePlayer.hp,
      max_hp: gamePlayer.max_hp,
      mana: gamePlayer.mana,
      max_mana: gamePlayer.max_mana,
      atk: gamePlayer.atk,
      def: gamePlayer.def,
      speed: gamePlayer.speed,

      // Atributos primários
      strength: gamePlayer.strength || 10,
      dexterity: gamePlayer.dexterity || 10,
      intelligence: gamePlayer.intelligence || 10,
      wisdom: gamePlayer.wisdom || 10,
      vitality: gamePlayer.vitality || 10,
      luck: gamePlayer.luck || 10,
      attribute_points: gamePlayer.attribute_points || 0,

      // Stats derivados
      critical_chance: gamePlayer.critical_chance || 0,
      critical_damage: gamePlayer.critical_damage || 0,
      magic_damage_bonus: gamePlayer.magic_damage_bonus || 0,
      magic_attack: gamePlayer.magic_attack || 0,

      // Habilidades
      sword_mastery: gamePlayer.sword_mastery || 1,
      axe_mastery: gamePlayer.axe_mastery || 1,
      blunt_mastery: gamePlayer.blunt_mastery || 1,
      defense_mastery: gamePlayer.defense_mastery || 1,
      magic_mastery: gamePlayer.magic_mastery || 1,
      sword_mastery_xp: gamePlayer.sword_mastery_xp || 0,
      axe_mastery_xp: gamePlayer.axe_mastery_xp || 0,
      blunt_mastery_xp: gamePlayer.blunt_mastery_xp || 0,
      defense_mastery_xp: gamePlayer.defense_mastery_xp || 0,
      magic_mastery_xp: gamePlayer.magic_mastery_xp || 0,

      // Stats base
      base_hp: gamePlayer.base_hp || gamePlayer.hp,
      base_max_hp: gamePlayer.base_max_hp || gamePlayer.max_hp,
      base_mana: gamePlayer.base_mana || gamePlayer.mana,
      base_max_mana: gamePlayer.base_max_mana || gamePlayer.max_mana,
      base_atk: gamePlayer.base_atk || gamePlayer.atk,
      base_def: gamePlayer.base_def || gamePlayer.def,
      base_speed: gamePlayer.base_speed || gamePlayer.speed,

      // Bônus de equipamentos
      equipment_hp_bonus: gamePlayer.equipment_hp_bonus || 0,
      equipment_mana_bonus: gamePlayer.equipment_mana_bonus || 0,
      equipment_atk_bonus: gamePlayer.equipment_atk_bonus || 0,
      equipment_def_bonus: gamePlayer.equipment_def_bonus || 0,
      equipment_speed_bonus: gamePlayer.equipment_speed_bonus || 0,
    };
  }

  // =====================================
  // CÁLCULOS CENTRALIZADOS
  // =====================================

  /**
   * ✅ FONTE ÚNICA: Calcular stats derivados usando service
   */
  static async getDerivedStats(character: Character | CharacterStats) {
    return await CharacterStatsService.calculateDerivedStats(character as Character);
  }

  /**
   * ✅ FONTE ÚNICA: Calcular preview de melhoramentos
   * Elimina duplicação em character-stats.tsx
   */
  static async calculatePreviewImprovements(
    character: Character | CharacterStats,
    distribution: AttributeDistribution
  ): Promise<PreviewImprovements> {
    // Stats atuais
    const currentStats = await CharacterStatsService.calculateDerivedStats(character as Character);

    // Simular stats com novos atributos
    const characterWithNewStats = {
      ...character,
      strength: (character.strength || 10) + distribution.strength,
      dexterity: (character.dexterity || 10) + distribution.dexterity,
      intelligence: (character.intelligence || 10) + distribution.intelligence,
      wisdom: (character.wisdom || 10) + distribution.wisdom,
      vitality: (character.vitality || 10) + distribution.vitality,
      luck: (character.luck || 10) + distribution.luck,
    };

    const newStats = await CharacterStatsService.calculateDerivedStats(
      characterWithNewStats as Character
    );

    return {
      hp: newStats.max_hp - currentStats.max_hp,
      mana: newStats.max_mana - currentStats.max_mana,
      atk: newStats.atk - currentStats.atk,
      speed: newStats.speed - currentStats.speed,
      critChance: newStats.critical_chance - currentStats.critical_chance,
    };
  }

  /**
   * ✅ FONTE ÚNICA: Breakdown detalhado de stats
   * Para uso em tooltips e debugging
   */
  static async getStatsBreakdown(character: Character | CharacterStats): Promise<{
    hp: StatsBreakdown;
    mana: StatsBreakdown;
    atk: StatsBreakdown;
    def: StatsBreakdown;
    speed: StatsBreakdown;
    criticalChance: StatsBreakdown;
    criticalDamage: StatsBreakdown;
    magicDamage: StatsBreakdown;
  }> {
    const level = character.level;
    const str = character.strength || 10;
    const dex = character.dexterity || 10;
    const int = character.intelligence || 10;
    const wis = character.wisdom || 10;
    const vit = character.vitality || 10;
    const luck = character.luck || 10;

    // Usar a mesma lógica do CharacterStatsService para consistência
    const strScaling = Math.pow(str, 1.1);
    const dexScaling = Math.pow(dex, 1.1);
    const intScaling = Math.pow(int, 1.1);
    const wisScaling = Math.pow(wis, 1.05);
    const vitScaling = Math.pow(vit, 1.2);
    const luckScaling = luck;

    const swordMastery = character.sword_mastery || 1;
    const axeMastery = character.axe_mastery || 1;
    const bluntMastery = character.blunt_mastery || 1;
    const defenseMastery = character.defense_mastery || 1;
    const magicMastery = character.magic_mastery || 1;

    const weaponMasteryBonus = Math.pow(Math.max(swordMastery, axeMastery, bluntMastery), 1.05);
    const defMasteryBonus = Math.pow(defenseMastery, 1.1);
    const magicMasteryBonus = Math.pow(magicMastery, 1.05);

    // HP Breakdown
    const hpBase = 50 + level * 2;
    const hpFromVitality = Math.floor(vitScaling * 1.5);
    const hpFromStrength = Math.floor(strScaling * 0.2);
    const hpEquipment = (character as CharacterStats).equipment_hp_bonus || 0;

    // Mana Breakdown
    const manaBase = 20 + level * 1;
    const manaFromIntelligence = Math.floor(intScaling * 1.0);
    const manaFromWisdom = Math.floor(wisScaling * 0.8);
    const manaFromMagicMastery = Math.floor(magicMasteryBonus * 0.5);
    const manaEquipment = (character as CharacterStats).equipment_mana_bonus || 0;

    // ATK Breakdown
    const atkBase = 2 + level;
    const atkFromStrength = Math.floor(strScaling * 0.8);
    const atkFromWeaponMastery = Math.floor(weaponMasteryBonus * 0.4);
    const atkFromDexterity = Math.floor(dexScaling * 0.1);
    const atkEquipment = (character as CharacterStats).equipment_atk_bonus || 0;

    // DEF Breakdown
    const defBase = 1 + level;
    const defFromVitality = Math.floor(vitScaling * 0.4);
    const defFromWisdom = Math.floor(wisScaling * 0.3);
    const defFromDefenseMastery = Math.floor(defMasteryBonus * 0.8);
    const defEquipment = (character as CharacterStats).equipment_def_bonus || 0;

    // Speed Breakdown
    const speedBase = 3 + level;
    const speedFromDexterity = Math.floor(dexScaling * 0.8);
    const speedFromLuck = Math.floor(luckScaling * 0.1);
    const speedEquipment = (character as CharacterStats).equipment_speed_bonus || 0;

    // Critical Chance Breakdown
    const critChanceBase = 1.0;
    const critChanceFromDexterity = dexScaling * 0.15;
    const critChanceFromLuck = luckScaling * 0.25;
    const critChanceFromStrength = strScaling * 0.05;
    const critChanceFromWeaponMastery = weaponMasteryBonus * 0.1;

    // Critical Damage Breakdown
    const critDamageBase = 102.0;
    const critDamageFromStrength = strScaling * 0.3;
    const critDamageFromLuck = luckScaling * 0.2;
    const critDamageFromWeaponMastery = weaponMasteryBonus * 0.4;

    // Magic Damage Breakdown
    const magicDamageBase = 2.0;
    const magicDamageFromIntelligence = intScaling * 0.8;
    const magicDamageFromWisdom = wisScaling * 0.4;
    const magicDamageFromMagicMastery = magicMasteryBonus * 1.0;

    return {
      hp: {
        base: hpBase,
        fromAttributes: hpFromVitality + hpFromStrength,
        fromMasteries: 0,
        fromEquipment: hpEquipment,
        total: hpBase + hpFromVitality + hpFromStrength + hpEquipment,
      },
      mana: {
        base: manaBase,
        fromAttributes: manaFromIntelligence + manaFromWisdom,
        fromMasteries: manaFromMagicMastery,
        fromEquipment: manaEquipment,
        total:
          manaBase + manaFromIntelligence + manaFromWisdom + manaFromMagicMastery + manaEquipment,
      },
      atk: {
        base: atkBase,
        fromAttributes: atkFromStrength + atkFromDexterity,
        fromMasteries: atkFromWeaponMastery,
        fromEquipment: atkEquipment,
        total: atkBase + atkFromStrength + atkFromWeaponMastery + atkFromDexterity + atkEquipment,
      },
      def: {
        base: defBase,
        fromAttributes: defFromVitality + defFromWisdom,
        fromMasteries: defFromDefenseMastery,
        fromEquipment: defEquipment,
        total: defBase + defFromVitality + defFromWisdom + defFromDefenseMastery + defEquipment,
      },
      speed: {
        base: speedBase,
        fromAttributes: speedFromDexterity + speedFromLuck,
        fromMasteries: 0,
        fromEquipment: speedEquipment,
        total: speedBase + speedFromDexterity + speedFromLuck + speedEquipment,
      },
      criticalChance: {
        base: critChanceBase,
        fromAttributes: critChanceFromDexterity + critChanceFromLuck + critChanceFromStrength,
        fromMasteries: critChanceFromWeaponMastery,
        fromEquipment: 0,
        total: Math.min(
          60,
          critChanceBase +
            critChanceFromDexterity +
            critChanceFromLuck +
            critChanceFromStrength +
            critChanceFromWeaponMastery
        ),
      },
      criticalDamage: {
        base: critDamageBase,
        fromAttributes: critDamageFromStrength + critDamageFromLuck,
        fromMasteries: critDamageFromWeaponMastery,
        fromEquipment: 0,
        total: Math.min(
          200,
          critDamageBase + critDamageFromStrength + critDamageFromLuck + critDamageFromWeaponMastery
        ),
      },
      magicDamage: {
        base: magicDamageBase,
        fromAttributes: magicDamageFromIntelligence + magicDamageFromWisdom,
        fromMasteries: magicDamageFromMagicMastery,
        fromEquipment: 0,
        total: Math.min(
          150,
          magicDamageBase +
            magicDamageFromIntelligence +
            magicDamageFromWisdom +
            magicDamageFromMagicMastery
        ),
      },
    };
  }

  // =====================================
  // UTILITÁRIOS DE FORMATAÇÃO
  // =====================================

  /**
   * ✅ UTILITÁRIO: Formatar valor com bônus de equipamento destacado
   * Retorna objeto com dados para renderização pelo componente React
   */
  static formatValueWithEquipmentBonus(
    baseValue: number,
    equipmentBonus: number
  ): {
    totalValue: number;
    baseValue: number;
    equipmentBonus: number;
    hasBonus: boolean;
    formattedTotal: string;
    formattedBonus: string;
  } {
    const bonus = equipmentBonus || 0;
    const totalValue = baseValue + bonus;

    return {
      totalValue,
      baseValue,
      equipmentBonus: bonus,
      hasBonus: bonus > 0,
      formattedTotal: totalValue.toLocaleString(),
      formattedBonus: bonus > 0 ? `(+${bonus})` : '',
    };
  }

  /**
   * ✅ UTILITÁRIO: Calcular progresso de XP no nível atual
   */
  static calculateXpProgress(character: Character | CharacterStats) {
    const calculateCurrentLevelXpRequirement = (level: number): number => {
      if (level <= 1) return 0;
      return Math.floor(100 * Math.pow(1.5, level - 2));
    };

    const currentLevelStartXp = calculateCurrentLevelXpRequirement(character.level);
    const currentLevelEndXp = character.xp_next_level;
    const xpInCurrentLevel = character.xp - currentLevelStartXp;
    const xpNeededForNextLevel = currentLevelEndXp - currentLevelStartXp;
    const xpProgress = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100));

    return {
      xpInCurrentLevel,
      xpNeededForNextLevel,
      xpProgress,
    };
  }

  /**
   * ✅ UTILITÁRIO: Calcular progresso de HP/Mana
   */
  static calculateHealthProgress(character: Character | GamePlayer | CharacterStats) {
    const hpProgress =
      character.max_hp > 0
        ? Math.max(0, Math.min(100, (character.hp / character.max_hp) * 100))
        : 0;

    const manaProgress =
      character.max_mana > 0
        ? Math.max(0, Math.min(100, (character.mana / character.max_mana) * 100))
        : 0;

    return { hpProgress, manaProgress };
  }

  /**
   * ✅ UTILITÁRIO: Validar se dados do personagem são consistentes
   */
  static validateCharacterConsistency(character: Character | GamePlayer | CharacterStats): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Validar stats básicos
    if (character.hp > character.max_hp) {
      issues.push(`HP atual (${character.hp}) maior que HP máximo (${character.max_hp})`);
    }

    if (character.mana > character.max_mana) {
      issues.push(`Mana atual (${character.mana}) maior que Mana máximo (${character.max_mana})`);
    }

    // Validar atributos
    const attributes = [
      character.strength || 10,
      character.dexterity || 10,
      character.intelligence || 10,
      character.wisdom || 10,
      character.vitality || 10,
      character.luck || 10,
    ];

    if (attributes.some(attr => attr < 1 || attr > 100)) {
      issues.push('Atributos fora do range válido (1-100)');
    }

    // Validar nível
    if (character.level < 1 || character.level > 100) {
      issues.push(`Nível inválido: ${character.level}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
