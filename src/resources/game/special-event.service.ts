import { supabase } from '@/lib/supabase';
import { SpecialEvent, SpecialEventResult } from './game-model';

interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class SpecialEventService {
  /**
   * Obter evento especial aleatório para um andar
   * @param floor Andar atual
   * @returns Evento especial selecionado
   */
  static async getSpecialEventForFloor(floor: number): Promise<ServiceResponse<SpecialEvent>> {
    try {
      console.log(`[SpecialEventService] Buscando evento especial para o andar ${floor}`);
      
      const { data, error } = await supabase
        .rpc('get_special_event_for_floor', {
          p_floor: floor
        })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro ao buscar evento para andar ${floor}:`, error.message);
        throw error;
      }
      
      if (!data) {
        console.error(`[SpecialEventService] Nenhum evento retornado para andar ${floor}`);
        throw new Error('Nenhum evento encontrado para este andar');
      }

      const event = data as SpecialEvent;
      console.log(`[SpecialEventService] Evento obtido para andar ${floor}: ${event.name}`);
      
      return { data: event, error: null, success: true };
    } catch (error) {
      console.error(`[SpecialEventService] Falha ao buscar evento para andar ${floor}:`, error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar evento especial',
        success: false 
      };
    }
  }

  /**
   * Processar interação com evento especial
   * @param characterId ID do personagem
   * @param eventId ID do evento
   * @returns Resultado da interação
   */
  static async processSpecialEvent(
    characterId: string, 
    eventId: string
  ): Promise<ServiceResponse<SpecialEventResult>> {
    try {
      console.log(`[SpecialEventService] Processando evento ${eventId} para personagem ${characterId}`);
      
      const { data, error } = await supabase
        .rpc('process_special_event', {
          p_character_id: characterId,
          p_event_id: eventId
        })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro ao processar evento:`, error.message);
        throw error;
      }
      
      if (!data) {
        throw new Error('Resposta inválida do servidor');
      }

      const result = data as SpecialEventResult;
      console.log(`[SpecialEventService] Evento processado com sucesso:`, result);
      
      return { data: result, error: null, success: true };
    } catch (error) {
      console.error(`[SpecialEventService] Falha ao processar evento:`, error instanceof Error ? error.message : error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao processar evento especial',
        success: false 
      };
    }
  }

  /**
   * Determinar se um andar deve ter evento especial
   * @param floorType Tipo do andar
   * @returns Se deve gerar evento especial
   */
  static shouldGenerateSpecialEvent(floorType: string): boolean {
    // Pisos "event" têm 70% de chance de gerar evento especial
    if (floorType === 'event') {
      return Math.random() < 0.7;
    }
    
    // Outros tipos de piso sempre geram monstros
    return false;
  }

  /**
   * Obter ícone do evento baseado no tipo
   * @param eventType Tipo do evento
   * @returns Ícone emoji
   */
  static getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'bonfire':
        return '🔥';
      case 'treasure_chest':
        return '📦';
      case 'magic_fountain':
        return '⛲';
      default:
        return '✨';
    }
  }

  /**
   * Obter cor do evento baseado no tipo
   * @param eventType Tipo do evento
   * @returns Classe CSS de cor
   */
  static getEventColor(eventType: string): string {
    switch (eventType) {
      case 'bonfire':
        return 'text-orange-500';
      case 'treasure_chest':
        return 'text-yellow-500';
      case 'magic_fountain':
        return 'text-blue-500';
      default:
        return 'text-purple-500';
    }
  }
} 