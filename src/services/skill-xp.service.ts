import { useGameStateStore } from '@/stores/useGameStateStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

import { SkillType } from '@/models/character.model';
import { type Equipment, isDualWielding, hasShield, getMainWeapon } from '@/models/equipment.model';
import { type EquipmentSlots } from '@/models/equipment.model';
import { CharacterService } from '@/services/character.service';

export interface SkillXpGain {
  skill: SkillType;
  xp: number;
  reason: string;
  isOffHand?: boolean;
}

export class SkillXpService {
  /**
   * Calcular XP de habilidades baseado na ação de ataque
   */
  static calculateAttackSkillXp(
    equipmentSlots: EquipmentSlots | null,
    baseDamage: number
  ): SkillXpGain[] {
    const skillGains: SkillXpGain[] = [];

    if (!equipmentSlots) return skillGains;

    const mainWeapon = getMainWeapon(equipmentSlots);
    const isDual = isDualWielding(equipmentSlots);
    const baseXp = Math.max(1, Math.floor(baseDamage / 10));

    if (mainWeapon) {
      const weaponSkill = this.getWeaponSkill(mainWeapon);
      if (weaponSkill) {
        let xp = baseXp;

        if (isDual) {
          xp = Math.floor(xp * 1.25); // 25% bônus para dual-wield
          skillGains.push({
            skill: weaponSkill,
            xp,
            reason: `Ataque com ${mainWeapon.name} (Dual-wield)`,
            isOffHand: false,
          });
        } else {
          skillGains.push({
            skill: weaponSkill,
            xp,
            reason: `Ataque com ${mainWeapon.name}`,
            isOffHand: false,
          });
        }
      }
    }

    // XP para arma secundária em dual-wield
    if (isDual && equipmentSlots.off_hand) {
      const offWeaponSkill = this.getWeaponSkill(equipmentSlots.off_hand);
      if (offWeaponSkill) {
        const offXp = Math.floor(baseXp * 0.75); // 75% do XP principal
        skillGains.push({
          skill: offWeaponSkill,
          xp: offXp,
          reason: `Ataque com ${equipmentSlots.off_hand.name} (Mão secundária)`,
          isOffHand: true,
        });
      }
    }

    return skillGains;
  }

  /**
   * Calcular XP de defesa baseado na ação de defender
   */
  static calculateDefenseSkillXp(
    equipmentSlots: EquipmentSlots | null,
    damageBlocked: number = 0
  ): SkillXpGain[] {
    let baseXp = Math.max(2, Math.floor(damageBlocked / 5));
    let reason = 'Ação de defesa';

    // XP mínimo se não houve dano bloqueado
    if (damageBlocked <= 0) {
      baseXp = 3;
    }

    // Bônus para escudo
    if (equipmentSlots && hasShield(equipmentSlots)) {
      baseXp = Math.floor(baseXp * 2.5); // 150% bônus com escudo
      reason = 'Defesa com escudo equipado';
    }

    const finalXp = Math.max(1, Math.floor(baseXp));

    console.log(`[SkillXpService] XP de defesa: ${finalXp} (dano bloqueado: ${damageBlocked})`);

    return [
      {
        skill: SkillType.DEFENSE_MASTERY,
        xp: finalXp,
        reason,
        isOffHand: false,
      },
    ];
  }

  /**
   * Calcular XP de magia baseado no uso de magias
   */
  static calculateMagicSkillXp(
    spellManaCost: number,
    spellDamage: number = 0,
    actualSpellValue: number = 0,
    equipmentSlots: EquipmentSlots | null = null
  ): SkillXpGain[] {
    const skillGains: SkillXpGain[] = [];

    // XP baseado no custo de mana + valor real da magia
    const manaXp = Math.floor(spellManaCost / 2);
    let valueXp = 0;

    if (actualSpellValue > 0) {
      valueXp = Math.floor(actualSpellValue / 8);
    } else if (spellDamage > 0) {
      valueXp = Math.floor(spellDamage / 8);
    }

    const totalXp = Math.max(2, manaXp + valueXp);

    skillGains.push({
      skill: SkillType.MAGIC_MASTERY,
      xp: totalXp,
      reason: `Uso de magia (${spellManaCost} mana, ${actualSpellValue || spellDamage} efeito)`,
      isOffHand: false,
    });

    // Bônus para varinha/staff na off-hand
    if (equipmentSlots?.off_hand?.weapon_subtype === 'staff') {
      const bonusXp = Math.max(1, Math.floor(totalXp * 0.2)); // 20% bônus
      skillGains.push({
        skill: SkillType.MAGIC_MASTERY,
        xp: bonusXp,
        reason: `Bônus por ${equipmentSlots.off_hand.name} (off-hand)`,
        isOffHand: true,
      });
    }

    return skillGains;
  }

  /**
   * Determinar habilidade baseada no tipo de arma
   */
  private static getWeaponSkill(weapon: Equipment): SkillType | null {
    const weaponName = weapon.name.toLowerCase();

    const skillMap = [
      {
        keywords: ['espada', 'sword', 'rapier', 'lâmina', 'adaga', 'dagger', 'punhal', 'fang'],
        skill: SkillType.SWORD_MASTERY,
      },
      { keywords: ['machado', 'axe', 'machadinha'], skill: SkillType.AXE_MASTERY },
      {
        keywords: ['martelo', 'mace', 'clava', 'maça', 'porrete', 'hammer'],
        skill: SkillType.BLUNT_MASTERY,
      },
      {
        keywords: ['cajado', 'staff', 'varinha', 'orbe', 'bastão', 'cetro'],
        skill: SkillType.MAGIC_MASTERY,
      },
    ];

    for (const { keywords, skill } of skillMap) {
      if (keywords.some(keyword => weaponName.includes(keyword))) {
        return skill;
      }
    }

    // Default para espada
    return SkillType.SWORD_MASTERY;
  }

  /**
   * Aplicar XP de habilidades para um personagem
   * Agora integrado com stores para sincronização automática
   */
  static async applySkillXp(
    characterId: string,
    skillGains: SkillXpGain[]
  ): Promise<{ messages: string[]; skillLevelUps: Array<{ skill: SkillType; newLevel: number }> }> {
    const messages: string[] = [];
    const skillLevelUps: Array<{ skill: SkillType; newLevel: number }> = [];

    if (skillGains.length === 0) {
      return { messages, skillLevelUps };
    }

    console.log(`[SkillXpService] Aplicando ${skillGains.length} ganhos de XP para ${characterId}`);

    // Acessar stores para sincronização
    const { gameState, updateGameState } = useGameStateStore.getState();
    const { setSelectedCharacter } = useCharacterStore.getState();

    for (const gain of skillGains) {
      try {
        const result = await CharacterService.addSkillXp(characterId, gain.skill, gain.xp);

        if (result.success && result.data) {
          const skillDisplayName = this.getSkillDisplayName(gain.skill);
          const offHandIndicator = gain.isOffHand ? ' (off-hand)' : '';

          if (result.data.skill_leveled_up) {
            const levelUpMessage = `🎉 ${skillDisplayName} subiu para nível ${result.data.new_skill_level}!${offHandIndicator}`;
            messages.push(levelUpMessage);
            skillLevelUps.push({
              skill: gain.skill,
              newLevel: result.data.new_skill_level,
            });
            console.log(`[SkillXpService] ${levelUpMessage}`);
          } else {
            const xpMessage = `+${gain.xp} XP em ${skillDisplayName}${offHandIndicator}`;
            messages.push(xpMessage);
            console.log(`[SkillXpService] ${xpMessage} (${gain.reason})`);
          }

          // Sincronizar com gameState se for o jogador atual
          if (gameState.player?.id === characterId) {
            updateGameState(draft => {
              if (draft.player && result.data) {
                // Atualizar nível da habilidade no player
                const skillKey = this.getSkillKey(gain.skill);
                if (skillKey && skillKey in draft.player) {
                  (draft.player as unknown as Record<string, number>)[skillKey] =
                    result.data.new_skill_level;

                  // Atualizar XP da habilidade se disponível
                  const xpKey = `${skillKey}_xp`;
                  if (xpKey in draft.player) {
                    (draft.player as unknown as Record<string, number>)[xpKey] =
                      result.data.new_skill_xp;
                  }
                }
              }
            });

            // Buscar dados atualizados do personagem para sincronização completa
            try {
              const updatedCharacter = await CharacterService.getCharacter(characterId);
              if (updatedCharacter.success && updatedCharacter.data) {
                setSelectedCharacter(updatedCharacter.data);
              }
            } catch (error) {
              console.warn('[SkillXpService] Erro ao sincronizar personagem:', error);
            }
          }
        } else {
          console.error(`[SkillXpService] Erro ao aplicar XP de ${gain.skill}:`, result.error);
        }
      } catch (error) {
        console.error(`[SkillXpService] Exceção ao aplicar XP de ${gain.skill}:`, error);
      }
    }

    return { messages, skillLevelUps };
  }

  /**
   * Obter chave da habilidade no modelo do personagem
   * @private
   */
  private static getSkillKey(skill: SkillType): string | null {
    const skillKeys = {
      [SkillType.SWORD_MASTERY]: 'sword_mastery',
      [SkillType.AXE_MASTERY]: 'axe_mastery',
      [SkillType.BLUNT_MASTERY]: 'blunt_mastery',
      [SkillType.DEFENSE_MASTERY]: 'defense_mastery',
      [SkillType.MAGIC_MASTERY]: 'magic_mastery',
    };
    return skillKeys[skill] || null;
  }

  /**
   * Obter nome de exibição da habilidade
   */
  static getSkillDisplayName(skill: SkillType): string {
    const skillNames = {
      [SkillType.SWORD_MASTERY]: 'Maestria em Espadas',
      [SkillType.AXE_MASTERY]: 'Maestria em Machados',
      [SkillType.BLUNT_MASTERY]: 'Maestria em Armas de Concussão',
      [SkillType.DEFENSE_MASTERY]: 'Maestria em Defesa',
      [SkillType.MAGIC_MASTERY]: 'Maestria em Magia',
    };
    return skillNames[skill] || skill;
  }

  /**
   * Calcular bônus de dano baseado no nível de habilidade
   */
  static calculateSkillDamageBonus(skillLevel: number): number {
    // Cada nível adiciona 2% de dano (max 100% no nível 50)
    return Math.min(100, skillLevel * 2);
  }

  /**
   * Calcular bônus de defesa baseado no nível de maestria defensiva
   */
  static calculateSkillDefenseBonus(defenseLevel: number): number {
    // Cada nível adiciona 1% de redução de dano (max 50% no nível 50)
    return Math.min(50, defenseLevel * 1);
  }

  /**
   * Calcular eficiência de mana baseado no nível de maestria mágica
   */
  static calculateManaEfficiency(magicLevel: number): number {
    // Cada nível reduz 1% do custo de mana (max 40% no nível 40)
    return Math.min(40, magicLevel * 1);
  }

  /**
   * Aplicar XP de habilidades para o jogador atual (método utilitário)
   */
  static async applySkillXpToCurrentPlayer(skillGains: SkillXpGain[]): Promise<string[]> {
    const { gameState } = useGameStateStore.getState();

    if (!gameState.player?.id) {
      console.warn('[SkillXpService] Nenhum jogador ativo para aplicar XP');
      return [];
    }

    const result = await this.applySkillXp(gameState.player.id, skillGains);
    return result.messages;
  }

  /**
   * Obter níveis de habilidades do jogador atual
   */
  static getCurrentPlayerSkillLevels(): Record<SkillType, number> {
    const { gameState } = useGameStateStore.getState();
    const player = gameState.player;

    if (!player) {
      return {
        [SkillType.SWORD_MASTERY]: 1,
        [SkillType.AXE_MASTERY]: 1,
        [SkillType.BLUNT_MASTERY]: 1,
        [SkillType.DEFENSE_MASTERY]: 1,
        [SkillType.MAGIC_MASTERY]: 1,
      };
    }

    return {
      [SkillType.SWORD_MASTERY]: player.sword_mastery || 1,
      [SkillType.AXE_MASTERY]: player.axe_mastery || 1,
      [SkillType.BLUNT_MASTERY]: player.blunt_mastery || 1,
      [SkillType.DEFENSE_MASTERY]: player.defense_mastery || 1,
      [SkillType.MAGIC_MASTERY]: player.magic_mastery || 1,
    };
  }
}
