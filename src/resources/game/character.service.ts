import { createBrowserClient } from '@supabase/ssr';
import { Character, CreateCharacterDTO, UpdateCharacterStatsDTO, calculateBaseStats } from './models/character.model';
import { EquipmentService } from './equipment.service';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class CharacterService {
  private static supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  /**
   * Buscar todos os personagens do usuário
   * @param userId ID do usuário
   * @returns Lista de personagens
   */
  static async getUserCharacters(userId: string): Promise<ServiceResponse<Character[]>> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_characters', {
          p_user_id: userId
        });

      if (error) throw error;
      return { data: data as Character[], error: null, success: true };
    } catch (error) {
      console.error('Erro ao buscar personagens:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao buscar personagens', success: false };
    }
  }

  /**
   * Buscar um personagem específico
   * @param characterId ID do personagem
   * @returns Dados do personagem
   */
  static async getCharacter(characterId: string): Promise<ServiceResponse<Character>> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_character', {
          p_character_id: characterId
        });

      if (error) throw error;

      if (!data) {
        return { 
          data: null, 
          error: 'Personagem não encontrado', 
          success: false 
        };
      }

      return { 
        data: data as Character, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao buscar personagem:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar personagem', 
        success: false 
      };
    }
  }

  /**
   * Criar um novo personagem
   * @param data Dados do personagem
   * @returns ID do personagem criado
   */
  static async createCharacter(data: CreateCharacterDTO): Promise<ServiceResponse<{ id: string }>> {
    try {
      // Verificar se o usuário já tem 3 personagens
      const { data: characters, error: countError } = await this.supabase
        .from('characters')
        .select('id')
        .eq('user_id', data.user_id);

      if (countError) throw countError;
      
      if (characters && characters.length >= 3) {
        return {
          data: null,
          error: 'Você já atingiu o limite máximo de 3 personagens',
          success: false
        };
      }

      // Criar novo personagem usando a função RPC
      const { data: result, error } = await this.supabase
        .rpc('create_character', {
          p_user_id: data.user_id,
          p_name: data.name
        });

      if (error) {
        if (error.message.includes('Limite máximo de personagens')) {
          return {
            data: null,
            error: 'Você já atingiu o limite máximo de 3 personagens',
            success: false
          };
        }
        throw error;
      }

      return { 
        data: { id: result }, 
        error: null, 
        success: true 
      };
    } catch (error) {
      console.error('Erro ao criar personagem:', error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao criar personagem', 
        success: false 
      };
    }
  }

  /**
   * Carregar personagem com seus equipamentos
   */
  static async loadCharacter(characterId: string): Promise<Character> {
    // Carregar dados básicos do personagem
    const { data: character, error } = await this.supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (error) throw error;

    // Carregar equipamentos equipados
    const equipmentSlots = await EquipmentService.getEquippedSlots(characterId);

    // Calcular stats com bônus de equipamento
    const baseStats = calculateBaseStats(character.level, equipmentSlots);

    return {
      ...character,
      equipment_slots: equipmentSlots,
      ...baseStats
    };
  }

  /**
   * Atualizar stats do personagem
   * @param characterId ID do personagem
   * @param stats Stats a serem atualizados
   * @returns Resultado da atualização
   */
  static async updateCharacterStats(
    characterId: string,
    stats: UpdateCharacterStatsDTO
  ): Promise<ServiceResponse<{ leveled_up: boolean; new_level: number; new_xp: number; new_xp_next_level: number }>> {
    try {
      const { data, error } = await this.supabase
        .rpc('update_character_stats', {
          p_character_id: characterId,
          p_xp: stats.xp,
          p_gold: stats.gold,
          p_hp: stats.hp,
          p_mana: stats.mana,
        });

      if (error) throw error;
      return { data, error: null, success: true };
    } catch (error) {
      console.error('Erro ao atualizar stats:', error instanceof Error ? error.message : error);
      return { data: null, error: error instanceof Error ? error.message : 'Erro ao atualizar stats', success: false };
    }
  }

  /**
   * Atualizar gold do personagem
   */
  static async updateGold(characterId: string, amount: number): Promise<void> {
    const { error } = await this.supabase
      .from('characters')
      .update({ gold: amount })
      .eq('id', characterId);

    if (error) throw error;
  }

  /**
   * Deletar um personagem
   * @param characterId ID do personagem
   * @returns Resultado da operação
   */
  static async deleteCharacter(characterId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase
        .from('characters')
        .delete()
        .eq('id', characterId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Erro ao deletar personagem:', error instanceof Error ? error.message : error);
      return { error: error instanceof Error ? error.message : 'Erro ao deletar personagem' };
    }
  }
} 