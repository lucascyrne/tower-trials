/**
 * Hook customizado para logging do jogo
 * Facilita o uso do LoggingUtils em componentes React
 */

import { useCallback } from 'react';
import { LoggingUtils } from '@/utils/logging-utils';
import { type BattleEventDetails } from '@/resources/game/game.model';

export interface UseGameLoggingReturn {
  // Logs de ações do jogador
  logPlayerAction: (action: string, playerName: string, details?: BattleEventDetails) => void;
  logPlayerAttack: (
    playerName: string,
    enemyName: string,
    damage: number,
    isCritical?: boolean,
    isDoubleAttack?: boolean,
    details?: BattleEventDetails
  ) => void;

  // Logs de ações do inimigo
  logEnemyAction: (action: string, enemyName: string, details?: BattleEventDetails) => void;
  logEnemyAttack: (
    enemyName: string,
    playerName: string,
    damage: number,
    wasDefended?: boolean,
    isSpecial?: boolean,
    details?: BattleEventDetails
  ) => void;

  // Logs de magias
  logSpellCast: (
    casterName: string,
    spellName: string,
    targetName: string,
    effectValue: number,
    effectType: 'damage' | 'heal' | 'buff' | 'debuff',
    details?: BattleEventDetails
  ) => void;

  // Logs de consumíveis
  logConsumableUse: (
    playerName: string,
    consumableName: string,
    effect: string,
    slotPosition?: number,
    details?: BattleEventDetails
  ) => void;

  // Logs de XP e level up
  logXpGain: (
    playerName: string,
    xpAmount: number,
    source: 'combat' | 'skill' | 'quest',
    skillName?: string,
    details?: BattleEventDetails
  ) => void;
  logLevelUp: (
    playerName: string,
    newLevel: number,
    oldLevel: number,
    details?: BattleEventDetails
  ) => void;

  // Logs de cura
  logHealing: (
    healerName: string,
    targetName: string,
    healAmount: number,
    source: 'spell' | 'potion' | 'natural',
    details?: BattleEventDetails
  ) => void;

  // Logs de batalha
  logBattleStart: (
    playerName: string,
    enemyName: string,
    floorNumber: number,
    details?: BattleEventDetails
  ) => void;
  logBattleEnd: (
    result: 'victory' | 'defeat' | 'flee',
    playerName: string,
    enemyName?: string,
    rewards?: {
      xp: number;
      gold: number;
      drops: Array<{ name: string; quantity: number }>;
    },
    details?: BattleEventDetails
  ) => void;

  // Logs de erro
  logBattleError: (error: string, context?: string, details?: BattleEventDetails) => void;

  // Utilitários
  getBattleLogStats: () => {
    totalLogs: number;
    currentBattleLogs: number;
    errorCount: number;
    warnCount: number;
    currentBattleId: string | null;
  };
  exportCurrentBattleLogs: () => string;
  clearOldLogs: () => void;
}

/**
 * Hook para logging do jogo com funções estabilizadas via useCallback
 */
export function useGameLogging(): UseGameLoggingReturn {
  // ✅ AÇÕES DO JOGADOR
  const logPlayerAction = useCallback(
    (action: string, playerName: string, details?: BattleEventDetails) => {
      LoggingUtils.logPlayerAction(action, playerName, details);
    },
    []
  );

  const logPlayerAttack = useCallback(
    (
      playerName: string,
      enemyName: string,
      damage: number,
      isCritical: boolean = false,
      isDoubleAttack: boolean = false,
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logPlayerAttack(
        playerName,
        enemyName,
        damage,
        isCritical,
        isDoubleAttack,
        details
      );
    },
    []
  );

  // ✅ AÇÕES DO INIMIGO
  const logEnemyAction = useCallback(
    (action: string, enemyName: string, details?: BattleEventDetails) => {
      LoggingUtils.logEnemyAction(action, enemyName, details);
    },
    []
  );

  const logEnemyAttack = useCallback(
    (
      enemyName: string,
      playerName: string,
      damage: number,
      wasDefended: boolean = false,
      isSpecial: boolean = false,
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logEnemyAttack(enemyName, playerName, damage, wasDefended, isSpecial, details);
    },
    []
  );

  // ✅ MAGIAS
  const logSpellCast = useCallback(
    (
      casterName: string,
      spellName: string,
      targetName: string,
      effectValue: number,
      effectType: 'damage' | 'heal' | 'buff' | 'debuff',
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logSpellCast(
        casterName,
        spellName,
        targetName,
        effectValue,
        effectType,
        details
      );
    },
    []
  );

  // ✅ CONSUMÍVEIS
  const logConsumableUse = useCallback(
    (
      playerName: string,
      consumableName: string,
      effect: string,
      slotPosition?: number,
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logConsumableUse(playerName, consumableName, effect, slotPosition, details);
    },
    []
  );

  // ✅ XP E LEVEL UP
  const logXpGain = useCallback(
    (
      playerName: string,
      xpAmount: number,
      source: 'combat' | 'skill' | 'quest',
      skillName?: string,
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logXpGain(playerName, xpAmount, source, skillName, details);
    },
    []
  );

  const logLevelUp = useCallback(
    (playerName: string, newLevel: number, oldLevel: number, details?: BattleEventDetails) => {
      LoggingUtils.logLevelUp(playerName, newLevel, oldLevel, details);
    },
    []
  );

  // ✅ CURA
  const logHealing = useCallback(
    (
      healerName: string,
      targetName: string,
      healAmount: number,
      source: 'spell' | 'potion' | 'natural',
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logHealing(healerName, targetName, healAmount, source, details);
    },
    []
  );

  // ✅ BATALHA
  const logBattleStart = useCallback(
    (playerName: string, enemyName: string, floorNumber: number, details?: BattleEventDetails) => {
      LoggingUtils.logBattleStart(playerName, enemyName, floorNumber, details);
    },
    []
  );

  const logBattleEnd = useCallback(
    (
      result: 'victory' | 'defeat' | 'flee',
      playerName: string,
      enemyName?: string,
      rewards?: {
        xp: number;
        gold: number;
        drops: Array<{ name: string; quantity: number }>;
      },
      details?: BattleEventDetails
    ) => {
      LoggingUtils.logBattleEnd(result, playerName, enemyName, rewards, details);
    },
    []
  );

  // ✅ ERROS
  const logBattleError = useCallback(
    (error: string, context?: string, details?: BattleEventDetails) => {
      LoggingUtils.logBattleError(error, context, details);
    },
    []
  );

  // ✅ UTILITÁRIOS
  const getBattleLogStats = useCallback(() => {
    return LoggingUtils.getBattleLogStats();
  }, []);

  const exportCurrentBattleLogs = useCallback(() => {
    return LoggingUtils.exportCurrentBattleLogs();
  }, []);

  const clearOldLogs = useCallback(() => {
    LoggingUtils.clearOldLogs();
  }, []);

  return {
    // Ações do jogador
    logPlayerAction,
    logPlayerAttack,

    // Ações do inimigo
    logEnemyAction,
    logEnemyAttack,

    // Magias
    logSpellCast,

    // Consumíveis
    logConsumableUse,

    // XP e level up
    logXpGain,
    logLevelUp,

    // Cura
    logHealing,

    // Batalha
    logBattleStart,
    logBattleEnd,

    // Erros
    logBattleError,

    // Utilitários
    getBattleLogStats,
    exportCurrentBattleLogs,
    clearOldLogs,
  };
}
