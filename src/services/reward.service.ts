import { useGameStateStore } from '@/stores/useGameStateStore';

import { type GamePlayer, type BattleRewards } from '../models/game.model';
import { CharacterService } from './character.service';
import { ConsumableService } from './consumable.service';
import { FloorService } from './floor.service';
import type { MonsterDropChance } from '@/models/monster.model';

export class RewardService {
  /**
   * Processar a derrota do inimigo e calcular recompensas
   * Agora integrado com Zustand stores para gestão de estado
   */
  static async processEnemyDefeat(): Promise<void> {
    const { gameState, updateGameState, setError } = useGameStateStore.getState();

    try {
      const { player, currentEnemy, currentFloor } = gameState;

      if (!currentEnemy || !currentFloor) {
        console.warn('[RewardService] Estado inválido para processar derrota');
        setError('Estado inválido para processar recompensas');
        return;
      }

      if (!player?.id) {
        console.error('[RewardService] Jogador não encontrado');
        setError('Jogador não encontrado');
        return;
      }

      // Evitar processamento duplicado
      if (gameState.battleRewards) {
        console.warn('[RewardService] Tentativa de reprocessamento - ignorando');
        return;
      }

      // Calcular recompensas
      const baseXP = currentEnemy.reward_xp || 10;
      const baseGold = currentEnemy.reward_gold || 5;
      const { xp, gold } = FloorService.calculateFloorRewards(baseXP, baseGold, currentFloor.type);

      // Persistir XP
      const xpResult = await CharacterService.grantSecureXP(player.id, xp, 'combat');
      if (!xpResult.success) {
        throw new Error(`Falha ao conceder XP: ${xpResult.error}`);
      }
      const xpData = xpResult.data!;

      // Persistir Gold
      const goldResult = await CharacterService.grantSecureGold(player.id, gold);
      if (!goldResult.success) {
        throw new Error(`Falha ao conceder gold: ${goldResult.error}`);
      }
      const newGoldTotal = goldResult.data!;

      // Processar drops
      const drops = await this.processMonsterDrops(currentEnemy, currentFloor, player.id);

      // Criar recompensas
      const battleRewards: BattleRewards = {
        xp,
        gold,
        drops,
        leveledUp: xpData.leveled_up,
        newLevel: xpData.leveled_up ? xpData.new_level : undefined,
      };

      // Atualizar player nas stores
      const updatedPlayer: GamePlayer = {
        ...player,
        xp: xpData.new_xp,
        level: xpData.new_level,
        gold: newGoldTotal,
      };

      // Atualizar gameState
      updateGameState(draft => {
        draft.player = updatedPlayer;
        draft.battleRewards = battleRewards;
        draft.isPlayerTurn = true;
        draft.gameMessage = `Inimigo derrotado! +${xp} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`;
      });
    } catch (error) {
      console.error('[RewardService] Erro ao processar derrota:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(`Erro ao processar recompensas: ${errorMessage}`);

      // Atualizar gameState com erro
      updateGameState(draft => {
        draft.isPlayerTurn = true;
        draft.gameMessage = `Erro ao processar derrota: ${errorMessage}`;
      });
    }
  }

  /**
   * Processar drops de monstros - método auxiliar extraído
   * @private
   */
  private static async processMonsterDrops(
    currentEnemy: { level: number; possible_drops?: unknown[] },
    currentFloor: { type: string },
    playerId: string
  ): Promise<{ name: string; quantity: number }[]> {
    let drops: { name: string; quantity: number }[] = [];

    if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
      const dropsObtidos = ConsumableService.processMonsterDrops(
        currentEnemy.level,
        currentEnemy.possible_drops as MonsterDropChance[],
        currentFloor.type === 'boss' ? 1.5 : 1.0
      );

      if (dropsObtidos.length > 0) {
        const dropIds = dropsObtidos.map(d => d.drop_id);
        const dropInfoResponse = await ConsumableService.getDropInfoByIds(dropIds);

        if (dropInfoResponse.success && dropInfoResponse.data) {
          drops = dropsObtidos.map(dropObtido => {
            const dropInfo = dropInfoResponse.data!.find(d => d.id === dropObtido.drop_id);
            return {
              name: dropInfo?.name || `Item Desconhecido (${dropObtido.drop_id})`,
              quantity: dropObtido.quantity,
            };
          });

          // Persistir drops
          const addDropsResult = await ConsumableService.addDropsToInventory(
            playerId,
            dropsObtidos
          );
          if (!addDropsResult.success) {
            throw new Error(`Falha ao persistir drops: ${addDropsResult.error}`);
          }
        } else {
          console.error(
            `[RewardService] Erro ao buscar informações dos drops:`,
            dropInfoResponse.error
          );
          drops = dropsObtidos.map(d => ({
            name: `Item ${d.drop_id.substring(0, 8)}...`,
            quantity: d.quantity,
          }));
        }
      }
    }

    return drops;
  }

  /**
   * Limpar recompensas de batalha do estado
   */
  static clearBattleRewards(): void {
    const { updateGameState } = useGameStateStore.getState();
    updateGameState(draft => {
      draft.battleRewards = null;
    });
  }

  /**
   * Verificar se há recompensas pendentes
   */
  static hasPendingRewards(): boolean {
    const { gameState } = useGameStateStore.getState();
    return gameState.battleRewards !== null;
  }

  /**
   * Obter recompensas atuais
   */
  static getCurrentRewards(): BattleRewards | null {
    const { gameState } = useGameStateStore.getState();
    return gameState.battleRewards;
  }

  /**
   * Calcular valor total das recompensas
   */
  static calculateTotalRewardValue(rewards: BattleRewards): number {
    let totalValue = rewards.gold;

    // Adicionar valor aproximado dos drops (se houver sistema de valores)
    totalValue += rewards.drops.reduce((sum, drop) => {
      // Valor base por item (pode ser refinado com sistema de raridade)
      return sum + drop.quantity * 10;
    }, 0);

    return totalValue;
  }

  /**
   * Formatar mensagem de recompensas para exibição
   */
  static formatRewardsMessage(rewards: BattleRewards): string {
    const parts: string[] = [];

    parts.push(`+${rewards.xp} XP`);
    parts.push(`+${rewards.gold} Gold`);

    if (rewards.drops.length > 0) {
      const dropText = rewards.drops.map(d => `${d.name} (${d.quantity})`).join(', ');
      parts.push(`Items: ${dropText}`);
    }

    if (rewards.leveledUp) {
      parts.push(`🎉 LEVEL UP! Nível ${rewards.newLevel}!`);
    }

    return parts.join(' • ');
  }
}
