import { type GameState, type GamePlayer, type BattleRewards } from './game-model';
import { CharacterService } from './character/character.service';
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
        console.warn('[RewardService] Estado inválido para processar derrota do inimigo');
        return gameState;
      }

      // Evitar processamento duplicado
      if (gameState.battleRewards) {
        console.warn(
          '[RewardService] Tentativa de processar derrota de inimigo que já possui recompensas - ignorando'
        );
        return gameState;
      }

      // Calcular recompensas base
      const baseXP = currentEnemy.reward_xp || 10;
      const baseGold = currentEnemy.reward_gold || 5;

      // Aplicar multiplicadores baseados no tipo de andar
      const { xp, gold } = FloorService.calculateFloorRewards(baseXP, baseGold, currentFloor.type);

      console.log(`[RewardService] Recompensas calculadas - XP: ${xp}, Gold: ${gold}`);

      // Persistir XP no banco de dados
      console.log(`[RewardService] === PERSISTINDO XP NO BANCO ===`);
      const xpResult = await CharacterService.grantSecureXP(player.id, xp, 'combat');
      if (!xpResult.success) {
        console.error('[RewardService] Erro ao conceder XP:', xpResult.error);
        throw new Error(`Falha ao conceder XP: ${xpResult.error}`);
      }

      const xpData = xpResult.data!;
      console.log(
        `[RewardService] XP persistido - Level: ${xpData.new_level}, XP: ${xpData.new_xp}, Level Up: ${xpData.leveled_up}`
      );

      // Persistir Gold no banco de dados
      console.log(`[RewardService] === PERSISTINDO GOLD NO BANCO ===`);
      const goldResult = await CharacterService.grantSecureGold(player.id, gold, 'combat');
      if (!goldResult.success) {
        console.error('[RewardService] Erro ao conceder gold:', goldResult.error);
        throw new Error(`Falha ao conceder gold: ${goldResult.error}`);
      }

      const newGoldTotal = goldResult.data!;
      console.log(`[RewardService] Gold persistido - Total: ${newGoldTotal}`);

      // Processar drops do monstro
      console.log(`[RewardService] === PROCESSANDO DROPS ===`);

      let drops: { name: string; quantity: number }[] = [];
      let dropsObtidos: { drop_id: string; quantity: number }[] = [];

      if (currentEnemy.possible_drops && currentEnemy.possible_drops.length > 0) {
        console.log(
          `[RewardService] Monstro ${currentEnemy.name} tem ${currentEnemy.possible_drops.length} possible_drops`
        );

        dropsObtidos = ConsumableService.processMonsterDrops(
          currentEnemy.level,
          currentEnemy.possible_drops,
          currentFloor.type === 'boss' ? 1.5 : 1.0
        );

        console.log(`[RewardService] Drops obtidos: ${dropsObtidos.length} itens`);

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

            console.log(
              `[RewardService] Drops identificados:`,
              drops.map(d => `${d.quantity}x ${d.name}`).join(', ')
            );
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

          // Persistir drops no inventário
          console.log(`[RewardService] === PERSISTINDO DROPS NO BANCO ===`);
          const addDropsResult = await ConsumableService.addDropsToInventory(
            player.id,
            dropsObtidos
          );

          if (!addDropsResult.success) {
            console.error(`[RewardService] Erro ao persistir drops:`, addDropsResult.error);
            throw new Error(`Falha ao persistir drops: ${addDropsResult.error}`);
          }

          console.log(
            `[RewardService] ${addDropsResult.data} drops persistidos com sucesso no inventário`
          );
        }
      }

      // Criar objeto de recompensas
      const battleRewards: BattleRewards = {
        xp,
        gold,
        drops,
        leveledUp: xpData.leveled_up,
        newLevel: xpData.leveled_up ? xpData.new_level : undefined,
      };

      // Atualizar estado do jogador
      const updatedPlayer: GamePlayer = {
        ...player,
        xp: xpData.new_xp,
        level: xpData.new_level,
        gold: newGoldTotal,
      };

      console.log(`[RewardService] === DERROTA PROCESSADA COM PERSISTÊNCIA ===`);
      console.log(
        `[RewardService] - Level: ${updatedPlayer.level} (Level Up: ${xpData.leveled_up})`
      );
      console.log(`[RewardService] - XP: ${updatedPlayer.xp}/${xpData.new_xp_next_level}`);
      console.log(`[RewardService] - Gold: ${updatedPlayer.gold}`);
      console.log(`[RewardService] - Drops: ${drops.length} itens`);

      return {
        ...gameState,
        player: updatedPlayer,
        battleRewards,
        isPlayerTurn: true,
        gameMessage: `Inimigo derrotado! +${xp} XP, +${gold} Gold${battleRewards.leveledUp ? ` - LEVEL UP!` : ''}`,
      };
    } catch (error) {
      console.error('[RewardService] Erro ao processar derrota do inimigo:', error);

      return {
        ...gameState,
        isPlayerTurn: true,
        gameMessage: `Erro ao processar derrota do inimigo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }
}
