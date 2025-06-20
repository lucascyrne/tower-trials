import { type Character } from '@/models/character.model';
import { type GameState, type GamePlayer, type Enemy } from '@/models/game.model';
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

      console.log(`[BattleInit] Iniciando batalha para ${targetCharacter.name}`);

      onProgress?.({ step: 'character', progress: 25, message: 'Carregando personagem...' });

      // ✅ CORREÇÃO CRÍTICA: Carregar dados com auto-heal aplicado para fonte única de verdade
      console.log(
        `[BattleInit] Carregando dados de GamePlayer para ${targetCharacter.name} com auto-heal`
      );
      const characterResponse = await CharacterService.getCharacterForGame(
        targetCharacter.id,
        true,
        true
      );
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Falha ao carregar personagem');
      }
      const gamePlayer = characterResponse.data as GamePlayer;
      console.log(`[BattleInit] Personagem carregado - HP: ${gamePlayer.hp}/${gamePlayer.max_hp}`);

      // Validação
      if (!gamePlayer || !gamePlayer.id) {
        throw new Error('Dados do personagem inválidos ou incompletos');
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

      // 4. 🔧 CORREÇÃO CRÍTICA: SEMPRE gerar inimigo, mesmo com evento especial
      let enemy = null;
      onProgress?.({ step: 'enemy', progress: 85, message: 'Gerando inimigo...' });
      const enemyResult = await MonsterService.getEnemyForFloor(gamePlayer.floor);

      // 🔧 GARANTIA: Se falhar, forçar geração via fallback
      if (!enemyResult.success || !enemyResult.data) {
        console.warn(
          `[BattleInit] Falha na geração normal - usando fallback para andar ${gamePlayer.floor}`
        );
        // Tentar novamente usando MonsterService diretamente
        try {
          const fallbackResult = await this.generateFallbackEnemy(gamePlayer.floor);
          enemy = fallbackResult;
          console.log(`[BattleInit] Fallback gerado: ${enemy.name}`);
        } catch (fallbackError) {
          throw new Error(`Falha crítica na geração de inimigo: ${fallbackError}`);
        }
      } else {
        enemy = enemyResult.data;
      }

      // 🔧 VALIDAÇÃO FINAL: Garantir que o inimigo foi criado
      if (!enemy || !enemy.id) {
        throw new Error('Falha crítica: Inimigo não pôde ser gerado');
      }

      onProgress?.({ step: 'complete', progress: 100, message: 'Batalha pronta!' });

      // 5. 🔧 CORREÇÃO: Construir estado com modo correto baseado no contexto
      const isBattleMode = !specialEvent || gamePlayer.floor % 5 === 0; // Boss sempre é batalha
      const gameState: GameState = {
        mode: isBattleMode ? 'battle' : 'special_event',
        player: {
          ...gamePlayer,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (gamePlayer.defenseCooldown || 0) - 1),
        },
        currentFloor: floorData,
        currentEnemy: enemy, // 🔧 SEMPRE definir inimigo
        currentSpecialEvent: isBattleMode ? null : specialEvent, // Só ter evento se não for batalha
        isPlayerTurn: true,
        gameMessage: isBattleMode
          ? `Andar ${floorData.floorNumber}: ${enemy.name} apareceu!`
          : `Evento especial: ${specialEvent?.name}! Mas ${enemy.name} também está presente!`,
        highestFloor: Math.max(gamePlayer.floor, floorData.floorNumber),
        selectedSpell: null,
        battleRewards: null,
        fleeSuccessful: false,
        characterDeleted: false,
      };

      // 🔧 VALIDAÇÃO FINAL DO ESTADO
      console.log(`[BattleInit] Estado gerado:`, {
        mode: gameState.mode,
        hasEnemy: Boolean(gameState.currentEnemy),
        enemyName: gameState.currentEnemy?.name,
        hasEvent: Boolean(gameState.currentSpecialEvent),
        eventName: gameState.currentSpecialEvent?.name,
        playerFloor: gameState.player.floor,
      });

      console.log(
        `[BattleInit] ✅ Batalha inicializada com sucesso para ${targetCharacter.name} - Andar ${gamePlayer.floor} - Inimigo: ${enemy.name}`
      );
      return { success: true, gameState };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[BattleInit] ❌ Falha:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 🔧 NOVO: Método para gerar inimigo de fallback diretamente
   */
  private static generateFallbackEnemy(floor: number): Enemy {
    const level = Math.max(1, Math.floor(floor / 5) + 1);
    const tier = Math.max(1, Math.floor(floor / 20) + 1);
    const isBoss = floor % 10 === 0;

    const monsterNames = [
      'Slime',
      'Goblin',
      'Orc',
      'Skeleton',
      'Wolf',
      'Spider',
      'Troll',
      'Dragon',
    ];
    const nameIndex = Math.floor(floor / 2) % monsterNames.length;
    const baseName = monsterNames[nameIndex];
    const name = `${isBoss ? 'Boss ' : ''}${baseName}${tier > 1 ? ` T${tier}` : ''}`;

    const baseHp = isBoss ? 80 : 50;
    const baseAtk = isBoss ? 15 : 10;
    const baseDef = isBoss ? 8 : 5;

    const hp = Math.floor(baseHp + level * 15 + tier * 25);
    const atk = Math.floor(baseAtk + level * 3 + tier * 5);
    const def = Math.floor(baseDef + level * 2 + tier * 3);
    const speed = Math.floor(10 + level * 1 + tier * 2);

    const reward_xp = Math.floor((5 + level * 2 + tier * 2) * (isBoss ? 2.5 : 1));
    const reward_gold = Math.floor((3 + level * 1 + tier * 1) * (isBoss ? 2.5 : 1));

    return {
      id: `fallback_${floor}_${Date.now()}`,
      name,
      level,
      hp,
      maxHp: hp,
      attack: atk,
      defense: def,
      speed,
      image: isBoss ? '👑' : '👾',
      behavior: 'balanced',
      mana: Math.floor(20 + level * 5),
      reward_xp,
      reward_gold,
      possible_drops: [],
      active_effects: {
        buffs: [],
        debuffs: [],
        dots: [],
        hots: [],
        attribute_modifications: [],
      },
      tier,
      base_tier: 1,
      cycle_position: ((floor - 1) % 20) + 1,
      is_boss: isBoss,
      strength: Math.floor(10 + level * 2),
      dexterity: Math.floor(10 + level * 1),
      intelligence: Math.floor(8 + level * 1),
      wisdom: Math.floor(8 + level * 1),
      vitality: Math.floor(12 + level * 2),
      luck: Math.floor(5 + level),
      critical_chance: 0.05 + level * 0.005,
      critical_damage: 1.5 + level * 0.05,
      critical_resistance: 0.1,
      physical_resistance: 0.0,
      magical_resistance: 0.0,
      debuff_resistance: 0.0,
      physical_vulnerability: 1.0,
      magical_vulnerability: 1.0,
      primary_trait: isBoss ? 'boss' : 'common',
      secondary_trait: 'basic',
      special_abilities: isBoss ? ['Boss Fury'] : [],
    };
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
