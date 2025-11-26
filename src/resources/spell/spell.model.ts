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

// ✅ CORREÇÃO: Função utilitária para identificar magias de suporte que não devem consumir turno
export function isSupportSpell(spell: Spell): boolean {
  // ✅ CORREÇÃO CRÍTICA: Buffs, heals E debuffs são considerados magias de suporte que não consomem turno
  // Isso permite combos interessantes onde o jogador pode aplicar múltiplos efeitos no mesmo turno
  return (
    spell.effect_type === 'buff' || spell.effect_type === 'heal' || spell.effect_type === 'debuff'
  );
}

// ✅ NOVA: Função para obter ícone de status baseado no tipo
export function getStatusEffectIcon(effectType: SpellEffectType): string {
  const icons = {
    buff: '🛡️',
    debuff: '💀',
    dot: '🔥',
    hot: '✨',
    damage: '⚔️',
    heal: '❤️',
  };
  return icons[effectType] || '🔮';
}

// ✅ NOVA: Função para obter ícone específico baseado no atributo afetado
export function getAttributeIcon(attribute: string): string {
  const icons = {
    atk: '⚔️',
    def: '🛡️',
    speed: '💨',
    magic_attack: '🔮',
    critical_chance: '🎯',
    critical_damage: '💥',
    strength: '💪',
    dexterity: '🏃',
    intelligence: '🧠',
    wisdom: '📚',
    vitality: '❤️',
    luck: '🍀',
  };
  return icons[attribute as keyof typeof icons] || '📊';
}

// ✅ NOVA: Função para obter cor do status
export function getStatusEffectColor(effectType: SpellEffectType): string {
  const colors = {
    buff: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    debuff: 'text-red-400 bg-red-500/20 border-red-500/30',
    dot: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
    hot: 'text-green-400 bg-green-500/20 border-green-500/30',
    damage: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    heal: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  };
  return colors[effectType] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
}
