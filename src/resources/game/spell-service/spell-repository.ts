import { supabase } from '@/lib/supabase';
import { Spell, PlayerSpell } from '../models/spell.model';
import { RawSpellData, ServiceResponse, SpellStats } from './types';

export interface AvailableSpell extends Spell {
  is_equipped: boolean;
  slot_position: number | null;
}

const spellCache = new Map<number, Spell[]>();
let lastFetchTimestamp = 0;
const CACHE_DURATION = 300000;

export function clearSpellCache(): void {
  spellCache.clear();
  lastFetchTimestamp = 0;
}

export async function getCharacterAvailableSpells(characterId: string): Promise<ServiceResponse<AvailableSpell[]>> {
  try {
    const { data, error } = await supabase.rpc('get_character_available_spells', {
      p_character_id: characterId,
    });

    if (error) {
      return { data: null, error: error.message, success: false };
    }

    const spells: AvailableSpell[] = (data || []).map((item: RawSpellData) => ({
      id: item.spell_id,
      name: item.name,
      description: item.description,
      effect_type: item.effect_type,
      mana_cost: item.mana_cost,
      cooldown: item.cooldown,
      effect_value: item.effect_value,
      duration: item.duration,
      unlocked_at_level: item.unlocked_at_level,
      is_equipped: item.is_equipped,
      slot_position: item.slot_position,
    }));

    return { data: spells, error: null, success: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erro desconhecido', success: false };
  }
}

export async function setCharacterSpells(characterId: string, spellIds: (string | null)[]): Promise<ServiceResponse<null>> {
  try {
    const [spell1, spell2, spell3] = [spellIds[0] || null, spellIds[1] || null, spellIds[2] || null];
    const { error } = await supabase.rpc('set_character_spells', {
      p_character_id: characterId,
      p_spell_1_id: spell1,
      p_spell_2_id: spell2,
      p_spell_3_id: spell3,
    });

    if (error) {
      return { data: null, error: error.message, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erro desconhecido', success: false };
  }
}

export async function getCharacterSpellStats(characterId: string): Promise<ServiceResponse<SpellStats>> {
  try {
    const { data, error } = await supabase.rpc('get_character_spell_stats', {
      p_character_id: characterId,
    });

    if (error) {
      return { data: null, error: error.message, success: false };
    }

    const stats = data?.[0] || {
      total_available: 0,
      total_equipped: 0,
      highest_level_unlocked: 1,
      spells_by_type: {},
    };

    return { data: stats, error: null, success: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erro desconhecido', success: false };
  }
}

export async function getAvailableSpells(level: number): Promise<ServiceResponse<Spell[]>> {
  const now = Date.now();
  if (spellCache.has(level) && now - lastFetchTimestamp < CACHE_DURATION) {
    return { data: spellCache.get(level) || [], error: null, success: true };
  }

  try {
    const { data, error } = await supabase.rpc('get_available_spells', { p_level: level });
    if (error) {
      return { data: null, error: error.message, success: false };
    }
    const spells = data || [];
    spellCache.set(level, spells);
    lastFetchTimestamp = now;
    return { data: spells, error: null, success: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erro desconhecido', success: false };
  }
}

export async function getCharacterEquippedSpells(characterId: string): Promise<ServiceResponse<PlayerSpell[]>> {
  try {
    const { data, error } = await supabase
      .from('character_spell_slots')
      .select(`
          slot_position,
          spell_id,
          spell:spells(
            id,
            name,
            description,
            mana_cost,
            cooldown,
            effect_type,
            effect_value,
            duration,
            unlocked_at_level
          )
        `)
      .eq('character_id', characterId)
      .not('spell_id', 'is', null)
      .order('slot_position');

    if (error) {
      return { data: null, error: error.message, success: false };
    }

    const playerSpells: PlayerSpell[] = (data || []).map(item => {
      const spell = Array.isArray(item.spell) ? item.spell[0] : item.spell;
      return {
        id: spell.id,
        name: spell.name,
        description: spell.description,
        mana_cost: spell.mana_cost,
        cooldown: spell.cooldown,
        current_cooldown: 0,
        effect_type: spell.effect_type,
        effect_value: spell.effect_value,
        duration: spell.duration || 0,
        unlocked_at_level: spell.unlocked_at_level,
      };
    });

    return { data: playerSpells, error: null, success: true };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erro desconhecido', success: false };
  }
}
