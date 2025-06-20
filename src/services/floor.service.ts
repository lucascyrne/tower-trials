import { type Floor, type FloorType, type SpecialEvent, type GameState } from '@/models/game.model';
import { supabase } from '@/lib/supabase';
import { MonsterService } from './monster.service';
import { CharacterService } from './character.service';

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
    // ✅ VALIDAÇÃO: Limitar andares de 1 a 1000
    if (floorNumber < 1 || floorNumber > 1000) {
      console.warn(`[FloorService] Andar ${floorNumber} fora dos limites (1-1000)`);
      return null;
    }

    // Verificar cache
    const now = Date.now();
    const cached = this.floorCache.get(floorNumber);
    const expiry = this.cacheExpiry.get(floorNumber);

    if (cached && expiry && now < expiry) {
      return cached;
    }

    try {
      const { data, error } = await supabase.rpc('get_floor_data', {
        p_floor_number: floorNumber,
      });

      if (error || !data) {
        const fallback = this.generateBasicFloorData(floorNumber);
        this.cacheFloor(floorNumber, fallback);
        return fallback;
      }

      const floorData = Array.isArray(data) ? data[0] : data;
      const floor: Floor = {
        floorNumber: floorData.floor_number || floorNumber,
        type: floorData.type || 'common',
        isCheckpoint: floorData.is_checkpoint || false,
        minLevel: floorData.min_level || 1,
        description: floorData.description || `Andar ${floorNumber}`,
      };

      this.cacheFloor(floorNumber, floor);
      return floor;
    } catch (error) {
      console.error(`[FloorService] Erro ao buscar andar ${floorNumber}:`, error);
      const fallback = this.generateBasicFloorData(floorNumber);
      this.cacheFloor(floorNumber, fallback);
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
    } else if (floorNumber % 7 === 0) {
      floorType = 'event'; // Eventos especiais
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
      case 'event':
        description = `Câmara de Eventos - Andar ${floorNumber}`;
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
      event: 1.2,
      common: 1,
    };

    const multiplier = multipliers[floorType] || 1;

    return {
      xp: Math.floor(baseXP * multiplier),
      gold: Math.floor(baseGold * multiplier),
    };
  }

  /**
   * Verificar evento especial (chance muito baixa)
   */
  static async checkForSpecialEvent(floorNumber: number): Promise<SpecialEvent | null> {
    try {
      const { data, error } = await supabase.rpc('get_special_event_for_floor', {
        p_floor: floorNumber,
      });

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('[FloorService] Erro ao verificar eventos:', error);
      return null;
    }
  }

  /**
   * Processar evento especial
   */
  static async processSpecialEventInteraction(gameState: GameState): Promise<GameState> {
    const { currentSpecialEvent, player } = gameState;

    if (!currentSpecialEvent) {
      return gameState;
    }

    let newHp = player.hp;
    let newMana = player.mana;
    let newGold = player.gold;
    let message = '';

    switch (currentSpecialEvent.type) {
      case 'magic_fountain':
        newHp = player.max_hp;
        newMana = player.max_mana;
        message = 'Fonte mágica! HP e Mana restaurados.';
        break;

      case 'treasure_chest': {
        const goldGain = Math.floor(Math.random() * 50) + 25;
        newGold += goldGain;
        message = `Baú do tesouro! Ganhou ${goldGain} de ouro.`;
        break;
      }

      case 'bonfire': {
        const hpRestore = Math.floor(player.max_hp * 0.5);
        newHp = Math.min(player.max_hp, player.hp + hpRestore);
        message = `Fogueira! Recuperou ${hpRestore} HP.`;
        break;
      }

      default:
        message = `Evento ${currentSpecialEvent.name} processado.`;
    }

    // Gerar inimigo após evento
    try {
      const enemyResult = await MonsterService.getEnemyForFloor(player.floor);

      if (!enemyResult.success || !enemyResult.data) {
        throw new Error('Falha ao gerar inimigo após evento');
      }

      const enemy = enemyResult.data;

      // Atualizar stats no banco se necessário
      if (newHp !== player.hp || newMana !== player.mana || newGold !== player.gold) {
        try {
          if (newHp !== player.hp || newMana !== player.mana) {
            await CharacterService.updateCharacterHpMana(player.id, newHp, newMana);
          }
          if (newGold !== player.gold) {
            await CharacterService.grantSecureGold(player.id, newGold - player.gold, 'event');
          }
        } catch (error) {
          console.error('[FloorService] Erro ao atualizar stats após evento:', error);
        }
      }

      return {
        ...gameState,
        player: {
          ...player,
          hp: newHp,
          mana: newMana,
          gold: newGold,
          isPlayerTurn: true,
          isDefending: false,
        },
        currentEnemy: enemy,
        gameMessage: `${message} ${enemy.name} apareceu!`,
        currentSpecialEvent: null,
        mode: 'battle',
        isPlayerTurn: true,
      };
    } catch (error) {
      console.error('[FloorService] Erro ao processar evento:', error);
      return {
        ...gameState,
        player: {
          ...player,
          hp: newHp,
          mana: newMana,
          gold: newGold,
          isPlayerTurn: true,
          isDefending: false,
        },
        gameMessage: `${message} Preparando próximo desafio...`,
        currentSpecialEvent: null,
        currentEnemy: null,
        mode: 'battle',
        isPlayerTurn: true,
      };
    }
  }
}
