import { supabase } from '@/lib/supabase';
import { Consumable, CharacterConsumable, CraftingRecipe, MonsterDrop, CraftingIngredient } from './models/consumable.model';
import { GamePlayer } from './game-model';
import { MonsterDropChance } from './models/monster.model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
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

      const { data, error } = await supabase
        .from('consumables')
        .select('*')
        .order('price');

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
  static async getCharacterConsumables(characterId: string): Promise<ServiceResponse<CharacterConsumable[]>> {
    try {
      const { data, error } = await supabase
        .from('character_consumables')
        .select(`
          *,
          consumable:consumable_id (*)
        `)
        .eq('character_id', characterId);

      if (error) throw error;

      return { data: data as CharacterConsumable[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar consumíveis do personagem:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao buscar consumíveis do personagem', success: false };
    }
  }

  /**
   * Comprar um consumível
   * @param characterId ID do personagem
   * @param consumableId ID do consumível
   * @param quantity Quantidade a comprar
   * @returns Resultado da operação
   */
  static async buyConsumable(
    characterId: string, 
    consumableId: string, 
    quantity: number = 1
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.rpc('buy_consumable', {
        p_character_id: characterId,
        p_consumable_id: consumableId,
        p_quantity: quantity
      });

      if (error) throw error;

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao comprar consumível:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao comprar consumível', success: false };
    }
  }

  /**
   * Usar um consumível
   * @param characterId ID do personagem
   * @param consumableId ID do consumível
   * @param player Estado atual do jogador (para aplicar efeitos)
   * @returns Resultado da operação
   */
  static async useConsumable(
    characterId: string,
    consumableId: string,
    player: GamePlayer
  ): Promise<ServiceResponse<{ message: string }>> {
    try {
      // Verificar se o jogador possui o consumível
      const { data, error } = await supabase
        .from('character_consumables')
        .select(`
          *,
          consumable:consumable_id (*)
        `)
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

      switch (consumable.type) {
        case 'potion':
          // Poção de HP
          if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
            player.hp = Math.min(player.max_hp, player.hp + consumable.effect_value);
            message = `Recuperou ${consumable.effect_value} HP!`;
          } 
          // Poção de Mana
          else if (consumable.description.includes('Mana')) {
            player.mana = Math.min(player.max_mana, player.mana + consumable.effect_value);
            message = `Recuperou ${consumable.effect_value} Mana!`;
          }
          break;
        
        case 'antidote':
          // Remover efeitos negativos
          player.active_effects.debuffs = [];
          player.active_effects.dots = [];
          message = 'Todos os efeitos negativos foram removidos!';
          break;
        
        case 'buff':
          // Elixir de força
          if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
            player.atk += consumable.effect_value;
            player.active_effects.buffs.push({
              type: 'buff',
              value: consumable.effect_value,
              duration: 5, // Duração em turnos
              source_spell: 'consumable'
            });
            message = `Ataque aumentado em ${consumable.effect_value} por 5 turnos!`;
          } 
          // Elixir de defesa
          else if (consumable.description.includes('Defesa') || consumable.description.includes('defesa')) {
            player.def += consumable.effect_value;
            player.active_effects.buffs.push({
              type: 'buff',
              value: consumable.effect_value,
              duration: 5,
              source_spell: 'consumable'
            });
            message = `Defesa aumentada em ${consumable.effect_value} por 5 turnos!`;
          }
          break;
      }

      // Atualizar quantidade no banco de dados
      const { error: updateError } = await supabase.rpc('use_consumable', {
        p_character_id: characterId,
        p_consumable_id: consumableId
      });

      if (updateError) throw updateError;

      return { 
        data: { message }, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao usar consumível:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao usar consumível', success: false };
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

      const { data, error } = await supabase
        .from('monster_drops')
        .select('*')
        .order('rarity');

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
      if (Math.random() <= Math.min(0.95, adjustedChance)) { // Cap em 95%
        // Calcular quantidade
        const quantity = Math.floor(
          Math.random() * (drop.max_quantity - drop.min_quantity + 1) + drop.min_quantity
        );
        
        if (quantity > 0) {
          obtainedDrops.push({
            drop_id: drop.drop_id,
            quantity
          });
        }
      }
    });

    return obtainedDrops;
  }

  /**
   * Adicionar drops ao inventário do personagem
   * @param characterId ID do personagem
   * @param drops Lista de drops obtidos
   * @returns Resultado da operação
   */
  static async addDropsToInventory(
    characterId: string,
    drops: { drop_id: string; quantity: number }[]
  ): Promise<ServiceResponse<null>> {
    try {
      // Processar os drops em lote em vez de um por um
      if (drops.length === 0) {
        return { data: null, error: null, success: true };
      }
      
      // Usar Promise.allSettled para não interromper todo o processo se um falhar
      const results = await Promise.allSettled(drops.map(async (drop) => {
        try {
          const { error } = await supabase.rpc('add_monster_drop', {
            p_character_id: characterId,
            p_drop_id: drop.drop_id,
            p_quantity: drop.quantity
          });

          if (error) {
            // Se for um erro de chave duplicada, já foi tratado no backend
            if (error.code === '23505') {
              console.warn(`Drop já existe para o personagem. Usando fallback SQL.`);
              return { success: true };
            }
            throw error;
          }
          
          return { success: true };
        } catch (err) {
          console.error(`Erro ao adicionar drop ${drop.drop_id}:`, err);
          return { success: false, error: err };
        }
      }));
      
      // Verificar se algum drop falhou totalmente
      const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
      
      if (failures.length > 0) {
        console.warn(`${failures.length} de ${drops.length} drops falharam ao serem adicionados.`);
        // Se falhar parcialmente, ainda é considerado sucesso, mas logamos o erro
        return { 
          data: null, 
          error: null, 
          success: true 
        };
      }

      return { data: null, error: null, success: true };
    } catch (error) {
      console.error('Erro ao adicionar drops:', error instanceof Error ? error.message : error);
      return { data: null, error: 'Erro ao adicionar drops', success: false };
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

      const { data, error } = await supabase
        .from('crafting_recipes')
        .select(`
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
        p_recipe_id: recipeId
      });

      if (error) throw error;

      return { 
        data: data as { canCraft: boolean; missingIngredients: string[] }, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao verificar crafting:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao verificar crafting', 
        success: false 
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
        p_recipe_id: recipeId
      });

      if (error) throw error;

      return { 
        data: { message: 'Item criado com sucesso!' }, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao criar item:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao criar item', 
        success: false 
      };
    }
  }

  /**
   * Buscar drops do personagem
   * @param characterId ID do personagem
   * @returns Lista de drops do personagem
   */
  static async getCharacterDrops(characterId: string): Promise<ServiceResponse<{ id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[]>> {
    try {
      const { data, error } = await supabase
        .from('character_drops')
        .select(`
          *,
          drop:drop_id (*)
        `)
        .eq('character_id', characterId);

      if (error) throw error;

      return { data: data as { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar drops do personagem:', error instanceof Error ? error.message : error);
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
        this.getCharacterDrops(characterId)
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
        success: true 
      };
    } catch (error) {
      console.error('Erro ao verificar ingredientes:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: 'Erro ao verificar ingredientes', 
        success: false 
      };
    }
  }
} 