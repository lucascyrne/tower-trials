/**
 * LoggingUtils - Fonte única da verdade para todos os logs do jogo
 * Integra BattleLoggerService com useLogStore de forma transparente
 * Garante que todos os eventos importantes sejam capturados adequadamente
 */

import { type GameLogType, type BattleEventDetails } from '@/resources/game/game.model';
import { BattleLoggerService } from '@/resources/battle/battle-logger.service';
import { useLogStore } from '@/stores/useLogStore';

export interface GameEventLog {
  message: string;
  type: GameLogType;
  metadata?: Record<string, unknown>;
  importance?: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * LoggingUtils - Serviço centralizado para todos os logs do jogo
 */
export class LoggingUtils {
  private static logStore = useLogStore.getState();

  /**
   * FONTE ÚNICA: Logar evento do jogo com integração dupla
   */
  static logGameEvent(event: GameEventLog, details?: BattleEventDetails): void {
    const { message, type, metadata = {}, importance = 'normal' } = event;

    // 1. Log no console via BattleLoggerService (estruturado)
    BattleLoggerService.log(
      importance === 'critical' ? 'error' : importance === 'high' ? 'warn' : 'info',
      'GameEvent',
      message,
      { type, ...metadata, ...details }
    );

    // 2. Log no store para UI (persistente)
    this.logStore.addGameLogMessage(message, type, { ...metadata, ...details });
  }

  /**
   * AÇÃO DO JOGADOR: Log padronizado para ações do jogador
   */
  static logPlayerAction(action: string, playerName: string, details?: BattleEventDetails): void {
    this.logGameEvent(
      {
        message: `${playerName} ${action}`,
        type: 'player_action',
        importance: 'normal',
      },
      details
    );
  }

  /**
   * ATAQUE DO JOGADOR: Log específico para ataques
   */
  static logPlayerAttack(
    playerName: string,
    enemyName: string,
    damage: number,
    isCritical: boolean = false,
    isDoubleAttack: boolean = false,
    details?: BattleEventDetails
  ): void {
    let attackType = '';
    if (isDoubleAttack) attackType += 'ataque duplo ';
    if (isCritical) attackType += 'CRÍTICO ';

    const message = `${playerName} ${attackType}atacou ${enemyName} causando ${damage} de dano!`;

    this.logGameEvent(
      {
        message,
        type: 'player_action',
        importance: isCritical ? 'high' : 'normal',
        metadata: { damage, isCritical, isDoubleAttack },
      },
      { playerName, enemyName, damage, ...details }
    );

    // Log adicional para dano
    this.logDamage('player', 'enemy', damage, isCritical ? 'critical' : 'physical', {
      playerName,
      enemyName,
      ...details,
    });
  }

  /**
   * AÇÃO DO INIMIGO: Log padronizado para ações do inimigo
   */
  static logEnemyAction(action: string, enemyName: string, details?: BattleEventDetails): void {
    this.logGameEvent(
      {
        message: `${enemyName} ${action}`,
        type: 'enemy_action',
        importance: 'normal',
      },
      details
    );
  }

  /**
   * ATAQUE DO INIMIGO: Log específico para ataques do inimigo
   */
  static logEnemyAttack(
    enemyName: string,
    playerName: string,
    damage: number,
    wasDefended: boolean = false,
    isSpecial: boolean = false,
    details?: BattleEventDetails
  ): void {
    let message = '';
    if (isSpecial) {
      message = `${enemyName} usou uma habilidade especial`;
    } else {
      message = `${enemyName} atacou ${playerName}`;
    }

    if (wasDefended) {
      message += ` mas o dano foi reduzido para ${damage}`;
    } else {
      message += ` causando ${damage} de dano`;
    }
    message += '!';

    this.logGameEvent(
      {
        message,
        type: 'enemy_action',
        importance: isSpecial ? 'high' : 'normal',
        metadata: { damage, wasDefended, isSpecial },
      },
      { enemyName, playerName, damage, ...details }
    );

    // Log adicional para dano
    this.logDamage('enemy', 'player', damage, isSpecial ? 'special' : 'physical', {
      enemyName,
      playerName,
      ...details,
    });
  }

  /**
   * USO DE MAGIA: Log específico para magias
   */
  static logSpellCast(
    casterName: string,
    spellName: string,
    targetName: string,
    effectValue: number,
    effectType: 'damage' | 'heal' | 'buff' | 'debuff',
    details?: BattleEventDetails
  ): void {
    let effectMessage = '';
    switch (effectType) {
      case 'damage':
        effectMessage = `causando ${effectValue} de dano mágico`;
        break;
      case 'heal':
        effectMessage = `restaurando ${effectValue} de vida`;
        break;
      case 'buff':
        effectMessage = `aplicando efeito positivo`;
        break;
      case 'debuff':
        effectMessage = `aplicando efeito negativo`;
        break;
    }

    const message = `${casterName} lançou ${spellName} em ${targetName}, ${effectMessage}!`;

    this.logGameEvent(
      {
        message,
        type: 'player_action',
        importance: effectType === 'damage' && effectValue > 100 ? 'high' : 'normal',
        metadata: { spellName, effectValue, effectType },
      },
      { spellName, ...details }
    );
  }

  /**
   * USO DE CONSUMÍVEL: Log específico para poções e consumíveis
   */
  static logConsumableUse(
    playerName: string,
    consumableName: string,
    effect: string,
    slotPosition?: number,
    details?: BattleEventDetails
  ): void {
    let message = `${playerName} usou ${consumableName}`;
    if (slotPosition) {
      const keyBinding = this.getKeyBinding(slotPosition);
      message += ` (${keyBinding})`;
    }
    message += ` - ${effect}!`;

    this.logGameEvent(
      {
        message,
        type: 'player_action',
        importance: 'normal',
        metadata: { consumableName, effect, slotPosition },
      },
      { playerName, consumableName, ...details }
    );
  }

  /**
   * GANHO DE XP: Log específico para experiência
   */
  static logXpGain(
    playerName: string,
    xpAmount: number,
    source: 'combat' | 'skill' | 'quest',
    skillName?: string,
    details?: BattleEventDetails
  ): void {
    let message = '';
    if (source === 'skill' && skillName) {
      message = `${playerName} ganhou ${xpAmount} XP em ${skillName}!`;
    } else {
      message = `${playerName} ganhou ${xpAmount} XP!`;
    }

    this.logGameEvent(
      {
        message,
        type: source === 'skill' ? 'skill_xp' : 'system',
        importance: xpAmount >= 100 ? 'high' : 'normal',
        metadata: { xpAmount, source, skillName },
      },
      { playerName, xpGained: xpAmount, skillName, ...details }
    );
  }

  /**
   * SUBIDA DE NÍVEL: Log específico para level ups
   */
  static logLevelUp(
    playerName: string,
    newLevel: number,
    oldLevel: number,
    details?: BattleEventDetails
  ): void {
    const message = `🎉 ${playerName} subiu para o nível ${newLevel}!`;

    this.logGameEvent(
      {
        message,
        type: 'level_up',
        importance: 'critical',
        metadata: { newLevel, oldLevel },
      },
      { playerName, levelBefore: oldLevel, levelAfter: newLevel, ...details }
    );
  }

  /**
   * DANO: Log genérico para dano
   */
  static logDamage(
    source: 'player' | 'enemy',
    target: 'player' | 'enemy',
    damage: number,
    damageType: 'physical' | 'magical' | 'critical' | 'special',
    details?: BattleEventDetails
  ): void {
    // Log apenas no BattleLoggerService para evitar spam na UI
    BattleLoggerService.logDamage(source, target, damage, damageType, details);
  }

  /**
   * CURA: Log específico para cura
   */
  static logHealing(
    healerName: string,
    targetName: string,
    healAmount: number,
    source: 'spell' | 'potion' | 'natural',
    details?: BattleEventDetails
  ): void {
    const message = `${healerName} ${healerName === targetName ? 'recuperou' : `curou ${targetName}, restaurando`} ${healAmount} de vida!`;

    this.logGameEvent(
      {
        message,
        type: 'healing',
        importance: 'normal',
        metadata: { healAmount, source },
      },
      { healing: healAmount, ...details }
    );
  }

  /**
   * BATALHA INICIADA: Log de início de batalha
   */
  static logBattleStart(
    playerName: string,
    enemyName: string,
    floorNumber: number,
    details?: BattleEventDetails
  ): void {
    const message = `Batalha iniciada: ${playerName} vs ${enemyName} (Andar ${floorNumber})`;

    // ✅ CRÍTICO: Limpar logs da UI antes de iniciar nova batalha
    this.clearUILogs();

    // Iniciar logging de batalha no BattleLoggerService (já limpa logs antigos internamente)
    BattleLoggerService.startBattle(playerName, floorNumber);

    this.logGameEvent(
      {
        message,
        type: 'battle',
        importance: 'high',
        metadata: { playerName, enemyName, floorNumber },
      },
      { playerName, enemyName, floorNumber, ...details }
    );
  }

  /**
   * BATALHA FINALIZADA: Log de fim de batalha
   */
  static logBattleEnd(
    result: 'victory' | 'defeat' | 'flee',
    playerName: string,
    enemyName?: string,
    rewards?: {
      xp: number;
      gold: number;
      drops: Array<{ name: string; quantity: number }>;
    },
    details?: BattleEventDetails
  ): void {
    let message = '';
    switch (result) {
      case 'victory':
        message = `✅ ${playerName} venceu a batalha!`;
        if (rewards) {
          message += ` (+${rewards.xp} XP, +${rewards.gold} gold)`;
        }
        break;
      case 'defeat':
        message = `💀 ${playerName} foi derrotado...`;
        break;
      case 'flee':
        message = `🏃 ${playerName} fugiu da batalha!`;
        break;
    }

    // Finalizar logging de batalha no BattleLoggerService
    BattleLoggerService.endBattle(result, { rewards, ...details });

    this.logGameEvent(
      {
        message,
        type: result === 'victory' ? 'battle' : 'system',
        importance: result === 'defeat' ? 'critical' : 'high',
        metadata: { result, rewards },
      },
      { playerName, enemyName, ...rewards, ...details }
    );

    // Log adicional para recompensas se vitória
    if (result === 'victory' && rewards) {
      this.logBattleRewards(playerName, rewards.xp, rewards.gold, rewards.drops, details);
    }
  }

  /**
   * RECOMPENSAS DE BATALHA: Log específico para recompensas
   */
  static logBattleRewards(
    playerName: string,
    xp: number,
    gold: number,
    drops: Array<{ name: string; quantity: number }>,
    details?: BattleEventDetails
  ): void {
    // XP
    if (xp > 0) {
      this.logXpGain(playerName, xp, 'combat', undefined, details);
    }

    // Gold
    if (gold > 0) {
      this.logGameEvent(
        {
          message: `${playerName} obteve ${gold} moedas de ouro!`,
          type: 'system',
          importance: 'normal',
          metadata: { goldGained: gold },
        },
        { playerName, goldGained: gold, ...details }
      );
    }

    // Drops
    if (drops.length > 0) {
      for (const drop of drops) {
        this.logGameEvent(
          {
            message: `${playerName} obteve ${drop.quantity}x ${drop.name}!`,
            type: 'system',
            importance: 'normal',
            metadata: { dropName: drop.name, dropQuantity: drop.quantity },
          },
          { playerName, dropsObtained: drops, ...details }
        );
      }
    }
  }

  /**
   * ERRO DE BATALHA: Log para erros durante batalhas
   */
  static logBattleError(error: string, context?: string, details?: BattleEventDetails): void {
    // Log detalhado no BattleLoggerService
    BattleLoggerService.logError('BattleSystem', error, { context, ...details });

    const message = context ? `⚠️ Erro [${context}]: ${error}` : `⚠️ Erro: ${error}`;

    this.logGameEvent(
      {
        message,
        type: 'system',
        importance: 'critical',
        metadata: { error, context },
      },
      details
    );
  }

  /**
   * Utilitário para obter key binding de slot
   */
  private static getKeyBinding(slotPosition: number): string {
    const keyMap = { 1: 'Q', 2: 'W', 3: 'E' };
    return keyMap[slotPosition as keyof typeof keyMap] || `Slot ${slotPosition}`;
  }

  /**
   * UTILIDADE: Atualizar referência da store (para casos de re-hidratação)
   */
  static updateStoreReference(): void {
    this.logStore = useLogStore.getState();
  }

  /**
   * UTILIDADE: Obter estatísticas de logs da batalha atual
   */
  static getBattleLogStats() {
    return BattleLoggerService.getLogStats();
  }

  /**
   * UTILIDADE: Exportar logs da batalha atual
   */
  static exportCurrentBattleLogs(): string {
    return BattleLoggerService.exportCurrentBattleLogs();
  }

  /**
   * UTILIDADE: Limpar logs antigos
   */
  static clearOldLogs(): void {
    BattleLoggerService.clearOldLogs();
  }

  /**
   * UTILIDADE: Limpar logs da UI (useLogStore)
   */
  static clearUILogs(): void {
    const logStore = useLogStore.getState();
    logStore.clearAllLogs();
  }

  /**
   * UTILIDADE: Limpar TODOS os logs (console + UI)
   */
  static clearAllLogs(): void {
    this.clearOldLogs(); // Limpa logs do console
    this.clearUILogs(); // Limpa logs da UI
  }
}
