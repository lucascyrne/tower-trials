import { supabase } from '@/lib/supabase';
import {
  type Consumable,
  type CharacterConsumable,
  type CraftingRecipe,
  type MonsterDrop,
  type CraftingIngredient,
} from './models/consumable.model';
import { type GamePlayer } from './game-model';
import { type MonsterDropChance } from './models/monster.model';
import { type Character } from './models/character.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * Extrair mensagem de erro específica do Supabase/PostgreSQL
 * @param error Objeto de erro
 * @param fallbackMessage Mensagem padrão caso não consiga extrair
 * @returns Mensagem de erro específica
 */
function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === 'object') {
    // Erro do Supabase/PostgreSQL
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    // Fallback para Error padrão
    if (error instanceof Error) {
      return error.message;
    }
  }
  return fallbackMessage;
}

export class ConsumableService {
  private static consumableCache: Map<string, Consumable> = new Map();
  private static dropCache: Map<string, MonsterDrop> = new Map();
  private static recipeCache: Map<string, CraftingRecipe> = new Map();
  private static lastFetchTimestamp: number = 0;
  private static CACHE_DURATION = 300000; // 5 minutos

  /**
   * Buscar todos os consumíveis disponíveis
   * @returns Lista de consumíveis
   */
  static async getAvailableConsumables(): Promise<ServiceResponse<Consumable[]>> {
    try {
      // Verificar cache
      const now = Date.now();
      if (now - this.lastFetchTimestamp < this.CACHE_DURATION && this.consumableCache.size > 0) {
        const cachedConsumables = Array.from(this.consumableCache.values());
        return { data: cachedConsumables, error: null, success: true };
      }

      const { data, error } = await supabase.from('consumables').select('*').order('price');

      if (error) throw error;

      // Atualizar cache
      this.consumableCache.clear();
      (data as Consumable[]).forEach(item => {
        this.consumableCache.set(item.id, item);
      });
      this.lastFetchTimestamp = now;

      return { data: data as Consumable[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar consumíveis:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar consumíveis', success: false };
    }
  }

  /**
   * Buscar consumíveis do personagem
   * @param characterId ID do personagem
   * @returns Lista de consumíveis do personagem
   */
  static async getCharacterConsumables(
    characterId: string
  ): Promise<ServiceResponse<CharacterConsumable[]>> {
    try {
      const { data, error } = await supabase
        .from('character_consumables')
        .select(
          `
          *,
          consumable:consumable_id (*)
        `
        )
        .eq('character_id', characterId);

      if (error) throw error;

      return { data: data as CharacterConsumable[], error: null, success: true };
    } catch (error) {
      console.error(
        'Erro ao buscar consumíveis do personagem:',
        error instanceof Error ? error.message : error
      );
      return { data: null, error: 'Erro ao buscar consumíveis do personagem', success: false };
    }
  }

  /**
   * Comprar um consumível
   * @param characterId ID do personagem
   * @param consumableId ID do consumível
   * @param quantity Quantidade a comprar
   * @returns Resultado da operação com novo gold
   */
  static async buyConsumable(
    characterId: string,
    consumableId: string,
    quantity: number = 1
  ): Promise<ServiceResponse<{ newGold: number }>> {
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
      console.error('Erro ao comprar consumível:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao comprar consumível'),
        success: false,
      };
    }
  }

  /**
   * Usar um consumível
   * @param characterId ID do personagem
   * @param consumableId ID do consumível
   * @param player Estado atual do jogador (para aplicar efeitos)
   * @returns Resultado da operação
   */
  static async consumeItem(
    characterId: string,
    consumableId: string,
    character: Character | GamePlayer
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      // Verificar se o jogador possui o consumível
      const { data, error } = await supabase
        .from('character_consumables')
        .select(
          `
          *,
          consumable:consumable_id (*)
        `
        )
        .eq('character_id', characterId)
        .eq('consumable_id', consumableId)
        .single();

      if (error) throw error;

      const characterConsumable = data as CharacterConsumable;
      if (!characterConsumable || characterConsumable.quantity <= 0) {
        return { data: null, error: 'Você não possui este item', success: false };
      }

      // Aplicar efeito do consumível
      const consumable = characterConsumable.consumable!;
      let message = '';
      const statsToUpdate: { hp?: number; mana?: number } = {};

      switch (consumable.type) {
        case 'potion':
          // Poção de HP
          if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
            const oldHp = character.hp;
            const newHp = Math.min(character.max_hp, character.hp + consumable.effect_value);
            const actualHealing = newHp - oldHp;

            character.hp = newHp;
            statsToUpdate.hp = newHp;
            message =
              actualHealing > 0 ? `Recuperou ${actualHealing} HP!` : 'HP já estava no máximo!';
          }
          // Poção de Mana
          else if (consumable.description.includes('Mana')) {
            const oldMana = character.mana;
            const newMana = Math.min(character.max_mana, character.mana + consumable.effect_value);
            const actualRecovery = newMana - oldMana;

            character.mana = newMana;
            statsToUpdate.mana = newMana;
            message =
              actualRecovery > 0
                ? `Recuperou ${actualRecovery} Mana!`
                : 'Mana já estava no máximo!';
          }
          break;

        case 'antidote':
          // Só funciona em batalha (GamePlayer), no inventário apenas mostra mensagem
          if ('active_effects' in character) {
            character.active_effects.debuffs = [];
            character.active_effects.dots = [];
            message = 'Todos os efeitos negativos foram removidos!';
          } else {
            message = 'Antídoto só pode ser usado durante batalhas!';
          }
          break;

        case 'buff':
          // Só funciona em batalha (GamePlayer), no inventário apenas mostra mensagem
          if ('active_effects' in character) {
            // Elixir de força
            if (
              consumable.description.includes('Força') ||
              consumable.description.includes('ataque')
            ) {
              character.atk += consumable.effect_value;
              character.active_effects.buffs.push({
                type: 'buff',
                value: consumable.effect_value,
                duration: 3,
                source_spell: 'elixir_strength',
              });
              message = `Ataque aumentado em ${consumable.effect_value} por 3 turnos!`;
            }
            // Elixir de defesa
            else if (
              consumable.description.includes('Defesa') ||
              consumable.description.includes('defesa')
            ) {
              character.def += consumable.effect_value;
              character.active_effects.buffs.push({
                type: 'buff',
                value: consumable.effect_value,
                duration: 3,
                source_spell: 'elixir_defense',
              });
              message = `Defesa aumentada em ${consumable.effect_value} por 3 turnos!`;
            }
          } else {
            message = 'Elixires só podem ser usados durante batalhas!';
          }
          break;
      }

      // Atualizar quantidade no banco de dados usando a função RPC
      const { error: updateError } = await supabase.rpc('use_consumable', {
        p_character_id: characterId,
        p_consumable_id: consumableId,
      });

      if (updateError) throw updateError;

      // Atualizar HP/Mana no banco se necessário
      if (Object.keys(statsToUpdate).length > 0) {
        const { error: statsError } = await supabase
          .from('characters')
          .update(statsToUpdate)
          .eq('id', characterId);

        if (statsError) throw statsError;
      }

      return {
        data: { message },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao usar consumível:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao usar consumível'),
        success: false,
      };
    }
  }

  /**
   * Buscar todos os drops disponíveis
   * @returns Lista de drops
   */
  static async getMonsterDrops(): Promise<ServiceResponse<MonsterDrop[]>> {
    try {
      // Verificar cache
      const now = Date.now();
      if (now - this.lastFetchTimestamp < this.CACHE_DURATION && this.dropCache.size > 0) {
        const cachedDrops = Array.from(this.dropCache.values());
        return { data: cachedDrops, error: null, success: true };
      }

      const { data, error } = await supabase.from('monster_drops').select('*').order('rarity');

      if (error) throw error;

      // Atualizar cache
      this.dropCache.clear();
      (data as MonsterDrop[]).forEach(item => {
        this.dropCache.set(item.id, item);
      });

      return { data: data as MonsterDrop[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar drops:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar drops', success: false };
    }
  }

  /**
   * Processar drops de monstro após uma vitória
   * @param monsterLevel Nível do monstro
   * @param possibleDrops Lista de possíveis drops
   * @param chanceMultiplier Multiplicador adicional de chance (opcional)
   * @returns Lista de drops obtidos
   */
  static processMonsterDrops(
    monsterLevel: number,
    possibleDrops: MonsterDropChance[],
    chanceMultiplier: number = 1.0
  ): {
    drop_id: string;
    quantity: number;
  }[] {
    const obtainedDrops: { drop_id: string; quantity: number }[] = [];

    possibleDrops.forEach(drop => {
      // Ajustar chance baseada no nível do monstro (opcional)
      const adjustedChance = drop.drop_chance * (1 + monsterLevel * 0.02) * chanceMultiplier;

      // Verificar se o drop foi obtido
      if (Math.random() <= Math.min(0.95, adjustedChance)) {
        // Cap em 95%
        // Calcular quantidade
        const quantity = Math.floor(
          Math.random() * (drop.max_quantity - drop.min_quantity + 1) + drop.min_quantity
        );

        if (quantity > 0) {
          obtainedDrops.push({
            drop_id: drop.drop_id,
            quantity,
          });
        }
      }
    });

    return obtainedDrops;
  }

  /**
   * FUNÇÃO SEGURA: Adicionar drops ao inventário do personagem via sistema de combate
   * @param characterId ID do personagem
   * @param drops Lista de drops obtidos
   * @returns Resultado da operação
   */
  static async addDropsToInventory(
    characterId: string,
    drops: { drop_id: string; quantity: number }[]
  ): Promise<ServiceResponse<number>> {
    try {
      if (drops.length === 0) {
        return { data: 0, error: null, success: true };
      }

      // Converter drops para o formato JSONB esperado pela função segura
      const dropsJson = drops.map(drop => ({
        drop_id: drop.drop_id,
        quantity: drop.quantity,
      }));

      console.log(`[ConsumableService] Processando ${drops.length} drops via função segura`);

      // Importar o cliente admin apenas quando necessário
      const { supabaseAdmin } = await import('@/lib/supabase');

      // Usar o cliente admin para acessar a função restrita
      const { data, error } = await supabaseAdmin
        .rpc('secure_process_combat_drops', {
          p_character_id: characterId,
          p_drops: dropsJson,
        })
        .single();

      if (error) {
        console.error('Erro na função secure_process_combat_drops:', error);
        throw error;
      }

      const dropsProcessed = data as number;
      console.log(`[ConsumableService] ${dropsProcessed} drops processados com sucesso`);

      return {
        data: dropsProcessed,
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao processar drops:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao processar drops'),
        success: false,
      };
    }
  }

  /**
   * Buscar receitas de crafting
   * @returns Lista de receitas
   */
  static async getCraftingRecipes(): Promise<ServiceResponse<CraftingRecipe[]>> {
    try {
      // Verificar cache
      const now = Date.now();
      if (now - this.lastFetchTimestamp < this.CACHE_DURATION && this.recipeCache.size > 0) {
        const cachedRecipes = Array.from(this.recipeCache.values());
        return { data: cachedRecipes, error: null, success: true };
      }

      const { data, error } = await supabase.from('crafting_recipes').select(`
          *,
          ingredients:crafting_ingredients (*)
        `);

      if (error) throw error;

      // Atualizar cache
      this.recipeCache.clear();
      (data as CraftingRecipe[]).forEach(recipe => {
        this.recipeCache.set(recipe.result_id, recipe);
      });

      return { data: data as CraftingRecipe[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar receitas:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar receitas', success: false };
    }
  }

  /**
   * Verificar se um personagem pode criar um item
   * @param characterId ID do personagem
   * @param recipeId ID da receita
   * @returns Se pode criar o item
   */
  static async canCraftItem(
    characterId: string,
    recipeId: string
  ): Promise<ServiceResponse<{ canCraft: boolean; missingIngredients: string[] }>> {
    try {
      const { data, error } = await supabase.rpc('check_can_craft', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

      return {
        data: data as { canCraft: boolean; missingIngredients: string[] },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao verificar crafting:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao verificar crafting'),
        success: false,
      };
    }
  }

  /**
   * Criar um item através de crafting
   * @param characterId ID do personagem
   * @param recipeId ID da receita
   * @returns Resultado da operação
   */
  static async craftItem(
    characterId: string,
    recipeId: string
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      const { error } = await supabase.rpc('craft_item', {
        p_character_id: characterId,
        p_recipe_id: recipeId,
      });

      if (error) throw error;

      return {
        data: { message: 'Item criado com sucesso!' },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error('Erro ao criar item:', error);
      return {
        data: null,
        error: extractErrorMessage(error, 'Erro ao criar item'),
        success: false,
      };
    }
  }

  /**
   * Buscar drops do personagem
   * @param characterId ID do personagem
   * @returns Lista de drops do personagem
   */
  static async getCharacterDrops(
    characterId: string
  ): Promise<
    ServiceResponse<{ id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[]>
  > {
    try {
      const { data, error } = await supabase
        .from('character_drops')
        .select(
          `
          *,
          drop:drop_id (*)
        `
        )
        .eq('character_id', characterId);

      if (error) throw error;

      return {
        data: data as { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[],
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao buscar drops do personagem:',
        error instanceof Error ? error.message : error
      );
      return { data: null, error: 'Erro ao buscar drops do personagem', success: false };
    }
  }

  /**
   * Verificar se o jogador tem os ingredientes necessários
   * @param characterId ID do personagem
   * @param ingredients Lista de ingredientes necessários
   * @returns Se tem todos os ingredientes e lista de ingredientes faltantes
   */
  static async checkIngredients(
    characterId: string,
    ingredients: CraftingIngredient[]
  ): Promise<ServiceResponse<{ hasAll: boolean; missing: string[] }>> {
    try {
      const missing: string[] = [];
      let hasAll = true;

      // Buscar inventário do personagem
      const [consumablesRes, dropsRes] = await Promise.all([
        this.getCharacterConsumables(characterId),
        this.getCharacterDrops(characterId),
      ]);

      const consumables = consumablesRes.success ? consumablesRes.data : [];
      const drops = dropsRes.success ? dropsRes.data : [];

      // Verificar cada ingrediente
      for (const ing of ingredients) {
        if (ing.item_type === 'monster_drop') {
          const playerDrop = drops?.find(d => d.drop_id === ing.item_id);
          if (!playerDrop || playerDrop.quantity < ing.quantity) {
            hasAll = false;
            const dropName = playerDrop?.drop?.name || 'Item desconhecido';
            missing.push(dropName);
          }
        } else if (ing.item_type === 'consumable') {
          const playerConsumable = consumables?.find(c => c.consumable_id === ing.item_id);
          if (!playerConsumable || playerConsumable.quantity < ing.quantity) {
            hasAll = false;
            const consumableName = playerConsumable?.consumable?.name || 'Item desconhecido';
            missing.push(consumableName);
          }
        }
      }

      return {
        data: { hasAll, missing },
        error: null,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erro ao verificar ingredientes:',
        error instanceof Error ? error.message : error
      );
      return {
        data: null,
        error: 'Erro ao verificar ingredientes',
        success: false,
      };
    }
  }

  /**
   * Obter informações dos drops baseado nos IDs
   * @param dropIds IDs dos drops
   * @returns Informações dos drops
   */
  static async getDropInfoByIds(
    dropIds: string[]
  ): Promise<
    ServiceResponse<
      { id: string; name: string; description: string; rarity: string; value: number }[]
    >
  > {
    try {
      if (dropIds.length === 0) {
        return { data: [], error: null, success: true };
      }

      const { data, error } = await supabase
        .from('monster_drops')
        .select('id, name, description, rarity, value')
        .in('id', dropIds);

      if (error) {
        console.error('Erro ao buscar informações dos drops:', error);
        return { data: null, error: error.message, success: false };
      }

      return { data: data || [], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar drops:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar informações dos drops', success: false };
    }
  }
}
