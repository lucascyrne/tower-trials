import { type GameState, type GamePlayer, type Enemy, type FloorType } from './game-model';
import { type Monster } from './models/monster.model';
import { supabase } from '@/lib/supabase';
import { CharacterService } from './character.service';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { FloorService } from './floor.service';
import { MonsterService } from './monster.service';
import type { CharacterConsumable } from './models/consumable.model';

// Interface para progresso do jogo salvo no banco
interface GameProgressData {
  id?: string;
  user_id: string;
  player_name: string;
  current_floor: number;
  level?: number;
  xp?: number;
  xp_next_level?: number;
  gold?: number;
  mana?: number;
  max_mana?: number;
  atk?: number;
  def?: number;
  speed?: number;
  hp: number;
  max_hp: number;
  highest_floor: number;
  created_at?: string;
  updated_at?: string;
}

export class GameStateService {
  /**
   * Carregar personagem com todos os dados necessários para o jogo
   */
  static async loadPlayerForGame(characterId: string): Promise<GamePlayer> {
    try {
      // Usar o método que retorna stats detalhados com bônus de equipamentos
      const characterResponse = await CharacterService.getCharacterForGame(characterId);

      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Personagem não encontrado');
      }

      const character = characterResponse.data;

      // Carregar magias equipadas do personagem (usando slots)
      const spellsResponse = await SpellService.getCharacterEquippedSpells(characterId);
      const playerSpells = spellsResponse.success && spellsResponse.data ? spellsResponse.data : [];

      // CORRIGIDO: Carregar consumíveis com log detalhado
      console.log('[GameStateService] Carregando consumíveis para personagem:', characterId);
      const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);
      console.log('[GameStateService] Resposta dos consumíveis:', consumablesResponse);

      const consumables =
        consumablesResponse.success && consumablesResponse.data
          ? consumablesResponse.data
              .map(c => ({
                ...c,
                consumable: c.consumable || null, // Garantir que o consumable está presente
              }))
              .filter(c => c.quantity > 0) // Filtrar apenas consumíveis com quantidade > 0
          : [];

      console.log('[GameStateService] Consumíveis carregados:', consumables.length);

      return {
        ...character,
        spells: playerSpells,
        consumables: consumables as CharacterConsumable[], // CORRIGIDO: Usar consumíveis filtrados
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: [],
          attribute_modifications: [],
        },
      };
    } catch (error) {
      console.error('[GameStateService] Erro ao carregar personagem para o jogo:', error);
      throw error;
    }
  }

  /**
   * Salvar o progresso do jogo
   */
  static async saveGameProgress(
    gameState: GameState,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { player, currentFloor } = gameState;

    const progressData: Omit<GameProgressData, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      player_name: player.name,
      current_floor: player.floor,
      hp: player.hp,
      max_hp: player.max_hp,
      atk: player.atk,
      def: player.def,
      highest_floor: Math.max(player.floor, currentFloor?.floorNumber || 1),
    };

    try {
      const { error } = await supabase.from('game_progress').upsert(progressData).select();

      if (error) {
        console.error('[GameStateService] Erro ao salvar progresso:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('[GameStateService] Erro geral ao salvar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Carregar o progresso do jogo
   */
  static async loadGameProgress(
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: GameProgressData }> {
    try {
      const { data, error } = await supabase
        .from('game_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[GameStateService] Erro ao carregar progresso:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: (data[0] as GameProgressData) || undefined,
      };
    } catch (error) {
      console.error('[GameStateService] Erro geral ao carregar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Converter Monster para Enemy (igual ao que existe no GameService)
   */
  private static convertMonsterToEnemy(monsterData: Monster, floor: number): Enemy {
    return {
      id: monsterData.id,
      name: monsterData.name,
      level: monsterData.level || Math.max(1, Math.floor(floor / 5) + 1),
      hp: monsterData.hp,
      maxHp: monsterData.hp,
      attack: monsterData.atk,
      defense: monsterData.def,
      speed: monsterData.speed || 10,
      image: monsterData.image || '👾',
      behavior: monsterData.behavior || 'balanced',
      mana: monsterData.mana || 0,
      reward_xp: monsterData.reward_xp,
      reward_gold: monsterData.reward_gold,
      possible_drops: monsterData.possible_drops || [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier: monsterData.tier,
      base_tier: monsterData.base_tier,
      cycle_position: monsterData.cycle_position,
      is_boss: monsterData.is_boss,
      strength: monsterData.strength,
      dexterity: monsterData.dexterity,
      intelligence: monsterData.intelligence,
      wisdom: monsterData.wisdom,
      vitality: monsterData.vitality,
      luck: monsterData.luck,
      critical_chance: monsterData.critical_chance,
      critical_damage: monsterData.critical_damage,
      critical_resistance: monsterData.critical_resistance,
      physical_resistance: monsterData.physical_resistance,
      magical_resistance: monsterData.magical_resistance,
      debuff_resistance: monsterData.debuff_resistance,
      physical_vulnerability: monsterData.physical_vulnerability,
      magical_vulnerability: monsterData.magical_vulnerability,
      primary_trait: monsterData.primary_trait,
      secondary_trait: monsterData.secondary_trait,
      special_abilities: monsterData.special_abilities || [],
    };
  }

  /**
   * Avançar para o próximo andar
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    const { player } = gameState;
    const nextFloor = player.floor + 1;

    console.log(`[GameStateService] Avançando do andar ${player.floor} para ${nextFloor}`);

    try {
      // Limpar todos os caches antes de começar
      FloorService.clearCache();
      MonsterService.clearCache();

      // Atualizar andar no banco de dados
      console.log(`[GameStateService] === ATUALIZANDO ANDAR NO BANCO ===`);
      const updateResult = await CharacterService.updateCharacterFloor(player.id, nextFloor);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar andar do personagem');
      }

      // Obter dados do próximo andar
      const nextFloorData = await FloorService.getFloorData(nextFloor);
      if (!nextFloorData) {
        throw new Error(`Erro ao gerar dados do andar ${nextFloor}`);
      }

      // Gerar novo inimigo para o próximo andar
      const monsterResult = await MonsterService.getMonsterForFloor(nextFloor);
      if (!monsterResult.success || !monsterResult.data) {
        throw new Error(`Falha ao gerar inimigo para o andar ${nextFloor}: ${monsterResult.error}`);
      }

      const nextEnemy = this.convertMonsterToEnemy(monsterResult.data, nextFloor);

      // Verificar se há evento especial
      const specialEvent = await FloorService.checkForSpecialEvent(nextFloor);

      // Construir novo estado
      return {
        ...gameState,
        mode: specialEvent ? 'special_event' : 'battle',
        player: {
          ...player,
          floor: nextFloor,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (player.defenseCooldown || 0) - 1),
        },
        currentFloor: nextFloorData,
        currentEnemy: specialEvent ? null : nextEnemy,
        currentSpecialEvent: specialEvent,
        gameMessage: specialEvent
          ? `Evento especial encontrado: ${specialEvent.name}!`
          : `Andar ${nextFloor}: ${nextFloorData.description}. Um ${nextEnemy.name} apareceu!`,
        isPlayerTurn: true,
        battleRewards: null,
        selectedSpell: null,
        characterDeleted: false,
        fleeSuccessful: false,
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor),
      };
    } catch (error) {
      console.error(`[GameStateService] Erro crítico ao avançar para andar ${nextFloor}:`, error);

      try {
        const fallbackMonsterResult = await MonsterService.getMonsterForFloor(nextFloor);

        if (!fallbackMonsterResult.success || !fallbackMonsterResult.data) {
          throw new Error(`Não foi possível gerar inimigo para o andar ${nextFloor}`);
        }

        const fallbackEnemy = this.convertMonsterToEnemy(fallbackMonsterResult.data, nextFloor);

        const fallbackFloor = {
          floorNumber: nextFloor,
          type: 'common' as FloorType,
          isCheckpoint: nextFloor % 10 === 0,
          minLevel: Math.max(1, Math.floor(nextFloor / 5)),
          description: `Andar ${nextFloor} - Área Desconhecida`,
        };

        return {
          ...gameState,
          player: {
            ...player,
            floor: nextFloor,
            isPlayerTurn: true,
            isDefending: false,
            potionUsedThisTurn: false,
          },
          currentFloor: fallbackFloor,
          currentEnemy: fallbackEnemy,
          currentSpecialEvent: null,
          gameMessage: `Andar ${nextFloor}: ${fallbackFloor.description}. Um ${fallbackEnemy.name} apareceu!`,
          isPlayerTurn: true,
          battleRewards: null,
          mode: 'battle',
          selectedSpell: null,
        };
      } catch (fallbackError) {
        console.error(`[GameStateService] Falha ao criar estado de fallback:`, fallbackError);

        return {
          ...gameState,
          gameMessage: `Erro crítico ao avançar para o andar ${nextFloor}: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Retorne ao hub e tente novamente.`,
        };
      }
    }
  }
}
