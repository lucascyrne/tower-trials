import { supabase } from '@/lib/supabase';
import { Character } from '../models/character.model';
import { Consumable, CharacterConsumable, MonsterDrop } from '../models/consumable.model';
import { GamePlayer } from '../game-model';
import { extractErrorMessage, ServiceResponse } from './types';

const consumableCache = new Map<string, Consumable>();
let lastFetchTimestamp = 0;
const CACHE_DURATION = 300000;

export async function getAvailableConsumables(): Promise<ServiceResponse<Consumable[]>> {
  try {
    const now = Date.now();
    if (now - lastFetchTimestamp < CACHE_DURATION && consumableCache.size > 0) {
      return { data: Array.from(consumableCache.values()), error: null, success: true };
    }

    const { data, error } = await supabase.from('consumables').select('*').order('price');
    if (error) throw error;

    consumableCache.clear();
    (data as Consumable[]).forEach(item => consumableCache.set(item.id, item));
    lastFetchTimestamp = now;
    return { data: data as Consumable[], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar consumíveis', success: false };
  }
}

export async function getCharacterConsumables(characterId: string): Promise<ServiceResponse<CharacterConsumable[]>> {
  try {
    const { data, error } = await supabase
      .from('character_consumables')
      .select(`*, consumable:consumable_id (*)`)
      .eq('character_id', characterId);
    if (error) throw error;
    return { data: data as CharacterConsumable[], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar consumíveis do personagem', success: false };
  }
}

export async function buyConsumable(characterId: string, consumableId: string, quantity = 1): Promise<ServiceResponse<{ newGold: number }>> {
  try {
    const { data, error } = await supabase
      .rpc('buy_consumable', {
        p_character_id: characterId,
        p_consumable_id: consumableId,
        p_quantity: quantity,
      })
      .single();
    if (error) throw error;
    return { data: { newGold: data as number }, error: null, success: true };
  } catch (error) {
    return { data: null, error: extractErrorMessage(error, 'Erro ao comprar consumível'), success: false };
  }
}

export async function consumeItem(
  characterId: string,
  consumableId: string,
  character: Character | GamePlayer,
): Promise<ServiceResponse<{ message: string }>> {
  try {
    const { data, error } = await supabase
      .from('character_consumables')
      .select(`*, consumable:consumable_id (*)`)
      .eq('character_id', characterId)
      .eq('consumable_id', consumableId)
      .single();

    if (error) throw error;

    const characterConsumable = data as CharacterConsumable;
    if (!characterConsumable || characterConsumable.quantity <= 0) {
      return { data: null, error: 'Você não possui este item', success: false };
    }

    const consumable = characterConsumable.consumable!;
    let message = '';
    const statsToUpdate: { hp?: number; mana?: number } = {};

    switch (consumable.type) {
      case 'potion':
        if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
          const newHp = Math.min(character.max_hp, character.hp + consumable.effect_value);
          const actualHealing = newHp - character.hp;
          character.hp = newHp;
          statsToUpdate.hp = newHp;
          message = actualHealing > 0 ? `Recuperou ${actualHealing} HP!` : 'HP já estava no máximo!';
        } else if (consumable.description.includes('Mana')) {
          const newMana = Math.min(character.max_mana, character.mana + consumable.effect_value);
          const actualRecovery = newMana - character.mana;
          character.mana = newMana;
          statsToUpdate.mana = newMana;
          message = actualRecovery > 0 ? `Recuperou ${actualRecovery} Mana!` : 'Mana já estava no máximo!';
        }
        break;
      case 'antidote':
        if ('active_effects' in character) {
          character.active_effects.debuffs = [];
          character.active_effects.dots = [];
          message = 'Todos os efeitos negativos foram removidos!';
        } else {
          message = 'Antídoto só pode ser usado durante batalhas!';
        }
        break;
      case 'buff':
        if ('active_effects' in character) {
          if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
            character.atk += consumable.effect_value;
            character.active_effects.buffs.push({ type: 'buff', value: consumable.effect_value, duration: 3, source_spell: 'elixir_strength' });
            message = `Ataque aumentado em ${consumable.effect_value} por 3 turnos!`;
          } else if (consumable.description.includes('Defesa') || consumable.description.includes('defesa')) {
            character.def += consumable.effect_value;
            character.active_effects.buffs.push({ type: 'buff', value: consumable.effect_value, duration: 3, source_spell: 'elixir_defense' });
            message = `Defesa aumentada em ${consumable.effect_value} por 3 turnos!`;
          }
        } else {
          message = 'Elixires só podem ser usados durante batalhas!';
        }
        break;
    }

    const { error: updateError } = await supabase.rpc('use_consumable', {
      p_character_id: characterId,
      p_consumable_id: consumableId,
    });
    if (updateError) throw updateError;

    if (Object.keys(statsToUpdate).length > 0) {
      const { error: statsError } = await supabase.from('characters').update(statsToUpdate).eq('id', characterId);
      if (statsError) throw statsError;
    }

    return { data: { message }, error: null, success: true };
  } catch (error) {
    return { data: null, error: extractErrorMessage(error, 'Erro ao usar consumível'), success: false };
  }
}

export async function getCharacterDrops(
  characterId: string,
): Promise<ServiceResponse<{ id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[]>> {
  try {
    const { data, error } = await supabase
      .from('character_drops')
      .select(`*, drop:drop_id (*)`)
      .eq('character_id', characterId);
    if (error) throw error;
    return { data: data as { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar drops do personagem', success: false };
  }
}
