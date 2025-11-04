import { type Character } from '@/models/character.model';
import { type GameState, type GamePlayer } from '@/models/game.model';
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
   * MÉTODO CORRIGIDO: Inicializar batalha garantindo que sempre haja inimigo quando necessário
   * Agora integrado com Zustand stores para melhor gerenciamento de estado
   */
  static async initializeBattle(
    character?: Character,
    onProgress?: (progress: { step: string; progress: number; message: string }) => void
  ): Promise<InitializationResult> {
    try {
      // ✅ CORREÇÃO: NÃO acessar stores diretamente nos services
      // O personagem deve ser sempre fornecido pelos componentes/hooks
      const targetCharacter = character;

      if (!targetCharacter) {
        throw new Error('Nenhum personagem deve ser fornecido para inicializar batalha');
      }

      onProgress?.({ step: 'character', progress: 25, message: 'Carregando personagem...' });

      // ✅ CORREÇÃO CRÍTICA: Carregar dados com auto-heal aplicado para fonte única de verdade
      const characterResponse = await CharacterService.getCharacterForGame(
        targetCharacter.id,
        true,
        true
      );
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Falha ao carregar personagem');
      }
      const gamePlayer = characterResponse.data as GamePlayer;

      // Validação
      if (!gamePlayer || !gamePlayer.id) {
        throw new Error('Dados do personagem inválidos ou incompletos');
      }

      // ✅ CORREÇÃO CRÍTICA: Garantir que floor seja sempre >= 1
      if (gamePlayer.floor <= 0) {
        console.warn(
          `[BattleInit] ⚠️ Floor inválido detectado (${gamePlayer.floor}), corrigindo para 1`
        );
        gamePlayer.floor = 1;
        // Atualizar no banco para corrigir dados inconsistentes
        try {
          await CharacterService.updateCharacterFloor(gamePlayer.id, 1);
        } catch (updateError) {
          console.error(`[BattleInit] ❌ Erro ao corrigir floor no banco:`, updateError);
        }
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

      // 3. 🔧 CRÍTICO: Carregar inimigo DO BANCO - sem fallbacks
      onProgress?.({ step: 'enemy', progress: 85, message: 'Carregando inimigo...' });
      const enemyResult = await MonsterService.getEnemyForFloor(gamePlayer.floor, true); // ✅ forceRefresh=true para garantir drops

      // ✅ CRÍTICO: Sem fallback - se falhar, retornar erro claro
      if (!enemyResult.success || !enemyResult.data) {
        const errorMsg =
          enemyResult.error || `Falha ao carregar monstro para andar ${gamePlayer.floor}`;
        console.error(`[BattleInit] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const enemy = enemyResult.data;

      // 🔧 VALIDAÇÃO FINAL: Garantir que o inimigo foi criado
      if (!enemy || !enemy.id) {
        throw new Error('Falha crítica: Inimigo não pôde ser gerado');
      }

      onProgress?.({ step: 'complete', progress: 100, message: 'Batalha pronta!' });

      // 4. 🔧 Construir estado com modo batalha
      const gameState: GameState = {
        mode: 'battle',
        player: {
          ...gamePlayer,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (gamePlayer.defenseCooldown || 0) - 1),
        },
        currentFloor: floorData,
        currentEnemy: enemy,
        isPlayerTurn: true,
        gameMessage: `Andar ${floorData.floorNumber}: ${enemy.name} apareceu!`,
        highestFloor: Math.max(gamePlayer.floor, floorData.floorNumber),
        selectedSpell: null,
        battleRewards: null,
        fleeSuccessful: false,
        characterDeleted: false,
      };

      // ✅ CORREÇÃO CRÍTICA: Resetar cooldowns das magias para cada nova batalha
      const { SpellService } = await import('./spell.service');
      const gameStateWithResetCooldowns = SpellService.resetSpellCooldowns(gameState);

      return { success: true, gameState: gameStateWithResetCooldowns };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[BattleInit] ❌ Falha:`, errorMessage);
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
