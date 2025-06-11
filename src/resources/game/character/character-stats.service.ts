import { type Character } from '../models/character.model';
import { EquipmentService } from '../equipment.service';

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
  diversityScore: number;
  diversityPercentage: number;
  diversityBonus: number;
  monoBuildPenalty: number;
  dominantAttribute: string;
  dominantPercentage: number;
  isMonoBuild: boolean;
  recommendation: string;
}

export class CharacterStatsService {
  /**
   * Calcular stats derivados usando a nova função que inclui habilidades
   */
  static async calculateDerivedStats(character: Character): Promise<DerivedStats> {
    try {
      console.log('[CharacterStatsService] Calculando stats derivados para:', {
        id: character.id,
        level: character.level,
        strength: character.strength,
        dexterity: character.dexterity,
        intelligence: character.intelligence,
        wisdom: character.wisdom,
        vitality: character.vitality,
        luck: character.luck,
        sword_mastery: character.sword_mastery,
        axe_mastery: character.axe_mastery,
        blunt_mastery: character.blunt_mastery,
        defense_mastery: character.defense_mastery,
        magic_mastery: character.magic_mastery,
      });

      return await this.calculateDerivedStatsFallback(character);
    } catch (error) {
      console.error('[CharacterStatsService] Erro no cálculo de stats derivados:', error);
      return await this.calculateDerivedStatsFallback(character);
    }
  }

  /**
   * Cálculo de fallback com sistema anti-mono-build balanceado
   */
  private static async calculateDerivedStatsFallback(character: Character): Promise<DerivedStats> {
    const level = character.level;
    const str = character.strength || 10;
    const dex = character.dexterity || 10;
    const int = character.intelligence || 10;
    const wis = character.wisdom || 10;
    const vit = character.vitality || 10;
    const luck = character.luck || 10;

    // =====================================
    // SISTEMA ANTI-MONO-BUILD
    // =====================================

    const totalAttributes = str + dex + int + wis + vit + luck;

    // Calcular diversidade de atributos (0-1, onde 1 = perfeitamente balanceado)
    const attributeDiversity =
      1.0 -
      (Math.abs(str / totalAttributes - 1.0 / 6.0) +
        Math.abs(dex / totalAttributes - 1.0 / 6.0) +
        Math.abs(int / totalAttributes - 1.0 / 6.0) +
        Math.abs(wis / totalAttributes - 1.0 / 6.0) +
        Math.abs(vit / totalAttributes - 1.0 / 6.0) +
        Math.abs(luck / totalAttributes - 1.0 / 6.0)) /
        2.0;

    // Bônus por diversidade (builds balanceadas ganham até 20% de bônus)
    const diversityBonus = 1.0 + attributeDiversity * 0.2;

    // Penalidade para mono-builds (builds com 80%+ em um atributo perdem eficiência)
    let monoPenalty = 1.0;
    const maxAttributePercentage = Math.max(
      str / totalAttributes,
      dex / totalAttributes,
      int / totalAttributes,
      wis / totalAttributes,
      vit / totalAttributes,
      luck / totalAttributes
    );

    if (maxAttributePercentage > 0.8) {
      monoPenalty = 0.7; // Penalidade de 30%
    }

    console.log(
      `[CharacterStatsService] Build analysis - Diversidade: ${(attributeDiversity * 100).toFixed(1)}%, Mono-penalty: ${monoPenalty}`
    );

    // =====================================
    // ESCALAMENTO LOGARÍTMICO COM SINERGIAS
    // =====================================

    // Escalamento com diminishing returns mais agressivos
    const strScaling = Math.pow(str, 1.2) * diversityBonus * monoPenalty;
    const dexScaling = Math.pow(dex, 1.15) * diversityBonus * monoPenalty;
    const intScaling = Math.pow(int, 1.25) * diversityBonus * monoPenalty;
    const wisScaling = Math.pow(wis, 1.1) * diversityBonus * monoPenalty;
    const vitScaling = Math.pow(vit, 1.3) * diversityBonus * monoPenalty;
    const luckScaling = luck * diversityBonus * monoPenalty;

    // Habilidades também recebem bônus de diversidade
    const swordMastery = character.sword_mastery || 1;
    const axeMastery = character.axe_mastery || 1;
    const bluntMastery = character.blunt_mastery || 1;
    const defenseMastery = character.defense_mastery || 1;
    const magicMastery = character.magic_mastery || 1;

    const weaponMasteryBonus =
      Math.pow(Math.max(swordMastery, axeMastery, bluntMastery), 1.1) * diversityBonus;
    const defMasteryBonus = Math.pow(defenseMastery, 1.2) * diversityBonus;
    const magicMasteryBonus = Math.pow(magicMastery, 1.15) * diversityBonus;

    // =====================================
    // BASES REBALANCEADAS
    // =====================================

    const baseHp = 50 + level * 2;
    const baseMana = 20 + level * 1;
    const baseAtk = 2 + level;
    const baseDef = 1 + level;
    const baseSpeed = 3 + level;

    // =====================================
    // BÔNUS DE EQUIPAMENTOS COM DUAL WIELDING
    // =====================================

    let equipmentBonus = {
      hp: 0,
      mana: 0,
      atk: 0,
      def: 0,
      speed: 0,
      critical_chance: 0,
      critical_damage: 0,
      magic_damage: 0,
      double_attack_chance: 0,
    };

    try {
      // Buscar equipamentos do personagem
      const equipmentSlots = await EquipmentService.getEquippedItems(character.id);

      if (equipmentSlots) {
        // Usar a nova função que considera dual wielding
        const { calculateEquipmentBonus } = await import('../equipment.service');
        equipmentBonus = calculateEquipmentBonus(equipmentSlots);

        console.log(`[CharacterStatsService] Bônus de equipamentos calculado:`, {
          atk: equipmentBonus.atk,
          def: equipmentBonus.def,
          speed: equipmentBonus.speed,
          critical_chance: equipmentBonus.critical_chance,
          magic_damage: equipmentBonus.magic_damage,
        });
      }
    } catch (error) {
      console.error('[CharacterStatsService] Erro ao calcular bônus de equipamentos:', error);
    }

    // =====================================
    // CÁLCULO DE STATS COM SINERGIAS
    // =====================================

    // HP: Vitalidade + bônus de level + equipamentos
    const hp = Math.floor(baseHp + vitScaling * 3.5 + equipmentBonus.hp);
    const max_hp = hp;

    // Mana: Inteligência/Sabedoria + bônus de level + equipamentos
    const mana = Math.floor(baseMana + (intScaling + wisScaling) * 1.5 + equipmentBonus.mana);
    const max_mana = mana;

    // Ataque: Força + maestria de arma + equipamentos
    const atk = Math.floor(baseAtk + strScaling * 2.2 + weaponMasteryBonus + equipmentBonus.atk);

    // Magic Attack separado (baseado em INT + maestria mágica)
    const magic_attack = Math.floor(
      intScaling * 1.8 + magicMasteryBonus + equipmentBonus.magic_damage
    );

    // Defesa: Destreza + maestria defensiva + equipamentos
    const def = Math.floor(baseDef + dexScaling * 1.5 + defMasteryBonus + equipmentBonus.def);

    // Velocidade: Destreza + equipamentos
    const speed = Math.floor(baseSpeed + dexScaling * 1.8 + equipmentBonus.speed);

    // =====================================
    // STATS DERIVADOS AVANÇADOS
    // =====================================

    // Chance crítica: Destreza + Sorte + maestria + equipamentos
    const critical_chance = Math.min(
      95,
      Math.floor(
        5 + // Base 5%
          dexScaling * 0.3 + // Destreza contribui
          luckScaling * 0.5 + // Sorte contribui mais
          weaponMasteryBonus * 0.2 + // Maestria de arma
          equipmentBonus.critical_chance
      )
    );

    // Dano crítico: Força + maestria + equipamentos
    const critical_damage = Math.floor(
      150 + // Base 150%
        strScaling * 0.8 + // Força contribui
        weaponMasteryBonus * 1.2 + // Maestria contribui mais
        equipmentBonus.critical_damage
    );

    // Bônus de dano mágico: Inteligência + maestria mágica + equipamentos
    const magic_damage_bonus = Math.floor(
      intScaling * 1.2 + magicMasteryBonus * 1.5 + equipmentBonus.magic_damage
    );

    // Chance de ataque duplo (dual wielding)
    const double_attack_chance = Math.min(
      25,
      Math.floor(
        dexScaling * 0.2 + // Destreza base
          luckScaling * 0.3 + // Sorte contribui
          equipmentBonus.double_attack_chance
      )
    );

    const stats = {
      hp,
      max_hp,
      mana,
      max_mana,
      atk,
      magic_attack,
      def,
      speed,
      critical_chance,
      critical_damage,
      magic_damage_bonus,
      double_attack_chance,
    };

    console.log('[CharacterStatsService] Stats derivados calculados:', {
      level,
      diversityBonus: (diversityBonus * 100 - 100).toFixed(1) + '%',
      monoPenalty: (monoPenalty * 100).toFixed(1) + '%',
      final_stats: stats,
    });

    return stats;
  }

  /**
   * Analisar diversidade de build do personagem
   */
  static analyzeBuildDiversity(character: Character): BuildAnalysis {
    const str = character.strength || 10;
    const dex = character.dexterity || 10;
    const int = character.intelligence || 10;
    const wis = character.wisdom || 10;
    const vit = character.vitality || 10;
    const luck = character.luck || 10;

    const totalAttributes = str + dex + int + wis + vit + luck;
    const attributes = [
      { name: 'Força', value: str, percentage: str / totalAttributes },
      { name: 'Destreza', value: dex, percentage: dex / totalAttributes },
      { name: 'Inteligência', value: int, percentage: int / totalAttributes },
      { name: 'Sabedoria', value: wis, percentage: wis / totalAttributes },
      { name: 'Vitalidade', value: vit, percentage: vit / totalAttributes },
      { name: 'Sorte', value: luck, percentage: luck / totalAttributes },
    ];

    // Encontrar atributo dominante
    const dominantAttr = attributes.reduce((max, attr) =>
      attr.percentage > max.percentage ? attr : max
    );
    const isMonoBuild = dominantAttr.percentage > 0.8;

    // Calcular diversidade (quanto mais próximo de 1/6 cada atributo, maior a diversidade)
    const diversityScore =
      1.0 - attributes.reduce((sum, attr) => sum + Math.abs(attr.percentage - 1.0 / 6.0), 0) / 2.0;

    const diversityBonus = 1.0 + diversityScore * 0.2;
    const monoBuildPenalty = isMonoBuild ? 0.7 : 1.0;

    let recommendation = '';
    if (isMonoBuild) {
      recommendation = `Build muito especializada em ${dominantAttr.name}. Considere investir em outros atributos para melhor eficiência geral.`;
    } else if (diversityScore > 0.7) {
      recommendation = 'Build bem balanceada! Você está aproveitando as sinergias entre atributos.';
    } else {
      recommendation = 'Build moderadamente especializada. Há espaço para melhorar o equilíbrio.';
    }

    return {
      diversityScore,
      diversityPercentage: diversityScore * 100,
      diversityBonus,
      monoBuildPenalty,
      dominantAttribute: dominantAttr.name,
      dominantPercentage: dominantAttr.percentage * 100,
      isMonoBuild,
      recommendation,
    };
  }
}
