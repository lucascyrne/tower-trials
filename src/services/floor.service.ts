import { type Floor, type FloorType } from '@/models/game.model';
import { supabase } from '@/lib/supabase';

export class FloorService {
  private static floorCache: Map<number, Floor> = new Map();
  private static cacheExpiry: Map<number, number> = new Map();
  private static readonly CACHE_DURATION = 30000;

  /**
   * Limpar cache
   */
  static clearCache(): void {
    this.floorCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * ✅ CORRIGIDO: Obter dados do andar com suporte até andar 1000
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    // ✅ VALIDAÇÃO E CORREÇÃO: Se floor <= 0, forçar para 1
    let safeFloorNumber = floorNumber;
    if (floorNumber <= 0) {
      console.warn(`[FloorService] ⚠️ Andar inválido ${floorNumber} corrigido para 1`);
      safeFloorNumber = 1;
    }

    // ✅ VALIDAÇÃO: Limitar andares de 1 a 1000
    if (safeFloorNumber < 1 || safeFloorNumber > 1000) {
      console.warn(`[FloorService] Andar ${safeFloorNumber} fora dos limites (1-1000)`);
      return null;
    }

    // Verificar cache
    const now = Date.now();
    const cached = this.floorCache.get(safeFloorNumber);
    const expiry = this.cacheExpiry.get(safeFloorNumber);

    if (cached && expiry && now < expiry) {
      return cached;
    }

    try {
      const { data, error } = await supabase.rpc('get_floor_data', {
        p_floor_number: safeFloorNumber,
      });

      if (error || !data) {
        const fallback = this.generateBasicFloorData(safeFloorNumber);
        this.cacheFloor(safeFloorNumber, fallback);
        return fallback;
      }

      const floorData = Array.isArray(data) ? data[0] : data;
      const floor: Floor = {
        floorNumber: floorData.floor_number || safeFloorNumber,
        type: floorData.type || 'common',
        isCheckpoint: floorData.is_checkpoint || false,
        minLevel: floorData.min_level || 1,
        description: floorData.description || `Andar ${safeFloorNumber}`,
      };

      this.cacheFloor(safeFloorNumber, floor);
      return floor;
    } catch (error) {
      console.error(`[FloorService] Erro ao buscar andar ${safeFloorNumber}:`, error);
      const fallback = this.generateBasicFloorData(safeFloorNumber);
      this.cacheFloor(safeFloorNumber, fallback);
      return fallback;
    }
  }

  /**
   * Cache do andar
   */
  private static cacheFloor(floorNumber: number, floor: Floor): void {
    const now = Date.now();
    this.floorCache.set(floorNumber, floor);
    this.cacheExpiry.set(floorNumber, now + this.CACHE_DURATION);
  }

  /**
   * Gerar dados básicos de andar
   * ✅ CORRIGIDO: Lógica consistente com sistema de checkpoints do banco
   */
  private static generateBasicFloorData(floorNumber: number): Floor {
    let floorType: FloorType = 'common';

    // ✅ NOVA LÓGICA PADRONIZADA:
    // - Andar 5: Primeiro Desafio (boss especial)
    // - Andares 10, 20, 30, 40...: Bosses principais (a cada 10)
    // - Andares 15, 25, 35...: Elites (a cada 5, exceto boss floors)
    // - Andares com múltiplo de 7: Eventos especiais
    if (floorNumber === 5) {
      floorType = 'boss'; // Primeiro desafio
    } else if (floorNumber % 10 === 0) {
      floorType = 'boss'; // Bosses principais
    } else if (floorNumber % 5 === 0 && floorNumber > 5) {
      floorType = 'elite'; // Elites (exceto andar 5 que é boss)
    }

    // ✅ CHECKPOINTS PADRONIZADOS:
    // - Andar 1: Início da Torre
    // - Andar 5: Primeiro Desafio
    // - Andares 11, 21, 31, 41...: Pós-boss (após andares 10, 20, 30, 40...)
    const isCheckpoint =
      floorNumber === 1 || floorNumber === 5 || (floorNumber > 10 && (floorNumber - 1) % 10 === 0);

    // Nível mínimo mais suave para progressão sustentável
    const minLevel = Math.max(1, Math.floor(floorNumber / 3));

    // ✅ DESCRIÇÕES PADRONIZADAS
    let description = '';
    switch (floorType) {
      case 'boss':
        if (floorNumber === 5) {
          description = `Primeiro Desafio - Andar ${floorNumber}`;
        } else {
          description = `Covil do Chefe - Andar ${floorNumber}`;
        }
        break;
      case 'elite':
        description = `Domínio de Elite - Andar ${floorNumber}`;
        break;
      default:
        if (floorNumber === 1) {
          description = 'Entrada da Torre';
        } else if (isCheckpoint) {
          description = `Santuário Seguro - Andar ${floorNumber}`;
        } else {
          description = `Corredor Sombrio - Andar ${floorNumber}`;
        }
        break;
    }

    return {
      floorNumber,
      type: floorType,
      isCheckpoint,
      minLevel,
      description,
    };
  }

  /**
   * Calcular recompensas baseadas no tipo do andar
   */
  static calculateFloorRewards(
    baseXP: number,
    baseGold: number,
    floorType: FloorType
  ): { xp: number; gold: number } {
    const multipliers = {
      boss: 2.5,
      elite: 1.8,
      common: 1,
    };

    const multiplier = multipliers[floorType] || 1;

    return {
      xp: Math.floor(baseXP * multiplier),
      gold: Math.floor(baseGold * multiplier),
    };
  }
}
