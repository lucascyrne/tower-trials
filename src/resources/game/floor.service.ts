import { type Floor, type FloorType, type GameState } from './game-model';
import { supabase } from '@/lib/supabase';
import { MonsterService } from './monster.service';

export class FloorService {
  // Cache temporário para dados de andar
  private static floorCache: Map<number, Floor> = new Map();
  private static floorCacheExpiry: Map<number, number> = new Map();
  private static FLOOR_CACHE_DURATION = 10000; // 10 segundos de cache

  /**
   * Limpar todos os caches
   */
  static clearCache(): void {
    console.log('[FloorService] Limpando cache de andares');
    this.floorCache.clear();
    this.floorCacheExpiry.clear();
    MonsterService.clearCache();
    console.log('[FloorService] Cache limpo');
  }

  /**
   * Obter dados do andar
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    console.log(`[FloorService] Solicitando dados do andar ${floorNumber}`);
    
    // Verificar cache primeiro
    const now = Date.now();
    const cachedFloor = this.floorCache.get(floorNumber);
    const cacheExpiry = this.floorCacheExpiry.get(floorNumber);
    
    if (cachedFloor && cacheExpiry && now < cacheExpiry) {
      console.log(`[FloorService] Dados do andar ${floorNumber} obtidos do cache: ${cachedFloor.description}`);
      return cachedFloor;
    }

    try {
      console.log(`[FloorService] Buscando dados do andar ${floorNumber} do servidor`);
      
      const { data, error } = await supabase.rpc('get_floor_data', {
        p_floor_number: floorNumber
      });

      if (error) {
        console.error(`[FloorService] Erro na RPC get_floor_data para andar ${floorNumber}:`, error);
        return null;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error(`[FloorService] Nenhum dado encontrado para andar ${floorNumber}`);
        return null;
      }

      const floorData = Array.isArray(data) ? data[0] : data;
      
      if (!floorData) {
        console.error(`[FloorService] Dados de andar vazios para andar ${floorNumber}`);
        return null;
      }

      const floor: Floor = {
        floorNumber: floorData.floor_number || floorNumber,
        type: floorData.type || 'common',
        isCheckpoint: floorData.is_checkpoint || false,
        minLevel: floorData.min_level || 1,
        description: floorData.description || `Andar ${floorNumber}`
      };

      console.log(`[FloorService] Dados do andar ${floorNumber} carregados: ${floor.description} (tipo: ${floor.type}, checkpoint: ${floor.isCheckpoint})`);

      // Cache por 10 segundos
      this.floorCache.set(floorNumber, floor);
      this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

      return floor;
    } catch (error) {
      console.error(`[FloorService] Exceção na função getFloorData para andar ${floorNumber}:`, error);
      return null;
    }
  }

  /**
   * Calcular recompensas baseadas no tipo do andar
   */
  static calculateFloorRewards(baseXP: number, baseGold: number, floorType: FloorType): { xp: number; gold: number } {
    let multiplier = 1;
    
    switch (floorType) {
      case 'boss':
        multiplier = 2.5;
        break;
      case 'elite':
        multiplier = 1.8;
        break;
      case 'event':
        multiplier = 1.2;
        break;
      case 'common':
      default:
        multiplier = 1;
        break;
    }
    
    return {
      xp: Math.floor(baseXP * multiplier),
      gold: Math.floor(baseGold * multiplier)
    };
  }

  /**
   * Processar interação com evento especial
   */
  static async processSpecialEventInteraction(gameState: GameState): Promise<GameState> {
    const { currentSpecialEvent, player } = gameState;
    
    if (!currentSpecialEvent) {
      return gameState;
    }

    console.log(`[FloorService] Processando evento especial: ${currentSpecialEvent.name}`);

    let newHp = player.hp;
    let newMana = player.mana;
    let newGold = player.gold;
    let message = '';

    switch (currentSpecialEvent.type) {
      case 'magic_fountain':
        newHp = player.max_hp;
        newMana = player.max_mana;
        message = `Você encontrou uma fonte mágica! HP e Mana foram restaurados completamente.`;
        break;
        
      case 'treasure_chest':
        const goldGain = Math.floor(Math.random() * 50) + 25;
        newGold += goldGain;
        message = `Você encontrou um baú do tesouro! Ganhou ${goldGain} de ouro.`;
        break;
        
      case 'bonfire':
        const hpRestore = Math.floor(player.max_hp * 0.5);
        newHp = Math.min(player.max_hp, player.hp + hpRestore);
        message = `Você descansou numa fogueira acolhedora! Recuperou ${hpRestore} HP.`;
        break;
        
      default:
        message = `Você explorou o evento ${currentSpecialEvent.name}.`;
    }

    return {
      ...gameState,
      player: {
        ...player,
        hp: newHp,
        mana: newMana,
        gold: newGold
      },
      gameMessage: message,
      currentSpecialEvent: null,
      mode: 'battle'
    };
  }

  /**
   * Verificar se há evento especial no andar
   */
  static async checkForSpecialEvent(floorNumber: number): Promise<any | null> {
    try {
      console.log(`[FloorService] Verificando eventos especiais para andar ${floorNumber}...`);
      
      const { data: eventData, error: eventError } = await supabase
        .rpc('get_special_event_for_floor', {
          p_floor: floorNumber
        });

      if (!eventError && eventData) {
        console.log(`[FloorService] Evento especial encontrado: ${eventData.name}`);
        return eventData;
      }

      return null;
    } catch (error) {
      console.error('[FloorService] Erro ao verificar eventos especiais:', error);
      return null;
    }
  }
} 