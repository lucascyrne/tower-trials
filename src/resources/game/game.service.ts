import { type Enemy, type GameResponse, type GameState, type FloorType, type ActionType, type GamePlayer } from './game-model';
import { supabase } from '@/lib/supabase';
import { type SkillXpGain } from './skill-xp.service';
import { MonsterService } from './monster.service';
import { CharacterService } from './character.service';

// Importar serviços especializados
import { BattleService } from './services/battle.service';
import { FloorService } from './floor.service';
import { GameStateService } from './game-state.service';

// Interface para salvar o progresso do jogo
interface SaveProgressData {
  user_id: string;
  player_name: string;
  current_floor: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  highest_floor: number;
}

// Interface para carregar o progresso
interface GameProgressEntry {
  id: string;
  user_id: string;
  player_name: string;
  current_floor: number;
  level: number;
  xp: number;
  xp_next_level: number;
  gold: number;
  mana: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  hp: number;
  max_hp: number;
  highest_floor: number;
  created_at: string;
  updated_at: string;
}

export class GameService {
  /**
   * Limpar todos os caches
   */
  static clearAllCaches(): void {
    console.log('[GameService] Limpando todos os caches');
    FloorService.clearCache();
    MonsterService.clearCache();
    console.log('[GameService] Todos os caches foram limpos');
  }

  /**
   * Gerar inimigo para o andar especificado
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    try {
      console.log(`[GameService] Iniciando geração de inimigo para andar ${floor}`);
      
      const { data: monsterData, error, success } = await MonsterService.getMonsterForFloor(floor);
      
      if (!success || error || !monsterData) {
        console.error(`[GameService] Erro ao buscar monstro para andar ${floor}:`, error);
        throw new Error(`Nenhum monstro encontrado para o andar ${floor}: ${error}`);
      }

      if (!monsterData.name || !monsterData.hp || !monsterData.atk || !monsterData.def) {
        console.error(`[GameService] Dados de monstro incompletos para andar ${floor}:`, monsterData);
        throw new Error(`Dados de monstro incompletos para o andar ${floor}`);
      }

      const enemy: Enemy = {
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
          attribute_modifications: []
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
        special_abilities: monsterData.special_abilities || []
      };

      console.log(`[GameService] Monstro real gerado: ${enemy.name} (Tier ${enemy.tier || 1}, Pos ${enemy.cycle_position || 'N/A'})`);
      console.log(`[GameService] Stats: HP: ${enemy.hp}/${enemy.maxHp}, ATK: ${enemy.attack}, DEF: ${enemy.defense}, Boss: ${enemy.is_boss ? 'SIM' : 'NÃO'}`);
      
      return enemy;
    } catch (error) {
      console.error(`[GameService] Erro ao gerar inimigo para andar ${floor}:`, error);
      return null;
    }
  }

  /**
   * Salvar o progresso do jogo
   */
  static async saveGameProgress(gameState: GameState, userId: string): Promise<GameResponse> {
    const { player, currentFloor } = gameState;
    
    const progressData: SaveProgressData = {
      user_id: userId,
      player_name: player.name,
      current_floor: player.floor,
      hp: player.hp,
      max_hp: player.max_hp,
      attack: player.atk,
      defense: player.def,
      highest_floor: Math.max(player.floor, currentFloor?.floorNumber || 1)
    };

    try {
      const { data, error } = await supabase
        .from('game_progress')
        .upsert(progressData)
        .select();

      if (error) {
        console.error('Erro ao salvar progresso:', error);
        return {
          success: false,
          error: error.message,
          data: null
        };
      }

      return {
        success: true,
        error: undefined,
        data: data[0] as GameProgressEntry
      };
    } catch (error) {
      console.error('Erro geral ao salvar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }

  /**
   * Carregar o progresso do jogo
   */
  static async loadGameProgress(userId: string): Promise<GameResponse> {
    try {
      const { data, error } = await supabase
        .from('game_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao carregar progresso:', error);
        return {
          success: false,
          error: error.message,
          data: null
        };
      }

      return {
        success: true,
        error: undefined,
        data: data[0] as GameProgressEntry || null
      };
    } catch (error) {
      console.error('Erro geral ao carregar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null
      };
    }
  }

  /**
   * Processar ação do jogador - delega para BattleService
   */
  static async processPlayerAction(
    action: ActionType, 
    gameState: GameState,
    spellId?: string,
    consumableId?: string
  ): Promise<{ 
    newState: GameState;
    skipTurn: boolean;
    message: string;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
    gameLogMessages?: { message: string; type: 'player_action' | 'damage' | 'system' | 'skill_xp' }[];
  }> {
    console.log(`[GameService] Delegando ação do jogador para BattleService: ${action}`);
    return BattleService.processPlayerAction(action, gameState, spellId, consumableId);
  }



  /**
   * Processar a derrota do inimigo - delega para RewardService
   */
  static async processEnemyDefeat(gameState: GameState): Promise<GameState> {
    console.log('[GameService] Delegando processamento de derrota do inimigo para RewardService');
    const { RewardService } = await import('./reward.service');
    return RewardService.processEnemyDefeat(gameState);
  }

  /**
   * Processar ação do inimigo com delay - delega para BattleService
   */
  static async processEnemyActionWithDelay(
    gameState: GameState, 
    playerDefendAction: boolean,
    delayMs?: number
  ): Promise<{
    newState: GameState;
    skillXpGains?: SkillXpGain[];
    skillMessages?: string[];
  }> {
    console.log('[GameService] === PROCESSANDO TURNO DO INIMIGO ===');
    
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      console.log('[GameService] Inimigo morto antes do delay - cancelando ação');
      return { newState: gameState };
    }
    
    const finalDelay = delayMs ?? (1500 + Math.random() * 1000);
    
    const enemyName = gameState.currentEnemy?.name || 'Inimigo';
    console.log(`[GameService] ${enemyName} está pensando... (${Math.round(finalDelay)}ms)`);
    
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      console.log('[GameService] Inimigo morto após delay - cancelando ação');
      return { newState: gameState };
    }
    
    console.log(`[GameService] ${enemyName} decidiu sua ação!`);
    
    // Delegar para BattleService
    return BattleService.processEnemyAction(gameState, playerDefendAction);
  }

  /**
   * Avançar para o próximo andar após coletar recompensas
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    const { player } = gameState;
    const nextFloor = player.floor + 1;
    
    console.log(`[GameService] Avançando do andar ${player.floor} para ${nextFloor}`);

    try {
      // REMOVIDO: Limpeza excessiva de cache que pode causar loops
      // console.log(`[GameService] === LIMPANDO CACHES ANTES DE AVANÇAR ===`);
      // this.clearAllCaches(); // REMOVIDO para evitar invalidações desnecessárias

      console.log(`[GameService] === ATUALIZANDO ANDAR NO BANCO ===`);
      console.log(`[GameService] Personagem: ${player.id}`);
      console.log(`[GameService] Andar atual: ${player.floor} -> Próximo andar: ${nextFloor}`);
      
      const updateResult = await CharacterService.updateCharacterFloor(player.id, nextFloor);
      if (!updateResult.success) {
        console.error(`[GameService] ERRO ao atualizar andar:`, updateResult.error);
        throw new Error(updateResult.error || 'Erro ao atualizar andar do personagem');
      }
      console.log(`[GameService] === ANDAR ATUALIZADO NO BANCO: ${nextFloor} ===`);

      // Usar FloorService para obter dados do andar
      console.log(`[GameService] Carregando dados do andar ${nextFloor}...`);
      const nextFloorData = await FloorService.getFloorData(nextFloor);
      if (!nextFloorData) {
        throw new Error(`Erro ao gerar dados do andar ${nextFloor}`);
      }

      console.log(`[GameService] Dados do andar ${nextFloor} carregados:`, nextFloorData.description);

      console.log(`[GameService] === GERANDO INIMIGO PARA ANDAR ${nextFloor} ===`);
      
      const nextEnemy = await this.generateEnemy(nextFloor);
      
      if (!nextEnemy) {
        console.error(`[GameService] Falha ao gerar inimigo para andar ${nextFloor}`);
        throw new Error(`Falha ao gerar inimigo para o andar ${nextFloor}`);
      }

      console.log(`[GameService] Inimigo gerado: ${nextEnemy.name} (HP: ${nextEnemy.hp}/${nextEnemy.maxHp})`);

      // Verificar evento especial usando FloorService
      const specialEvent = await FloorService.checkForSpecialEvent(nextFloor);

      const newGameState: GameState = {
        ...gameState,
        mode: specialEvent ? 'special_event' : 'battle',
        player: {
          ...player,
          floor: nextFloor,
          isPlayerTurn: true,
          isDefending: false,
          potionUsedThisTurn: false,
          defenseCooldown: Math.max(0, (player.defenseCooldown || 0) - 1)
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
        highestFloor: Math.max(gameState.highestFloor || 0, nextFloor)
      };

      console.log(`[GameService] Estado do jogo atualizado para andar ${nextFloor} com sucesso`);
      console.log(`[GameService] - Modo: ${newGameState.mode}`);
      console.log(`[GameService] - Andar: ${newGameState.currentFloor?.description}`);
      console.log(`[GameService] - Inimigo: ${newGameState.currentEnemy?.name || 'N/A'}`);
      console.log(`[GameService] - Evento: ${newGameState.currentSpecialEvent?.name || 'N/A'}`);
      
      return newGameState;

    } catch (error) {
      console.error(`[GameService] Erro crítico ao avançar para andar ${nextFloor}:`, error);
      
      console.log(`[GameService] Tentando criar estado de fallback para andar ${nextFloor}...`);
      
      try {
        const fallbackEnemy = await this.generateEnemy(nextFloor);
        
        if (!fallbackEnemy) {
          throw new Error(`Não foi possível gerar inimigo para o andar ${nextFloor}`);
        }
        
        const fallbackFloor = {
          floorNumber: nextFloor,
          type: 'common' as FloorType,
          isCheckpoint: nextFloor % 10 === 0,
          minLevel: Math.max(1, Math.floor(nextFloor / 5)),
          description: `Andar ${nextFloor} - Área Desconhecida`
        };
        
        console.log(`[GameService] Estado de fallback criado para andar ${nextFloor}`);
        
        return {
          ...gameState,
          player: {
            ...player,
            floor: nextFloor,
            isPlayerTurn: true,
            isDefending: false,
            potionUsedThisTurn: false
          },
          currentFloor: fallbackFloor,
          currentEnemy: fallbackEnemy,
          currentSpecialEvent: null,
          gameMessage: `Andar ${nextFloor}: ${fallbackFloor.description}. Um ${fallbackEnemy.name} apareceu!`,
          isPlayerTurn: true,
          battleRewards: null,
          mode: 'battle',
          selectedSpell: null
        };
      } catch (fallbackError) {
        console.error(`[GameService] Falha ao criar estado de fallback:`, fallbackError);
        
        return {
          ...gameState,
          gameMessage: `Erro crítico ao avançar para o andar ${nextFloor}: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Retorne ao hub e tente novamente.`
        };
      }
    }
  }

  /**
   * Processar interação com evento especial - delega para FloorService
   */
  static async processSpecialEventInteraction(
    gameState: GameState,
  ): Promise<GameState> {
    return FloorService.processSpecialEventInteraction(gameState);
  }

  /**
   * Carregar personagem com todos os dados necessários para o jogo - delega para GameStateService
   */
  static async loadPlayerForGame(characterId: string): Promise<GamePlayer> {
    return GameStateService.loadPlayerForGame(characterId);
  }

  // =====================================
  // MÉTODOS DELEGADOS PARA MANTER COMPATIBILIDADE
  // =====================================

  // Delegações para BattleService
  static calculateInitiative = BattleService.calculateInitiative;
  static calculateExtraTurns = BattleService.calculateExtraTurns;
  static calculateDamage = BattleService.calculateDamage;
  static processEnemyAction = BattleService.processEnemyAction;

  // Delegações para FloorService
  static getFloorData = FloorService.getFloorData;
  static calculateFloorRewards = FloorService.calculateFloorRewards;
} 