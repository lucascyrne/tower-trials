import { SkillType } from './models/character.model';
import { Equipment, isDualWielding, hasShield, getMainWeapon } from './models/equipment.model';
import { EquipmentSlots } from './models/equipment.model';

export interface SkillXpGain {
  skill: SkillType;
  xp: number;
  reason: string;
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
    
    if (!equipmentSlots) {
      return skillGains;
    }

    const mainWeapon = getMainWeapon(equipmentSlots);
    const isDual = isDualWielding(equipmentSlots);
    
    // XP base baseado no dano causado (1 XP por 10 de dano, mínimo 1)
    const baseXp = Math.max(1, Math.floor(baseDamage / 10));
    
    if (mainWeapon) {
      const weaponSkill = this.getWeaponSkill(mainWeapon);
      if (weaponSkill) {
        let xp = baseXp;
        
        // Bônus para dual-wielding
        if (isDual) {
          xp = Math.floor(xp * 1.25); // 25% mais XP
          skillGains.push({
            skill: weaponSkill,
            xp,
            reason: `Ataque com ${mainWeapon.name} (Dual-wield)`
          });
        } else {
          skillGains.push({
            skill: weaponSkill,
            xp,
            reason: `Ataque com ${mainWeapon.name}`
          });
        }
      }
    }
    
    // Se está em dual-wield, dar XP também para a arma secundária
    if (isDual && equipmentSlots.off_hand) {
      const offWeaponSkill = this.getWeaponSkill(equipmentSlots.off_hand);
      if (offWeaponSkill) {
        const offXp = Math.floor(baseXp * 0.75); // 75% do XP principal
        skillGains.push({
          skill: offWeaponSkill,
          xp: offXp,
          reason: `Ataque com ${equipmentSlots.off_hand.name} (Mão secundária)`
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
    const skillGains: SkillXpGain[] = [];
    
    // XP base para defesa (2-5 XP por uso da ação defender)
    let baseXp = Math.max(2, Math.floor(damageBlocked / 5));
    let reason = 'Ação de defesa';
    
    // Bônus significativo se tiver escudo equipado
    if (equipmentSlots && hasShield(equipmentSlots)) {
      baseXp = Math.floor(baseXp * 2.5); // 150% mais XP com escudo
      reason = `Defesa com escudo equipado`;
    }
    
    skillGains.push({
      skill: SkillType.DEFENSE_MASTERY,
      xp: baseXp,
      reason
    });
    
    return skillGains;
  }

  /**
   * Calcular XP de magia baseado no uso de magias
   */
  static calculateMagicSkillXp(
    spellManaCost: number,
    spellDamage: number = 0
  ): SkillXpGain[] {
    const skillGains: SkillXpGain[] = [];
    
    // XP baseado no custo de mana + dano (1 XP por 2 de mana + 1 XP por 8 de dano)
    const manaXp = Math.floor(spellManaCost / 2);
    const damageXp = Math.floor(spellDamage / 8);
    const totalXp = Math.max(1, manaXp + damageXp);
    
    skillGains.push({
      skill: SkillType.MAGIC_MASTERY,
      xp: totalXp,
      reason: `Uso de magia (${spellManaCost} mana)`
    });
    
    return skillGains;
  }

  /**
   * Determinar habilidade baseada no tipo de arma
   */
  private static getWeaponSkill(weapon: Equipment): SkillType | null {
    const weaponName = weapon.name.toLowerCase();
    
    // Verificar por palavras-chave no nome da arma
    if (weaponName.includes('espada') || weaponName.includes('sword') || 
        weaponName.includes('rapier') || weaponName.includes('lâmina')) {
      return SkillType.SWORD_MASTERY;
    }
    
    if (weaponName.includes('machado') || weaponName.includes('axe') || 
        weaponName.includes('machadinha')) {
      return SkillType.AXE_MASTERY;
    }
    
    if (weaponName.includes('martelo') || weaponName.includes('mace') || 
        weaponName.includes('clava') || weaponName.includes('maça') ||
        weaponName.includes('porrete') || weaponName.includes('hammer')) {
      return SkillType.BLUNT_MASTERY;
    }
    
    // Armas mágicas (cajados, varinhas, orbes)
    if (weaponName.includes('cajado') || weaponName.includes('staff') || 
        weaponName.includes('varinha') || weaponName.includes('orbe') ||
        weaponName.includes('bastão') || weaponName.includes('cetro')) {
      return SkillType.MAGIC_MASTERY;
    }
    
    // Adagas e punhais - usar maestria em espadas por enquanto
    if (weaponName.includes('adaga') || weaponName.includes('dagger') || 
        weaponName.includes('punhal') || weaponName.includes('fang')) {
      return SkillType.SWORD_MASTERY;
    }
    
    // Default para espada se não conseguir determinar
    return SkillType.SWORD_MASTERY;
  }

  /**
   * Aplicar XP de habilidades para um personagem
   */
  static async applySkillXp(
    characterId: string,
    skillGains: SkillXpGain[]
  ): Promise<{ messages: string[], skillLevelUps: Array<{ skill: SkillType, newLevel: number }> }> {
    const { CharacterService } = await import('./character.service');
    
    const messages: string[] = [];
    const skillLevelUps: Array<{ skill: SkillType, newLevel: number }> = [];
    
    for (const gain of skillGains) {
      try {
        const result = await CharacterService.addSkillXp(characterId, gain.skill, gain.xp);
        
        if (result.success && result.data) {
          // Adicionar mensagem de XP ganho
          messages.push(`+${gain.xp} XP em ${this.getSkillDisplayName(gain.skill)} (${gain.reason})`);
          
          // Verificar se houve level up
          if (result.data.skill_leveled_up) {
            skillLevelUps.push({
              skill: gain.skill,
              newLevel: result.data.new_skill_level
            });
            messages.push(`🎉 ${this.getSkillDisplayName(gain.skill)} aumentou para nível ${result.data.new_skill_level}!`);
          }
        }
      } catch (error) {
        console.error(`Erro ao aplicar XP de habilidade ${gain.skill}:`, error);
      }
    }
    
    return { messages, skillLevelUps };
  }

  /**
   * Obter nome de exibição da habilidade
   */
  static getSkillDisplayName(skill: SkillType): string {
    switch (skill) {
      case SkillType.SWORD_MASTERY: return 'Maestria em Espadas';
      case SkillType.AXE_MASTERY: return 'Maestria em Machados';
      case SkillType.BLUNT_MASTERY: return 'Maestria em Armas de Concussão';
      case SkillType.DEFENSE_MASTERY: return 'Maestria em Defesa';
      case SkillType.MAGIC_MASTERY: return 'Maestria em Magia';
      default: return skill;
    }
  }

  /**
   * Calcular bônus de dano baseado no nível de habilidade
   */
  static calculateSkillDamageBonus(skill: SkillType, skillLevel: number): number {
    // Cada nível de habilidade adiciona 2% de dano (max 100% no nível 50)
    return Math.min(100, skillLevel * 2);
  }

  /**
   * Calcular bônus de defesa baseado no nível de maestria defensiva
   */
  static calculateSkillDefenseBonus(defenseLevel: number): number {
    // Cada nível de defesa adiciona 1% de redução de dano (max 50% no nível 50)
    return Math.min(50, defenseLevel * 1);
  }

  /**
   * Calcular eficiência de mana baseado no nível de maestria mágica
   */
  static calculateManaEfficiency(magicLevel: number): number {
    // Cada nível reduz 1% do custo de mana (max 40% no nível 40)
    return Math.min(40, magicLevel * 1);
  }
} 