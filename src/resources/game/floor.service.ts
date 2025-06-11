import { type Floor, type FloorType, type GameState, type SpecialEvent } from './game-model';
import { supabase } from '@/lib/supabase';
import { MonsterService } from './monster.service';

export class FloorService {
  // Cache temporário para dados de andar
  private static floorCache: Map<number, Floor> = new Map();
  private static floorCacheExpiry: Map<number, number> = new Map();
  private static FLOOR_CACHE_DURATION = 10000; // 10 segundos de cache
  private static lastClearTime = 0;
  private static MIN_CLEAR_INTERVAL = 1000; // Mínimo 1 segundo entre clears

  /**
   * Limpar todos os caches (com throttling)
   */
  static clearCache(): void {
    const now = Date.now();
    if (now - this.lastClearTime < this.MIN_CLEAR_INTERVAL) {
      console.log(
        `[FloorService] Cache clear throttled - última limpeza há ${now - this.lastClearTime}ms`
      );
      return;
    }

    console.log('[FloorService] Limpando cache de andares');
    this.floorCache.clear();
    this.floorCacheExpiry.clear();
    MonsterService.clearCache();
    this.lastClearTime = now;
    console.log('[FloorService] Cache limpo');
  }

  /**
   * Gerar dados básicos de andar como fallback
   * @private
   */
  private static generateBasicFloorData(floorNumber: number): Floor {
    // SIMPLIFICADO: Focar majoritariamente em monstros, reduzir eventos especiais
    let floorType: FloorType = 'common';
    if (floorNumber % 10 === 0) {
      floorType = 'boss';
    } else if (floorNumber % 5 === 0) {
      floorType = 'elite';
    }
    // REMOVIDO: Geração automática de andares de evento para garantir mais monstros

    // Checkpoints são no andar 1 e pós-boss (11, 21, 31, etc.)
    const isCheckpoint = floorNumber === 1 || (floorNumber > 10 && (floorNumber - 1) % 10 === 0);

    const minLevel = Math.max(1, Math.floor(floorNumber / 2));

    // Descrições temáticas baseadas no tipo
    let description = '';
    switch (floorType) {
      case 'boss':
        description = `Covil do Chefe - Andar ${floorNumber}`;
        break;
      case 'elite':
        description = `Domínio de Elite - Andar ${floorNumber}`;
        break;
      default:
        if (isCheckpoint) {
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
   * Obter dados do andar
   */
  static async getFloorData(floorNumber: number): Promise<Floor | null> {
    console.log(`[FloorService] Solicitando dados do andar ${floorNumber}`);

    // Verificar cache primeiro
    const now = Date.now();
    const cachedFloor = this.floorCache.get(floorNumber);
    const cacheExpiry = this.floorCacheExpiry.get(floorNumber);

    if (cachedFloor && cacheExpiry && now < cacheExpiry) {
      console.log(
        `[FloorService] Dados do andar ${floorNumber} obtidos do cache: ${cachedFloor.description}`
      );
      return cachedFloor;
    }

    try {
      console.log(`[FloorService] Buscando dados do andar ${floorNumber} do servidor`);

      const { data, error } = await supabase.rpc('get_floor_data', {
        p_floor_number: floorNumber,
      });

      if (error) {
        console.error(
          `[FloorService] Erro na RPC get_floor_data para andar ${floorNumber}:`,
          error
        );

        // Se a função não existir, usar fallback
        if (error.message?.includes('function') && error.message?.includes('does not exist')) {
          console.log(`[FloorService] Função get_floor_data não existe, usando fallback`);
          const basicFloor = this.generateBasicFloorData(floorNumber);

          // Cache o resultado
          this.floorCache.set(floorNumber, basicFloor);
          this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

          return basicFloor;
        }

        // Para outros erros, também usar fallback
        console.log(`[FloorService] Erro geral na RPC, usando fallback`);
        const basicFloor = this.generateBasicFloorData(floorNumber);

        // Cache o resultado
        this.floorCache.set(floorNumber, basicFloor);
        this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

        return basicFloor;
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
        description: floorData.description || `Andar ${floorNumber}`,
      };

      console.log(
        `[FloorService] Dados do andar ${floorNumber} carregados: ${floor.description} (tipo: ${floor.type}, checkpoint: ${floor.isCheckpoint})`
      );

      // Cache por 10 segundos
      this.floorCache.set(floorNumber, floor);
      this.floorCacheExpiry.set(floorNumber, now + this.FLOOR_CACHE_DURATION);

      return floor;
    } catch (error) {
      console.error(
        `[FloorService] Exceção na função getFloorData para andar ${floorNumber}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calcular recompensas baseadas no tipo do andar
   */
  static calculateFloorRewards(
    baseXP: number,
    baseGold: number,
    floorType: FloorType
  ): { xp: number; gold: number } {
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
      gold: Math.floor(baseGold * multiplier),
    };
  }

  /**
   * Processar interação com evento especial
   */
  static async processSpecialEventInteraction(gameState: GameState): Promise<GameState> {
    const { currentSpecialEvent, player } = gameState;

    if (!currentSpecialEvent) {
      console.warn('[FloorService] Tentativa de processar evento especial inexistente');
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

      case 'treasure_chest': {
        const goldGain = Math.floor(Math.random() * 50) + 25;
        newGold += goldGain;
        message = `Você encontrou um baú do tesouro! Ganhou ${goldGain} de ouro.`;
        break;
      }

      case 'bonfire': {
        const hpRestore = Math.floor(player.max_hp * 0.5);
        newHp = Math.min(player.max_hp, player.hp + hpRestore);
        message = `Você descansou numa fogueira acolhedora! Recuperou ${hpRestore} HP.`;
        break;
      }

      default:
        message = `Você explorou o evento ${currentSpecialEvent.name}.`;
    }

    // CRÍTICO: Após processar evento especial, SEMPRE gerar inimigo para continuar
    console.log(`[FloorService] === GERANDO INIMIGO APÓS EVENTO ESPECIAL ===`);

    try {
      const { GameService } = await import('./game.service');
      const currentFloorNumber = player.floor;

      // FORÇA geração de inimigo para o andar atual
      console.log(`[FloorService] Forçando geração de inimigo para andar ${currentFloorNumber}...`);
      const nextEnemy = await GameService.generateEnemy(currentFloorNumber);

      if (!nextEnemy) {
        console.error(
          `[FloorService] FALHA CRÍTICA: Não foi possível gerar inimigo após evento especial no andar ${currentFloorNumber}`
        );
        throw new Error(`Não foi possível gerar inimigo para continuar a aventura`);
      }

      console.log(
        `[FloorService] ✅ SUCESSO: Inimigo gerado após evento: ${nextEnemy.name} (HP: ${nextEnemy.hp}/${nextEnemy.maxHp})`
      );

      // MODIFICADO: Atualizar HP/Mana no banco se houve mudanças significativas
      if (newHp !== player.hp || newMana !== player.mana) {
        console.log(`[FloorService] Atualizando HP/Mana no banco: ${newHp}/${newMana}`);

        try {
          const { CharacterService } = await import('./character/character.service');
          await CharacterService.updateCharacterHpMana(player.id, newHp, newMana);
        } catch (error) {
          console.error('[FloorService] Erro ao atualizar HP/Mana após evento:', error);
          // Não interromper o fluxo por causa disso
        }
      }

      // MODIFICADO: Atualizar gold no banco se houve ganho
      if (newGold !== player.gold) {
        console.log(`[FloorService] Atualizando gold no banco: ${newGold}`);

        try {
          const { CharacterService } = await import('./character/character.service');
          await CharacterService.grantSecureGold(player.id, newGold - player.gold, 'event');
        } catch (error) {
          console.error('[FloorService] Erro ao atualizar gold após evento:', error);
          // Usar o valor local mesmo se falhar o banco
        }
      }

      const finalGameState = {
        ...gameState,
        player: {
          ...player,
          hp: newHp,
          mana: newMana,
          gold: newGold,
          isPlayerTurn: true,
          isDefending: false,
        },
        currentEnemy: nextEnemy,
        gameMessage: `${message} Um ${nextEnemy.name} apareceu para enfrentá-lo!`,
        currentSpecialEvent: null,
        mode: 'battle' as const,
        isPlayerTurn: true,
      };

      console.log(
        `[FloorService] ✅ ESTADO FINAL APÓS EVENTO: Modo=${finalGameState.mode}, Inimigo=${finalGameState.currentEnemy?.name}, HP=${finalGameState.player.hp}`
      );

      return finalGameState;
    } catch (error) {
      console.error('[FloorService] ❌ ERRO CRÍTICO ao gerar inimigo após evento especial:', error);

      // Fallback: retornar ao estado de batalha sem inimigo (mas isso deve ser tratado pela verificação de estado inconsistente)
      console.log(
        '[FloorService] Retornando estado de fallback - verificação de estado inconsistente deve capturar isto'
      );

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
        mode: 'battle' as const,
        isPlayerTurn: true,
      };
    }
  }

  /**
   * Verificar se há evento especial no andar
   */
  static async checkForSpecialEvent(floorNumber: number): Promise<SpecialEvent | null> {
    try {
      console.log(`[FloorService] Verificando eventos especiais para andar ${floorNumber}...`);

      const { data: eventData, error: eventError } = await supabase.rpc(
        'get_special_event_for_floor',
        {
          p_floor: floorNumber,
        }
      );

      if (eventError) {
        // Se a função não existir, retornar null (sem eventos especiais)
        if (
          eventError.message?.includes('function') &&
          eventError.message?.includes('does not exist')
        ) {
          console.log(
            `[FloorService] Função get_special_event_for_floor não existe - sem eventos especiais`
          );
          return null;
        }

        console.warn(`[FloorService] Erro ao buscar evento especial:`, eventError);
        return null;
      }

      if (eventData) {
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
