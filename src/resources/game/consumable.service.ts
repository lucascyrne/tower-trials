import { Consumable, CharacterConsumable, CraftingRecipe, MonsterDrop, CraftingIngredient } from './models/consumable.model';
import { GamePlayer } from './game-model';
import { MonsterDropChance } from './models/monster.model';
import { Character } from './models/character.model';
import {
  buyConsumable,
  consumeItem,
  getAvailableConsumables,
  getCharacterConsumables,
  getCharacterDrops,
} from './consumable-service/consumable-inventory';
import {
  addDropsToInventory,
  canCraftItem,
  checkIngredients,
  craftItem,
  getCraftingRecipes,
  getDropInfoByIds,
  getMonsterDrops,
  processMonsterDrops,
} from './consumable-service/consumable-drops-crafting';
import { ServiceResponse } from './consumable-service/types';

export class ConsumableService {
  /**
   * Buscar todos os consumíveis disponíveis
   * @returns Lista de consumíveis
   */
  static async getAvailableConsumables(): Promise<ServiceResponse<Consumable[]>> {
    return getAvailableConsumables();
  }

  /**
   * Buscar consumíveis do personagem
   * @param characterId ID do personagem
   * @returns Lista de consumíveis do personagem
   */
  static async getCharacterConsumables(characterId: string): Promise<ServiceResponse<CharacterConsumable[]>> {
    return getCharacterConsumables(characterId);
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
    return buyConsumable(characterId, consumableId, quantity);
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
    return consumeItem(characterId, consumableId, character);
  }

  /**
   * Buscar todos os drops disponíveis
   * @returns Lista de drops
   */
  static async getMonsterDrops(): Promise<ServiceResponse<MonsterDrop[]>> {
    return getMonsterDrops();
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
    return processMonsterDrops(monsterLevel, possibleDrops, chanceMultiplier);
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
    return addDropsToInventory(characterId, drops);
  }

  /**
   * Buscar receitas de crafting
   * @returns Lista de receitas
   */
  static async getCraftingRecipes(): Promise<ServiceResponse<CraftingRecipe[]>> {
    return getCraftingRecipes();
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
    return canCraftItem(characterId, recipeId);
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
    return craftItem(characterId, recipeId);
  }

  /**
   * Buscar drops do personagem
   * @param characterId ID do personagem
   * @returns Lista de drops do personagem
   */
  static async getCharacterDrops(characterId: string): Promise<ServiceResponse<{ id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[]>> {
    return getCharacterDrops(characterId);
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
    return checkIngredients(characterId, ingredients);
  }

  /**
   * Obter informações dos drops baseado nos IDs
   * @param dropIds IDs dos drops
   * @returns Informações dos drops
   */
  static async getDropInfoByIds(dropIds: string[]): Promise<ServiceResponse<{id: string; name: string; description: string; rarity: string; value: number}[]>> {
    return getDropInfoByIds(dropIds);
  }
} 