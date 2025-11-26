import {
  type Enemy,
  type GameResponse,
  type GameState,
  type ActionType,
  type GamePlayer,
} from '@/resources/game/game.model';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { supabase } from '@/lib/supabase';
import { type SkillXpGain } from '../character/skill-xp.service';
import { MonsterService } from '../monster/monster.service';
import { BattleService } from '../battle/battle.service';
import { CacheService } from '../cache/cache.service';
import { RewardService } from '../monster/reward.service';
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
    CacheService.clearAllGameCaches();
  }

  /**
   * Gerar inimigo para o andar
   */
  static async generateEnemy(floor: number): Promise<Enemy | null> {
    try {
      const { data: enemy, success } = await MonsterService.getEnemyForFloor(floor);
      return success && enemy ? enemy : null;
    } catch (error) {
      console.error(`[GameService] Erro ao gerar inimigo:`, error);
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
      highest_floor: Math.max(player.floor, currentFloor?.floorNumber || 1),
    };

    try {
      const { data, error } = await supabase.from('game_progress').upsert(progressData).select();

      if (error) {
        console.error('Erro ao salvar progresso:', error);
        return {
          success: false,
          error: error.message,
          data: null,
        };
      }

      return {
        success: true,
        error: undefined,
        data: data[0] as GameProgressEntry,
      };
    } catch (error) {
      console.error('Erro geral ao salvar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
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
          data: null,
        };
      }

      return {
        success: true,
        error: undefined,
        data: (data[0] as GameProgressEntry) || null,
      };
    } catch (error) {
      console.error('Erro geral ao carregar:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: null,
      };
    }
  }

  /**
   * Processar ação do jogador
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
    gameLogMessages?: {
      message: string;
      type: 'player_action' | 'damage' | 'system' | 'skill_xp';
    }[];
  }> {
    return BattleService.processPlayerAction(action, gameState, spellId, consumableId);
  }

  /**
   * Processar derrota do inimigo
   */
  static async processEnemyDefeat(): Promise<GameState> {
    await RewardService.processEnemyDefeat();
    return useGameStateStore.getState().gameState;
  }

  /**
   * Processar ação do inimigo com delay
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
    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      return { newState: gameState };
    }

    const finalDelay = delayMs ?? 1500 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, finalDelay));

    if (!gameState.currentEnemy || gameState.currentEnemy.hp <= 0) {
      return { newState: gameState };
    }

    return BattleService.processEnemyAction(gameState, playerDefendAction);
  }

  /**
   * Avançar para o próximo andar
   */
  static async advanceToNextFloor(gameState: GameState): Promise<GameState> {
    return GameStateService.advanceToNextFloor(gameState);
  }

  /**
   * Carregar personagem para o jogo
   * ✅ CORREÇÃO CRÍTICA: Passar parâmetro de force refresh para garantir dados atualizados
   */
  static async loadPlayerForGame(
    characterId: string,
    forceRefresh: boolean = false
  ): Promise<GamePlayer> {
    return GameStateService.loadPlayerForGame(characterId, forceRefresh);
  }

  // Métodos delegados para BattleService
  static calculateInitiative = BattleService.calculateInitiative;
  static calculateExtraTurns = BattleService.calculateExtraTurns;
  static calculateDamage = BattleService.calculateDamage;
  static processEnemyAction = BattleService.processEnemyAction;
}
