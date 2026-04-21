import { supabase } from '@/lib/supabase';
import { CraftingIngredient, CraftingRecipe, MonsterDrop } from '../models/consumable.model';
import { MonsterDropChance } from '../models/monster.model';
import { getCharacterConsumables, getCharacterDrops } from './consumable-inventory';
import { extractErrorMessage, ServiceResponse } from './types';
import { SupabaseAdminGameRepository } from '../infrastructure/supabase/supabase-admin-game.repository';
import { ProcessCombatDropsUseCase } from '../application/use-cases/process-combat-drops.use-case';

const dropCache = new Map<string, MonsterDrop>();
const recipeCache = new Map<string, CraftingRecipe>();
let lastFetchTimestamp = 0;
const CACHE_DURATION = 300000;
const processCombatDropsUseCase = new ProcessCombatDropsUseCase(
  new SupabaseAdminGameRepository()
);

export async function getMonsterDrops(): Promise<ServiceResponse<MonsterDrop[]>> {
  try {
    const now = Date.now();
    if (now - lastFetchTimestamp < CACHE_DURATION && dropCache.size > 0) {
      return { data: Array.from(dropCache.values()), error: null, success: true };
    }
    const { data, error } = await supabase.from('monster_drops').select('*').order('rarity');
    if (error) throw error;
    dropCache.clear();
    (data as MonsterDrop[]).forEach(item => dropCache.set(item.id, item));
    lastFetchTimestamp = now;
    return { data: data as MonsterDrop[], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar drops', success: false };
  }
}

export function processMonsterDrops(
  monsterLevel: number,
  possibleDrops: MonsterDropChance[],
  chanceMultiplier = 1.0,
): { drop_id: string; quantity: number }[] {
  const obtainedDrops: { drop_id: string; quantity: number }[] = [];
  possibleDrops.forEach(drop => {
    const adjustedChance = drop.drop_chance * (1 + monsterLevel * 0.02) * chanceMultiplier;
    if (Math.random() <= Math.min(0.95, adjustedChance)) {
      const quantity = Math.floor(Math.random() * (drop.max_quantity - drop.min_quantity + 1) + drop.min_quantity);
      if (quantity > 0) {
        obtainedDrops.push({ drop_id: drop.drop_id, quantity });
      }
    }
  });
  return obtainedDrops;
}

export async function addDropsToInventory(characterId: string, drops: { drop_id: string; quantity: number }[]): Promise<ServiceResponse<number>> {
  try {
    if (drops.length === 0) {
      return { data: 0, error: null, success: true };
    }
    const data = await processCombatDropsUseCase.execute({
      characterId,
      drops,
    });
    return { data, error: null, success: true };
  } catch (error) {
    return { data: null, error: extractErrorMessage(error, 'Erro ao processar drops'), success: false };
  }
}

export async function getCraftingRecipes(): Promise<ServiceResponse<CraftingRecipe[]>> {
  try {
    const now = Date.now();
    if (now - lastFetchTimestamp < CACHE_DURATION && recipeCache.size > 0) {
      return { data: Array.from(recipeCache.values()), error: null, success: true };
    }
    const { data, error } = await supabase.from('crafting_recipes').select(`*, ingredients:crafting_ingredients (*)`);
    if (error) throw error;
    recipeCache.clear();
    (data as CraftingRecipe[]).forEach(recipe => recipeCache.set(recipe.result_id, recipe));
    lastFetchTimestamp = now;
    return { data: data as CraftingRecipe[], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar receitas', success: false };
  }
}

export async function canCraftItem(
  characterId: string,
  recipeId: string,
): Promise<ServiceResponse<{ canCraft: boolean; missingIngredients: string[] }>> {
  try {
    const { data, error } = await supabase.rpc('check_can_craft', {
      p_character_id: characterId,
      p_recipe_id: recipeId,
    });
    if (error) throw error;
    return { data: data as { canCraft: boolean; missingIngredients: string[] }, error: null, success: true };
  } catch (error) {
    return { data: null, error: extractErrorMessage(error, 'Erro ao verificar crafting'), success: false };
  }
}

export async function craftItem(characterId: string, recipeId: string): Promise<ServiceResponse<{ message: string }>> {
  try {
    const { error } = await supabase.rpc('craft_item', { p_character_id: characterId, p_recipe_id: recipeId });
    if (error) throw error;
    return { data: { message: 'Item criado com sucesso!' }, error: null, success: true };
  } catch (error) {
    return { data: null, error: extractErrorMessage(error, 'Erro ao criar item'), success: false };
  }
}

export async function checkIngredients(
  characterId: string,
  ingredients: CraftingIngredient[],
): Promise<ServiceResponse<{ hasAll: boolean; missing: string[] }>> {
  try {
    const missing: string[] = [];
    let hasAll = true;
    const [consumablesRes, dropsRes] = await Promise.all([getCharacterConsumables(characterId), getCharacterDrops(characterId)]);
    const consumables = consumablesRes.success ? consumablesRes.data : [];
    const drops = dropsRes.success ? dropsRes.data : [];

    for (const ing of ingredients) {
      if (ing.item_type === 'monster_drop') {
        const playerDrop = drops?.find(d => d.drop_id === ing.item_id);
        if (!playerDrop || playerDrop.quantity < ing.quantity) {
          hasAll = false;
          missing.push(playerDrop?.drop?.name || 'Item desconhecido');
        }
      } else if (ing.item_type === 'consumable') {
        const playerConsumable = consumables?.find(c => c.consumable_id === ing.item_id);
        if (!playerConsumable || playerConsumable.quantity < ing.quantity) {
          hasAll = false;
          missing.push(playerConsumable?.consumable?.name || 'Item desconhecido');
        }
      }
    }

    return { data: { hasAll, missing }, error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao verificar ingredientes', success: false };
  }
}

export async function getDropInfoByIds(
  dropIds: string[],
): Promise<ServiceResponse<{ id: string; name: string; description: string; rarity: string; value: number }[]>> {
  try {
    if (dropIds.length === 0) {
      return { data: [], error: null, success: true };
    }
    const { data, error } = await supabase.from('monster_drops').select('id, name, description, rarity, value').in('id', dropIds);
    if (error) throw error;
    return { data: data || [], error: null, success: true };
  } catch {
    return { data: null, error: 'Erro ao buscar informações dos drops', success: false };
  }
}
