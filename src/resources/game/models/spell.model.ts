export type SpellEffectType = 'damage' | 'heal' | 'buff' | 'debuff' | 'dot' | 'hot';

export interface Spell {
  id: string;
  name: string;
  description: string;
  effect_type: SpellEffectType;
  mana_cost: number;
  cooldown: number;
  effect_value: number;
  duration: number;
  unlocked_at_level: number;
}

export interface PlayerSpell extends Spell {
  current_cooldown: number;
}

export interface SpellEffect {
  type: SpellEffectType;
  value: number;
  duration: number;
  source_spell: string; // ID da magia que causou o efeito
}

// Interface para modificações temporárias de atributos específicos
export interface AttributeModification {
  attribute: 'atk' | 'def' | 'speed' | 'magic_attack' | 'critical_chance' | 'critical_damage';
  value: number;
  type: 'flat' | 'percentage'; // Flat = +10, Percentage = +15%
  duration: number;
  source_spell: string;
  applied_at: number; // timestamp para controle de duração
}

// Interface para efeitos ativos no personagem/inimigo
export interface ActiveEffects {
  buffs: SpellEffect[];
  debuffs: SpellEffect[];
  dots: SpellEffect[];
  hots: SpellEffect[];
  attribute_modifications: AttributeModification[]; // Nova propriedade
} 