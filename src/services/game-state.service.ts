import { type GameState, type GamePlayer } from '@/models/game.model';
import { CharacterService } from './character.service';
import { SpellService } from './spell.service';
import { ConsumableService } from './consumable.service';
import { FloorService } from './floor.service';
import { MonsterService } from './monster.service';
import type { CharacterConsumable } from '@/models/consumable.model';

export class GameStateService {
  /**
   * Carregar personagem com dados para o jogo
   * ✅ CORREÇÃO CRÍTICA: Sempre aplicar auto-heal para fonte única de verdade
   */
  static async loadPlayerForGame(
    characterId: string,
    forceRefresh: boolean = false
  ): Promise<GamePlayer> {
    try {
      console.log(`[GameStateService] Carregando personagem ${characterId} com auto-heal`);
      const characterResponse = await CharacterService.getCharacterForGame(
        characterId,
        forceRefresh,
        true
      );
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Personagem não encontrado');
      }

      const character = characterResponse.data;
      console.log(
        `[GameStateService] Personagem carregado com HP: ${character.hp}/${character.max_hp}`
      );

      // Carregar magias equipadas
      const spellsResponse = await SpellService.getCharacterEquippedSpells(characterId);
      const playerSpells = spellsResponse.success && spellsResponse.data ? spellsResponse.data : [];

      // Carregar consumíveis
      const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);
      const consumables =
        consumablesResponse.success && consumablesResponse.data
          ? consumablesResponse.data.filter(c => c.quantity > 0)
          : [];

      return {
        ...character,
        spells: playerSpells,
        consumables: consumables as CharacterConsumable[],
        active_effects: {
          buffs: [],
          debuffs: [],
          dots: [],
          hots: [],
          attribute_modifications: [],
        },
      };
    } catch (error) {
      console.error('[GameStateService] Erro ao carregar personagem:', error);
      throw error;
    }
  }

  /**
   * Avançar para o próximo andar
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    const { player } = gameState;
    const nextFloor = player.floor + 1;

    try {
      // Atualizar andar no banco
      const updateResult = await CharacterService.updateCharacterFloor(player.id, nextFloor);
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Erro ao atualizar andar');
      }

      // Obter dados do próximo andar
      const nextFloorData = await FloorService.getFloorData(nextFloor);
      if (!nextFloorData) {
        throw new Error(`Erro ao carregar andar ${nextFloor}`);
      }

      // Verificar evento especial (chance muito baixa - 1%)
      const specialEvent =
        Math.random() < 0.01 ? await FloorService.checkForSpecialEvent(nextFloor) : null;

      // Gerar inimigo se não há evento
      let enemy = null;
      if (!specialEvent) {
        const enemyResult = await MonsterService.getEnemyForFloor(nextFloor);
        if (!enemyResult.success || !enemyResult.data) {
          throw new Error(`Falha ao gerar inimigo para andar ${nextFloor}`);
        }
        enemy = enemyResult.data;
      }

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
        currentEnemy: enemy,
        currentSpecialEvent: specialEvent,
        gameMessage: specialEvent
          ? `Evento especial: ${specialEvent.name}!`
          : `Andar ${nextFloor}: ${enemy?.name} apareceu!`,
        isPlayerTurn: true,
        battleRewards: null,
        selectedSpell: null,
        characterDeleted: false,
        fleeSuccessful: false,
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor),
      };
    } catch (error) {
      console.error(`[GameStateService] Erro ao avançar:`, error);

      // Fallback simples
      try {
        const fallbackEnemyResult = await MonsterService.getEnemyForFloor(nextFloor);
        if (fallbackEnemyResult.success && fallbackEnemyResult.data) {
          const fallbackEnemy = fallbackEnemyResult.data;
          const fallbackFloor = {
            floorNumber: nextFloor,
            type: 'common' as const,
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
            gameMessage: `Andar ${nextFloor}: ${fallbackEnemy.name} apareceu!`,
            isPlayerTurn: true,
            battleRewards: null,
            mode: 'battle',
            selectedSpell: null,
          };
        }
      } catch (fallbackError) {
        console.error('[GameStateService] Falha no fallback:', fallbackError);
      }

      return {
        ...gameState,
        gameMessage: `Erro ao avançar para andar ${nextFloor}. Retorne ao hub.`,
      };
    }
  }
}
