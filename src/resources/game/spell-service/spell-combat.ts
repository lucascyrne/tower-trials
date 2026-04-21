import { Enemy, GamePlayer, GameState } from '../game-model';
import { PlayerSpell, Spell } from '../models/spell.model';
import { getAttributeModificationsForSpell, translateAttributeName } from './spell-ui-helpers';

export function calculateScaledSpellDamage(baseDamage: number, caster: GamePlayer | Enemy): number {
  if (!('intelligence' in caster) || !('wisdom' in caster) || !('magic_mastery' in caster)) {
    return baseDamage;
  }

  const intelligence = caster.intelligence || 10;
  const wisdom = caster.wisdom || 10;
  const magicMastery = caster.magic_mastery || 1;
  const intScaling = Math.pow(Math.max(1, intelligence), 1.15) * 1.05;
  const wisScaling = Math.pow(Math.max(1, wisdom), 1.08) * 0.85;
  const masteryScaling = Math.pow(Math.max(1, magicMastery), 1.08) * 1.15;
  let totalBonus = intScaling + wisScaling + masteryScaling;

  if (totalBonus > 75) {
    totalBonus = 75 + (totalBonus - 75) * 0.45;
  }

  totalBonus = Math.min(120, totalBonus);
  return Math.round(baseDamage * (1 + totalBonus / 100));
}

export function calculateScaledSpellHealing(baseHealing: number, caster: GamePlayer | Enemy): number {
  if (!('wisdom' in caster) || !('magic_mastery' in caster)) {
    return baseHealing;
  }

  const wisdom = caster.wisdom || 10;
  const magicMastery = caster.magic_mastery || 1;
  const wisScaling = Math.pow(Math.max(1, wisdom), 1.12) * 1.35;
  const masteryScaling = Math.pow(Math.max(1, magicMastery), 1.06) * 1.1;
  let totalBonus = wisScaling + masteryScaling;

  if (totalBonus > 70) {
    totalBonus = 70 + (totalBonus - 70) * 0.45;
  }

  totalBonus = Math.min(130, totalBonus);
  return Math.round(baseHealing * (1 + totalBonus / 100));
}

export function applySpellEffect(spell: Spell, caster: GamePlayer | Enemy, target: GamePlayer | Enemy): { message: string; success: boolean } {
  let message = '';
  let success = true;

  switch (spell.effect_type) {
    case 'damage': {
      const scaledDamage = calculateScaledSpellDamage(spell.effect_value, caster);
      target.hp = Math.max(0, target.hp - scaledDamage);
      message = `${spell.name} causou ${scaledDamage} de dano mágico!`;
      break;
    }
    case 'heal': {
      const scaledHealing = calculateScaledSpellHealing(spell.effect_value, caster);
      const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
      const oldHp = target.hp;
      target.hp = Math.min(maxHp, target.hp + scaledHealing);
      message = `${spell.name} restaurou ${target.hp - oldHp} HP!`;
      break;
    }
    case 'buff': {
      if (target.active_effects) {
        const buffValue = calculateScaledSpellDamage(spell.effect_value, caster);
        target.active_effects.buffs.push({ type: 'buff', value: buffValue, duration: spell.duration, source_spell: spell.name });
        const attributeModifications = getAttributeModificationsForSpell(spell);
        if (attributeModifications.length > 0) {
          if (!target.active_effects.attribute_modifications) {
            target.active_effects.attribute_modifications = [];
          }
          target.active_effects.attribute_modifications.push(...attributeModifications);
          const modMessages = attributeModifications
            .map(mod => `+${mod.value}${mod.type === 'percentage' ? '%' : ''} ${translateAttributeName(mod.attribute)}`)
            .join(', ');
          message = `${spell.name} aumentou: ${modMessages}!`;
        } else {
          message = `${spell.name} aplicou um efeito benéfico (+${buffValue})!`;
        }
      }
      break;
    }
    case 'debuff': {
      if (target.active_effects) {
        const debuffValue = calculateScaledSpellDamage(spell.effect_value, caster);
        target.active_effects.debuffs.push({ type: 'debuff', value: debuffValue, duration: spell.duration, source_spell: spell.name });
        message = `${spell.name} aplicou um efeito prejudicial (-${debuffValue})!`;
      }
      break;
    }
    case 'dot': {
      if (target.active_effects) {
        const dotDamage = calculateScaledSpellDamage(spell.effect_value, caster);
        target.active_effects.dots.push({ type: 'dot', value: dotDamage, duration: spell.duration, source_spell: spell.name });
        message = `${spell.name} aplicou dano contínuo (${dotDamage} por ${spell.duration} turnos)!`;
      }
      break;
    }
    case 'hot': {
      if (target.active_effects) {
        const hotHealing = calculateScaledSpellHealing(spell.effect_value, caster);
        target.active_effects.hots.push({ type: 'hot', value: hotHealing, duration: spell.duration, source_spell: spell.name });
        message = `${spell.name} aplicou cura contínua (${hotHealing} por ${spell.duration} turnos)!`;
      }
      break;
    }
    default:
      message = `${spell.name} foi usado, mas não teve efeito!`;
      success = false;
  }

  return { message, success };
}

export function processOverTimeEffects(target: GamePlayer | Enemy): string[] {
  const messages: string[] = [];
  if ('active_effects' in target && target.active_effects) {
    target.active_effects.dots = target.active_effects.dots.filter(effect => {
      target.hp = Math.max(0, target.hp - effect.value);
      effect.duration -= 1;
      messages.push(`${effect.source_spell} causou ${effect.value} de dano contínuo.`);
      return effect.duration > 0;
    });

    target.active_effects.hots = target.active_effects.hots.filter(effect => {
      const maxHp = 'max_hp' in target ? target.max_hp : target.maxHp;
      const oldHp = target.hp;
      target.hp = Math.min(maxHp, target.hp + effect.value);
      const actualHeal = target.hp - oldHp;
      effect.duration -= 1;
      if (actualHeal > 0) {
        messages.push(`${effect.source_spell} restaurou ${actualHeal} HP.`);
      }
      return effect.duration > 0;
    });

    if (target.active_effects.attribute_modifications) {
      target.active_effects.attribute_modifications = target.active_effects.attribute_modifications.filter(mod => {
        mod.duration -= 1;
        if (mod.duration <= 0) {
          messages.push(`O efeito de ${mod.source_spell} em ${translateAttributeName(mod.attribute)} expirou.`);
          return false;
        }
        return true;
      });
    }
  }
  return messages;
}

export function updateSpellCooldowns(gameState: GameState): GameState {
  gameState.player.spells.forEach((spell: PlayerSpell) => {
    if (spell.current_cooldown > 0) {
      spell.current_cooldown -= 1;
    }
  });
  return gameState;
}
