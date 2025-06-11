/**
 * Serviço centralizado de logging para batalhas
 * Facilita o debugging e monitoramento da experiência de batalha
 */
interface BattleLogEntry {
  timestamp: number;
  battleId: string | null;
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

export class BattleLoggerService {
  private static logs: BattleLogEntry[] = [];
  private static readonly MAX_LOGS = 100; // Manter apenas os últimos 100 logs
  private static currentBattleId: string | null = null;

  /**
   * Iniciar uma nova batalha para logging
   */
  static startBattle(playerId: string, floorNumber: number): string {
    const battleId = `battle_${playerId}_${floorNumber}_${Date.now()}`;
    this.currentBattleId = battleId;

    this.log('info', 'BattleLogger', `=== NOVA BATALHA INICIADA ===`, {
      battleId,
      playerId,
      floorNumber,
      timestamp: new Date().toISOString(),
    });

    return battleId;
  }

  /**
   * Finalizar a batalha atual
   */
  static endBattle(
    result: 'victory' | 'defeat' | 'flee' | 'error',
    details?: Record<string, unknown>
  ): void {
    if (this.currentBattleId) {
      this.log('info', 'BattleLogger', `=== BATALHA FINALIZADA: ${result.toUpperCase()} ===`, {
        battleId: this.currentBattleId,
        result,
        details,
        timestamp: new Date().toISOString(),
      });

      this.currentBattleId = null;
    }
  }

  /**
   * Log principal com diferentes níveis
   */
  static log(
    level: 'debug' | 'info' | 'warn' | 'error',
    service: string,
    message: string,
    data?: unknown
  ): void {
    const entry: BattleLogEntry = {
      timestamp: Date.now(),
      battleId: this.currentBattleId,
      service,
      level,
      message,
      data,
    };

    // Adicionar ao array de logs
    this.logs.push(entry);

    // Manter apenas os últimos MAX_LOGS
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Também fazer console.log baseado no nível
    const prefix = this.currentBattleId ? `[${this.currentBattleId}]` : '';
    const logMessage = `${prefix}[${service}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.log(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
    }
  }

  /**
   * Logs específicos para ações de batalha
   */
  static logPlayerAction(action: string, details: Record<string, unknown>): void {
    this.log('info', 'PlayerAction', `Jogador executou: ${action}`, details);
  }

  static logEnemyAction(action: string, details: Record<string, unknown>): void {
    this.log('info', 'EnemyAction', `Inimigo executou: ${action}`, details);
  }

  static logDamage(
    source: string,
    target: string,
    damage: number,
    type: string,
    details?: Record<string, unknown>
  ): void {
    this.log('info', 'Damage', `${source} causou ${damage} de dano ${type} em ${target}`, {
      source,
      target,
      damage,
      type,
      ...details,
    });
  }

  static logStateChange(from: string, to: string, details?: Record<string, unknown>): void {
    this.log('info', 'StateChange', `Estado mudou de ${from} para ${to}`, details);
  }

  static logError(service: string, error: Error | string, context?: Record<string, unknown>): void {
    this.log('error', service, `Erro: ${error instanceof Error ? error.message : error}`, {
      error: error instanceof Error ? error.stack : error,
      context,
    });
  }

  static logPerformance(
    service: string,
    operation: string,
    duration: number,
    details?: Record<string, unknown>
  ): void {
    this.log('debug', 'Performance', `${service}.${operation} levou ${duration}ms`, details);
  }

  /**
   * Obter logs da batalha atual
   */
  static getCurrentBattleLogs(): BattleLogEntry[] {
    if (!this.currentBattleId) return [];

    return this.logs.filter(log => log.battleId === this.currentBattleId);
  }

  /**
   * Obter todos os logs recentes
   */
  static getAllLogs(): BattleLogEntry[] {
    return [...this.logs];
  }

  /**
   * Obter estatísticas de logs
   */
  static getLogStats(): {
    totalLogs: number;
    currentBattleLogs: number;
    errorCount: number;
    warnCount: number;
    currentBattleId: string | null;
  } {
    const currentBattleLogs = this.getCurrentBattleLogs();

    return {
      totalLogs: this.logs.length,
      currentBattleLogs: currentBattleLogs.length,
      errorCount: this.logs.filter(log => log.level === 'error').length,
      warnCount: this.logs.filter(log => log.level === 'warn').length,
      currentBattleId: this.currentBattleId,
    };
  }

  /**
   * Exportar logs da batalha atual para debug
   */
  static exportCurrentBattleLogs(): string {
    const logs = this.getCurrentBattleLogs();
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Limpar logs antigos (manter apenas a batalha atual)
   */
  static clearOldLogs(): void {
    if (this.currentBattleId) {
      this.logs = this.logs.filter(log => log.battleId === this.currentBattleId);
    } else {
      this.logs = [];
    }

    this.log('info', 'BattleLogger', 'Logs antigos foram limpos');
  }
}
