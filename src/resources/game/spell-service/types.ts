import { Spell } from '../models/spell.model';

export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface RawSpellData {
  spell_id: string;
  name: string;
  description: string;
  effect_type: Spell['effect_type'];
  mana_cost: number;
  cooldown: number;
  effect_value: number;
  duration: number;
  unlocked_at_level: number;
  is_equipped: boolean;
  slot_position: number | null;
}

export interface SpellStats {
  total_available: number;
  total_equipped: number;
  highest_level_unlocked: number;
  spells_by_type: Record<string, number>;
}
