import { AttributeModification, Spell, SpellEffectType } from '../models/spell.model';

export function getSpellTypeIcon(effectType: SpellEffectType): string {
  const icons = {
    damage: '⚔️',
    heal: '❤️',
    buff: '🛡️',
    debuff: '💀',
    dot: '🔥',
    hot: '✨',
  };
  return icons[effectType] || '🔮';
}

export function getSpellTypeColor(effectType: SpellEffectType): string {
  const colors = {
    damage: 'text-red-500',
    heal: 'text-green-500',
    buff: 'text-blue-500',
    debuff: 'text-purple-500',
    dot: 'text-orange-500',
    hot: 'text-emerald-500',
  };
  return colors[effectType] || 'text-gray-500';
}

export function translateEffectType(effectType: SpellEffectType): string {
  const translations = {
    damage: 'Dano',
    heal: 'Cura',
    buff: 'Benefício',
    debuff: 'Maldição',
    dot: 'Dano Contínuo',
    hot: 'Cura Contínua',
  };
  return translations[effectType] || effectType;
}

export function translateAttributeName(attribute: string): string {
  const translations = {
    atk: 'Ataque',
    def: 'Defesa',
    speed: 'Velocidade',
    magic_attack: 'Ataque Mágico',
    critical_chance: 'Chance Crítica',
    critical_damage: 'Dano Crítico',
  };
  return translations[attribute as keyof typeof translations] || attribute;
}

export function getAttributeModificationsForSpell(spell: Spell): AttributeModification[] {
  const modifications: AttributeModification[] = [];
  const now = Date.now();
  const spellName = spell.name.toLowerCase();

  if (spellName.includes('força') || spellName.includes('strength') || spellName.includes('fortalecer')) {
    modifications.push({
      attribute: 'atk',
      value: Math.floor(spell.effect_value * 0.5),
      type: 'flat',
      duration: spell.duration,
      source_spell: spell.name,
      applied_at: now,
    });
  }

  if (spellName.includes('velocidade') || spellName.includes('speed') || spellName.includes('agilidade')) {
    modifications.push({
      attribute: 'speed',
      value: Math.floor(spell.effect_value * 0.3),
      type: 'flat',
      duration: spell.duration,
      source_spell: spell.name,
      applied_at: now,
    });
  }

  if (spellName.includes('defesa') || spellName.includes('defense') || spellName.includes('proteção')) {
    modifications.push({
      attribute: 'def',
      value: Math.floor(spell.effect_value * 0.4),
      type: 'flat',
      duration: spell.duration,
      source_spell: spell.name,
      applied_at: now,
    });
  }

  if (spellName.includes('crítico') || spellName.includes('critical') || spellName.includes('precisão')) {
    modifications.push({
      attribute: 'critical_chance',
      value: Math.floor(spell.effect_value * 0.2),
      type: 'percentage',
      duration: spell.duration,
      source_spell: spell.name,
      applied_at: now,
    });
  }

  if (spellName.includes('magia') || spellName.includes('magic') || spellName.includes('mystic')) {
    modifications.push({
      attribute: 'magic_attack',
      value: Math.floor(spell.effect_value * 0.6),
      type: 'flat',
      duration: spell.duration,
      source_spell: spell.name,
      applied_at: now,
    });
  }

  return modifications;
}
