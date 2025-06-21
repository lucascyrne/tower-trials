import { type Character } from '@/models/character.model';

interface DerivedStats {
  hp: number;
  max_hp: number;
  mana: number;
  max_mana: number;
  atk: number;
  magic_attack: number;
  def: number;
  speed: number;
  critical_chance: number;
  critical_damage: number;
  magic_damage_bonus: number;
  double_attack_chance: number;
}

interface BuildAnalysis {
  diversity: number;
  dominantAttribute: string;
  monoBuild: boolean;
}

export class CharacterStatsService {
  /**
   * ✅ ULTRA REBALANCEADO: Calcular stats derivados com valores extremamente baixos para nível 1
   * REMOVIDO: Sistema de diversidade de build completamente removido
   */
  static async calculateDerivedStats(character: Character): Promise<DerivedStats> {
    const {
      level,
      strength = 10,
      dexterity = 10,
      intelligence = 10,
      wisdom = 10,
      vitality = 10,
      luck = 10,
      sword_mastery = 1,
      axe_mastery = 1,
      blunt_mastery = 1,
      defense_mastery = 1,
      magic_mastery = 1,
    } = character;

    console.log(`[CharacterStatsService] Calculando stats sem diversidade para nível ${level}:`, {
      strength,
      dexterity,
      intelligence,
      wisdom,
      vitality,
      luck,
    });

    // =====================================
    // VALORES BASE MÍNIMOS
    // =====================================
    const baseHp = 50 + level * 2;
    const baseMana = 20 + level * 1;
    const baseAtk = 2 + level;
    const baseDef = 1 + level;
    const baseSpeed = 3 + level;

    // =====================================
    // ESCALAMENTO SIMPLES SEM DIVERSIDADE
    // =====================================
    const strScaling = Math.pow(strength, 1.1); // Reduzido de 1.2
    const dexScaling = Math.pow(dexterity, 1.1); // Reduzido de 1.15
    const intScaling = Math.pow(intelligence, 1.1); // Reduzido de 1.25
    const wisScaling = Math.pow(wisdom, 1.05); // Reduzido de 1.1
    const vitScaling = Math.pow(vitality, 1.2); // Reduzido de 1.3
    const luckScaling = luck; // Sem escalamento

    // =====================================
    // MASTERIES SIMPLIFICADAS
    // =====================================
    const weaponMasteryBonus = Math.pow(Math.max(sword_mastery, axe_mastery, blunt_mastery), 1.05);
    const defMasteryBonus = Math.pow(defense_mastery, 1.1);
    const magicMasteryBonus = Math.pow(magic_mastery, 1.05);

    // =====================================
    // CÁLCULOS FINAIS COM VALORES BAIXOS
    // =====================================

    // HP: Base + escalamento mínimo
    const hpFromVitality = Math.floor(vitScaling * 1.5); // Reduzido de 2.5
    const hpFromStrength = Math.floor(strScaling * 0.2); // Reduzido de 0.3
    const calculatedMaxHp = baseHp + hpFromVitality + hpFromStrength;

    // Mana: Base + escalamento mínimo
    const manaFromIntelligence = Math.floor(intScaling * 1.0); // Reduzido de 1.5
    const manaFromWisdom = Math.floor(wisScaling * 0.8); // Reduzido de 1.0
    const manaFromMagicMastery = Math.floor(magicMasteryBonus * 0.5); // Reduzido de 0.8
    const calculatedMaxMana =
      baseMana + manaFromIntelligence + manaFromWisdom + manaFromMagicMastery;

    // ATK: Base + escalamento baixo
    const atkFromStrength = Math.floor(strScaling * 0.8); // Reduzido de 1.2
    const atkFromWeaponMastery = Math.floor(weaponMasteryBonus * 0.4); // Reduzido de 0.6
    const atkFromDexterity = Math.floor(dexScaling * 0.1); // Reduzido de 0.2
    const calculatedAtk = baseAtk + atkFromStrength + atkFromWeaponMastery + atkFromDexterity;

    // Magic ATK: Baseado em INT/WIS
    const magicAtkFromIntelligence = Math.floor(intScaling * 0.8); // Reduzido de 1.4
    const magicAtkFromWisdom = Math.floor(wisScaling * 0.4); // Reduzido de 0.8
    const magicAtkFromMagicMastery = Math.floor(magicMasteryBonus * 0.6); // Reduzido de 1.0
    const calculatedMagicAtk =
      baseAtk + magicAtkFromIntelligence + magicAtkFromWisdom + magicAtkFromMagicMastery;

    // DEF: Base + escalamento baixo
    const defFromVitality = Math.floor(vitScaling * 0.4); // Reduzido de 0.6
    const defFromWisdom = Math.floor(wisScaling * 0.3); // Reduzido de 0.5
    const defFromDefenseMastery = Math.floor(defMasteryBonus * 0.8); // Reduzido de 1.0
    const calculatedDef = baseDef + defFromVitality + defFromWisdom + defFromDefenseMastery;

    // Speed: Base + escalamento mínimo
    const speedFromDexterity = Math.floor(dexScaling * 0.8); // Reduzido de 1.0
    const speedFromLuck = Math.floor(luckScaling * 0.1); // Reduzido de 0.2
    const calculatedSpeed = baseSpeed + speedFromDexterity + speedFromLuck;

    // =====================================
    // CRÍTICO E MÁGICO: VALORES ULTRA BAIXOS
    // =====================================

    // Chance Crítica: Base 1% + escalamento ultra baixo
    const criticalChanceBase = 1.0; // Base 1%
    const critChanceFromDexterity = dexScaling * 0.15; // Reduzido de 0.25
    const critChanceFromLuck = luckScaling * 0.25; // Reduzido de 0.35
    const critChanceFromStrength = strScaling * 0.05; // Reduzido de 0.1
    const critChanceFromWeaponMastery = weaponMasteryBonus * 0.1; // Novo, baixo
    const calculatedCritChance = Math.min(
      60.0, // Cap reduzido de 75%
      criticalChanceBase +
        critChanceFromDexterity +
        critChanceFromLuck +
        critChanceFromStrength +
        critChanceFromWeaponMastery
    );

    // Dano Crítico: Base 102% + escalamento ultra baixo
    const criticalDamageBase = 102.0; // Base apenas 2% a mais que normal
    const critDamageFromStrength = strScaling * 0.3; // Reduzido de 0.4
    const critDamageFromLuck = luckScaling * 0.2; // Reduzido de 0.6
    const critDamageFromWeaponMastery = weaponMasteryBonus * 0.4; // Reduzido de 0.3
    const calculatedCritDamage = Math.min(
      200.0, // Cap reduzido de 250%
      criticalDamageBase + critDamageFromStrength + critDamageFromLuck + critDamageFromWeaponMastery
    );

    // Dano Mágico: Base 2% + escalamento ultra baixo
    const magicDamageBase = 2.0; // Base 2%
    const magicDamageFromIntelligence = intScaling * 0.8; // Reduzido de 1.2
    const magicDamageFromWisdom = wisScaling * 0.4; // Reduzido de 0.8
    const magicDamageFromMagicMastery = magicMasteryBonus * 1.0; // Reduzido de 1.5
    let rawMagicDamage =
      magicDamageBase +
      magicDamageFromIntelligence +
      magicDamageFromWisdom +
      magicDamageFromMagicMastery;

    // Diminishing returns mais agressivos
    if (rawMagicDamage > 50) {
      rawMagicDamage = 50 + (rawMagicDamage - 50) * 0.5;
    }
    const calculatedMagicDamage = Math.min(150.0, rawMagicDamage); // Cap reduzido de 200%

    // Double Attack: Muito baixo
    const doubleAttackFromDexterity = dexScaling * 0.05; // Muito baixo
    const doubleAttackFromLuck = luckScaling * 0.1; // Muito baixo
    const calculatedDoubleAttack = Math.min(
      25.0, // Cap baixo
      doubleAttackFromDexterity + doubleAttackFromLuck
    );

    const finalStats: DerivedStats = {
      hp: calculatedMaxHp,
      max_hp: calculatedMaxHp,
      mana: calculatedMaxMana,
      max_mana: calculatedMaxMana,
      atk: calculatedAtk,
      magic_attack: calculatedMagicAtk,
      def: calculatedDef,
      speed: calculatedSpeed,
      critical_chance: calculatedCritChance,
      critical_damage: calculatedCritDamage,
      magic_damage_bonus: calculatedMagicDamage,
      double_attack_chance: calculatedDoubleAttack,
    };

    console.log(`[CharacterStatsService] Stats calculados (SEM diversidade) para nível ${level}:`, {
      criticalChance: finalStats.critical_chance.toFixed(1) + '%',
      criticalDamage: finalStats.critical_damage.toFixed(0) + '%',
      magicDamage: finalStats.magic_damage_bonus.toFixed(1) + '%',
      hp: finalStats.max_hp,
      atk: finalStats.atk,
    });

    return finalStats;
  }

  // =====================================
  // MÉTODO DE ANÁLISE SIMPLIFICADO (SEM BÔNUS)
  // =====================================
  static analyzeBuildDiversity(character: Character): BuildAnalysis {
    const {
      strength = 10,
      dexterity = 10,
      intelligence = 10,
      wisdom = 10,
      vitality = 10,
      luck = 10,
    } = character;

    const attributes = [strength, dexterity, intelligence, wisdom, vitality, luck];
    const total = attributes.reduce((sum, attr) => sum + attr, 0);
    const maxAttr = Math.max(...attributes);
    const maxPercentage = maxAttr / total;

    // Calcular diversidade apenas para informação (sem bônus)
    const expectedValue = total / 6;
    const variance =
      attributes.reduce((sum, attr) => sum + Math.pow(attr - expectedValue, 2), 0) / 6;
    const standardDeviation = Math.sqrt(variance);
    const diversityScore = Math.max(0, 1 - standardDeviation / (total / 6));

    let dominantAttribute = 'Balanced';
    if (maxPercentage > 0.3) {
      const dominantIndex = attributes.indexOf(maxAttr);
      const attributeNames = [
        'Strength',
        'Dexterity',
        'Intelligence',
        'Wisdom',
        'Vitality',
        'Luck',
      ];
      dominantAttribute = attributeNames[dominantIndex];
    }

    return {
      diversity: diversityScore,
      dominantAttribute,
      monoBuild: maxPercentage > 0.8,
    };
  }
}
