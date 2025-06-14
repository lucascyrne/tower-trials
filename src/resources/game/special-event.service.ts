import { supabase } from '@/lib/supabase';
import { type SpecialEvent, type SpecialEventResult } from './game-model';

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
      console.log(`[SpecialEventService] Buscando evento para andar ${floor}`);

      const { data, error } = await supabase
        .rpc('get_special_event_for_floor', { p_floor: floor })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro:`, error.message);
        throw error;
      }

      if (!data) {
        throw new Error('Nenhum evento encontrado para este andar');
      }

      const event = data as SpecialEvent;
      console.log(`[SpecialEventService] Evento obtido: ${event.name}`);

      return { data: event, error: null, success: true };
    } catch (error) {
      console.error(`[SpecialEventService] Falha:`, error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao buscar evento especial',
        success: false,
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
      console.log(`[SpecialEventService] Processando evento ${eventId} para ${characterId}`);

      const { data, error } = await supabase
        .rpc('process_special_event', {
          p_character_id: characterId,
          p_event_id: eventId,
        })
        .single();

      if (error) {
        console.error(`[SpecialEventService] Erro ao processar:`, error.message);
        throw error;
      }

      if (!data) {
        throw new Error('Resposta inválida do servidor');
      }

      const result = data as SpecialEventResult;
      console.log(`[SpecialEventService] Evento processado:`, result);

      return { data: result, error: null, success: true };
    } catch (error) {
      console.error(`[SpecialEventService] Falha:`, error instanceof Error ? error.message : error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro ao processar evento especial',
        success: false,
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
    return floorType === 'event' && Math.random() < 0.7;
  }

  /**
   * Obter ícone do evento baseado no tipo
   * @param eventType Tipo do evento
   * @returns Ícone emoji
   */
  static getEventIcon(eventType: string): string {
    const icons = {
      bonfire: '🔥',
      treasure_chest: '📦',
      magic_fountain: '⛲',
    };
    return icons[eventType as keyof typeof icons] || '✨';
  }

  /**
   * Obter cor do evento baseado no tipo
   * @param eventType Tipo do evento
   * @returns Classe CSS de cor
   */
  static getEventColor(eventType: string): string {
    const colors = {
      bonfire: 'text-orange-500',
      treasure_chest: 'text-yellow-500',
      magic_fountain: 'text-blue-500',
    };
    return colors[eventType as keyof typeof colors] || 'text-purple-500';
  }
}
