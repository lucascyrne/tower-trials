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

// Interface para efeitos ativos no personagem/inimigo
export interface ActiveEffects {
  buffs: SpellEffect[];
  debuffs: SpellEffect[];
  dots: SpellEffect[];
  hots: SpellEffect[];
} 