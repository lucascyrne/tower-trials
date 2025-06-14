/**
 * Utilitários para validação e limpeza de valores numéricos
 * Previne valores NaN, Infinity, null e undefined
 */

export class NumberValidator {
  /**
   * Validar e limpar um valor numérico
   * @param value Valor a ser validado
   * @param defaultValue Valor padrão se inválido
   * @param min Valor mínimo permitido
   * @param max Valor máximo permitido
   * @returns Valor válido e limpo
   */
  static validateNumber(
    value: unknown,
    defaultValue: number = 0,
    min?: number,
    max?: number
  ): number {
    let result = Number(value);

    // Verificar se é um número válido
    if (isNaN(result) || !isFinite(result) || value === null || value === undefined) {
      console.warn(
        `[NumberValidator] Valor inválido detectado: ${value}, usando padrão: ${defaultValue}`
      );
      result = defaultValue;
    }

    // Aplicar limites se fornecidos
    if (min !== undefined) {
      result = Math.max(min, result);
    }
    if (max !== undefined) {
      result = Math.min(max, result);
    }

    return Math.floor(result);
  }

  /**
   * Validar HP do jogador
   * @param hp HP atual
   * @param maxHp HP máximo
   * @returns HP válido dentro dos limites
   */
  static validateHP(hp: unknown, maxHp: unknown): number {
    const validMaxHp = this.validateNumber(maxHp, 1, 1);
    return this.validateNumber(hp, 1, 0, validMaxHp);
  }

  /**
   * Validar Mana do jogador
   * @param mana Mana atual
   * @param maxMana Mana máxima
   * @returns Mana válida dentro dos limites
   */
  static validateMana(mana: unknown, maxMana: unknown): number {
    const validMaxMana = this.validateNumber(maxMana, 1, 0);
    return this.validateNumber(mana, 0, 0, validMaxMana);
  }

  /**
   * Validar atributos de combate
   * @param attack Valor de ataque
   * @returns Ataque válido (mínimo 1)
   */
  static validateAttack(attack: unknown): number {
    return this.validateNumber(attack, 1, 1);
  }

  /**
   * Validar defesa
   * @param defense Valor de defesa
   * @returns Defesa válida (mínimo 0)
   */
  static validateDefense(defense: unknown): number {
    return this.validateNumber(defense, 0, 0);
  }

  /**
   * Validar velocidade
   * @param speed Valor de velocidade
   * @returns Velocidade válida (mínimo 1)
   */
  static validateSpeed(speed: unknown): number {
    return this.validateNumber(speed, 1, 1);
  }

  /**
   * Validar stats completos do jogador
   * @param player Objeto do jogador
   * @returns Objeto com stats validados
   */
  static validatePlayerStats(player: Record<string, unknown>): Record<string, unknown> {
    return {
      ...player,
      hp: this.validateHP(player.hp, player.max_hp),
      max_hp: this.validateNumber(player.max_hp, 1, 1),
      mana: this.validateMana(player.mana, player.max_mana),
      max_mana: this.validateNumber(player.max_mana, 1, 0),
      atk: this.validateAttack(player.atk),
      def: this.validateDefense(player.def),
      speed: this.validateSpeed(player.speed),
      level: this.validateNumber(player.level, 1, 1),
      xp: this.validateNumber(player.xp, 0, 0),
      gold: this.validateNumber(player.gold, 0, 0),
      floor: this.validateNumber(player.floor, 1, 1),
    };
  }

  /**
   * Validar stats do inimigo
   * @param enemy Objeto do inimigo
   * @returns Objeto com stats validados
   */
  static validateEnemyStats(enemy: Record<string, unknown>): Record<string, unknown> {
    return {
      ...enemy,
      hp: this.validateHP(enemy.hp, enemy.maxHp),
      maxHp: this.validateNumber(enemy.maxHp, 1, 1),
      attack: this.validateAttack(enemy.attack),
      defense: this.validateDefense(enemy.defense),
      speed: this.validateSpeed(enemy.speed),
      level: this.validateNumber(enemy.level, 1, 1),
      mana: this.validateNumber(enemy.mana, 0, 0),
      reward_xp: this.validateNumber(enemy.reward_xp, 1, 0),
      reward_gold: this.validateNumber(enemy.reward_gold, 0, 0),
    };
  }

  /**
   * Log de validação para debug
   * @param context Contexto da validação
   * @param original Valor original
   * @param validated Valor validado
   */
  static logValidation(context: string, original: unknown, validated: number): void {
    if (Number(original) !== validated || isNaN(Number(original))) {
      console.warn(`[NumberValidator] ${context}: ${original} → ${validated}`);
    }
  }
}
