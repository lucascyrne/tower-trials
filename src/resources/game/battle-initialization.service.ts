import { type Character } from './character.model';
import { type GameState } from './game-model';
import { CharacterService } from './character.service';
import { FloorService } from './floor.service';
import { MonsterService } from './monster.service';

interface InitializationResult {
  success: boolean;
  gameState?: GameState;
  error?: string;
}

export class BattleInitializationService {
  /**
   * MÉTODO SIMPLIFICADO: Inicializar batalha de forma direta
   */
  static async initializeBattle(
    character: Character,
    onProgress?: (progress: { step: string; progress: number; message: string }) => void,
    gamePlayerData?: any // NOVO: Dados já carregados do GamePlayer (opcional)
  ): Promise<InitializationResult> {
    try {
      console.log(`[BattleInit] Iniciando batalha para ${character.name}`);

      onProgress?.({ step: 'character', progress: 25, message: 'Carregando personagem...' });

      // OTIMIZADO: Usar dados já carregados se disponíveis, senão buscar
      let gamePlayer: any;

      if (gamePlayerData && gamePlayerData.id === character.id) {
        console.log(
          `[BattleInit] Reutilizando dados de GamePlayer já carregados para ${character.name}`
        );
        gamePlayer = gamePlayerData;
      } else {
        console.log(`[BattleInit] Carregando dados de GamePlayer para ${character.name}`);
        const characterResponse = await CharacterService.getCharacterForGame(character.id);
        if (!characterResponse.success || !characterResponse.data) {
          throw new Error(characterResponse.error || 'Falha ao carregar personagem');
        }
        gamePlayer = characterResponse.data;
      }

      onProgress?.({
        step: 'floor',
        progress: 50,
        message: `Carregando andar ${gamePlayer.floor}...`,
      });

      // 2. Carregar dados do andar (com cache interno do FloorService)
      const floorData = await FloorService.getFloorData(gamePlayer.floor);
      if (!floorData) {
        throw new Error(`Falha ao carregar andar ${gamePlayer.floor}`);
      }

      onProgress?.({ step: 'event', progress: 70, message: 'Verificando eventos...' });

      // 3. Verificar evento especial (chance muito baixa)
      const specialEvent = await FloorService.checkForSpecialEvent(gamePlayer.floor);

      // 4. Gerar inimigo se não há evento
      let enemy = null;
      if (!specialEvent) {
        onProgress?.({ step: 'enemy', progress: 85, message: 'Gerando inimigo...' });
        const enemyResult = await MonsterService.getEnemyForFloor(gamePlayer.floor);
        if (!enemyResult.success || !enemyResult.data) {
          throw new Error(`Falha ao gerar inimigo para andar ${gamePlayer.floor}`);
        }
        enemy = enemyResult.data;
      }

      onProgress?.({ step: 'complete', progress: 100, message: 'Batalha pronta!' });

      // 5. Construir estado final
      const gameState: GameState = {
        mode: specialEvent ? 'special_event' : 'battle',
        player: {
          ...gamePlayer,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (gamePlayer.defenseCooldown || 0) - 1),
        },
        currentFloor: floorData,
        currentEnemy: enemy,
        currentSpecialEvent: specialEvent,
        isPlayerTurn: true,
        gameMessage: specialEvent
          ? `Evento especial: ${specialEvent.name}!`
          : `Andar ${floorData.floorNumber}: ${enemy?.name} apareceu!`,
        highestFloor: Math.max(gamePlayer.floor, floorData.floorNumber),
        selectedSpell: null,
        battleRewards: null,
        fleeSuccessful: false,
        characterDeleted: false,
      };

      console.log(
        `[BattleInit] Batalha inicializada com sucesso para ${character.name} - Andar ${gamePlayer.floor}`
      );
      return { success: true, gameState };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[BattleInit] Falha:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Verificar se o sistema está saudável para inicialização
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    services: Record<string, boolean>;
  }> {
    const issues: string[] = [];
    const services: Record<string, boolean> = {};

    try {
      // Testar MonsterService
      try {
        await MonsterService.getEnemyForFloor(1);
        services.monster = true;
      } catch {
        services.monster = false;
        issues.push('MonsterService indisponível');
      }

      // Testar FloorService
      try {
        await FloorService.getFloorData(1);
        services.floor = true;
      } catch {
        services.floor = false;
        issues.push('FloorService indisponível');
      }

      // Testar CharacterService
      try {
        await CharacterService.getUserCharacters('test-health-check');
        services.character = true;
      } catch {
        services.character = false;
        issues.push('CharacterService indisponível');
      }

      return {
        healthy: issues.length === 0,
        issues,
        services,
      };
    } catch {
      return {
        healthy: false,
        issues: ['Falha crítica no health check'],
        services: {},
      };
    }
  }
}
