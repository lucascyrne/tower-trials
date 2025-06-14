import { type GameState, type GamePlayer, type BattleRewards } from './game-model';
import { CharacterService } from './character.service';
import { ConsumableService } from './consumable.service';
import { FloorService } from './floor.service';

export class RewardService {
  /**
   * Processar a derrota do inimigo e calcular recompensas
   */
  static async processEnemyDefeat(gameState: GameState): Promise<GameState> {
    try {
      console.log('[RewardService] Processando derrota do inimigo');

      const { player, currentEnemy, currentFloor } = gameState;

      if (!currentEnemy || !currentFloor) {
        console.warn('[RewardService] Estado inválido para processar derrota');
        return gameState;
      }

      // Evitar processamento duplicado
      if (gameState.battleRewards) {
        console.warn('[RewardService] Tentativa de reprocessamento - ignorando');
        return gameState;
      }

      // Calcular recompensas
      const baseXP = currentEnemy.reward_xp || 10;
      const baseGold = currentEnemy.reward_gold || 5;
      const { xp, gold } = FloorService.calculateFloorRewards(baseXP, baseGold, currentFloor.type);

      console.log(`[RewardService] Recompensas - XP: ${xp}, Gold: ${gold}`);

      // Persistir XP
      const xpResult = await CharacterService.grantSecureXP(player.id, xp, 'combat');
      if (!xpResult.success) {
        throw new Error(`Falha ao conceder XP: ${xpResult.error}`);
      }
      const xpData = xpResult.data!;

      // Persistir Gold
      const goldResult = await CharacterService.grantSecureGold(player.id, gold, 'combat');
      if (!goldResult.success) {
        throw new Error(`Falha ao conceder gold: ${goldResult.error}`);
      }
      const newGoldTotal = goldResult.data!;

      // Processar drops
      let drops: { name: string; quantity: number }[] = [];

      if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
        const dropsObtidos = ConsumableService.processMonsterDrops(
          currentEnemy.level,
          currentEnemy.possible_drops,
          currentFloor.type === 'boss' ? 1.5 : 1.0
        );

        console.log(`[RewardService] ${dropsObtidos.length} drops obtidos`);

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
              player.id,
              dropsObtidos
            );
            if (!addDropsResult.success) {
              throw new Error(`Falha ao persistir drops: ${addDropsResult.error}`);
            }

            console.log(`[RewardService] ${addDropsResult.data} drops persistidos`);
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

      // Criar recompensas
      const battleRewards: BattleRewards = {
        xp,
        gold,
        drops,
        leveledUp: xpData.leveled_up,
        newLevel: xpData.leveled_up ? xpData.new_level : undefined,
      };

      // Atualizar jogador
      const updatedPlayer: GamePlayer = {
        ...player,
        xp: xpData.new_xp,
        level: xpData.new_level,
        gold: newGoldTotal,
      };

      console.log(`[RewardService] Derrota processada:`, {
        level: updatedPlayer.level,
        levelUp: xpData.leveled_up,
        xp: updatedPlayer.xp,
        gold: updatedPlayer.gold,
        drops: drops.length,
      });

      return {
        ...gameState,
        player: updatedPlayer,
        battleRewards,
        isPlayerTurn: true,
        gameMessage: `Inimigo derrotado! +${xp} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`,
      };
    } catch (error) {
      console.error('[RewardService] Erro ao processar derrota:', error);

      return {
        ...gameState,
        isPlayerTurn: true,
        gameMessage: `Erro ao processar derrota: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }
}
