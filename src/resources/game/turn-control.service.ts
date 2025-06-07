import { BattleSession, ActionLock, TurnIdGenerator } from './models/game-battle.model';

/**
 * Service para controle robusto de turnos e prevenção de ações duplicadas
 * Resolve o problema de side-effects duplos no React.StrictMode
 */
export class TurnControlService {
  private static activeSessions = new Map<string, BattleSession>();
  private static actionLocks = new Map<string, ActionLock>();
  private static processedTurns = new Set<string>();
  private static processedActions = new Set<string>();
  private static sessionCreationTracker = new Map<string, number>(); // NOVO: Track criação de sessões
  
  // Configurações
  private static readonly ACTION_DEBOUNCE_MS = 800;
  private static readonly ACTION_LOCK_DURATION_MS = 2000;
  private static readonly SESSION_CLEANUP_INTERVAL = 30000; // 30 segundos
  private static readonly PROCESSING_TIMEOUT_MS = 5000; // 5 segundos para timeout de processamento
  private static readonly SESSION_CREATION_COOLDOWN_MS = 1000; // NOVO: Cooldown para criação de sessões
  
  /**
   * Inicializa uma nova sessão de batalha
   */
  static initializeBattleSession(floor: number, enemyName: string): BattleSession {
    const battleKey = `${floor}-${enemyName.replace(/\s+/g, '_')}`;
    const now = Date.now();
    
    // NOVO: Verificar se criamos uma sessão para esta batalha recentemente
    const lastCreation = this.sessionCreationTracker.get(battleKey);
    if (lastCreation && (now - lastCreation) < this.SESSION_CREATION_COOLDOWN_MS) {
      console.log(`[TurnControl] Criação de sessão em cooldown para ${battleKey} (${now - lastCreation}ms)`);
      
      // Procurar por sessão existente válida
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.battleId.includes(battleKey) && this.isSessionValid(sessionId)) {
          console.log(`[TurnControl] Retornando sessão existente durante cooldown: ${sessionId}`);
          return session;
        }
      }
    }
    
    const battleId = TurnIdGenerator.generateBattleId(floor, enemyName);
    const sessionId = TurnIdGenerator.generateSessionId();
    
    // MELHORADO: Só limpar sessões conflitantes se forem inválidas
    for (const [existingSessionId, existingSession] of this.activeSessions.entries()) {
      if (existingSession.battleId.includes(`${floor}-${enemyName}`) && 
          !this.isSessionValid(existingSessionId)) {
        console.log(`[TurnControl] Limpando sessão inválida conflitante: ${existingSessionId}`);
        this.cleanupSession(existingSessionId);
      }
    }
    
    // NOVO: Registrar criação da sessão
    this.sessionCreationTracker.set(battleKey, now);
    
    const session: BattleSession = {
      sessionId,
      battleId,
      currentTurnId: '',
      processedTurns: new Set(),
      processedActions: new Set(),
      lastActionTimestamp: Date.now(), // Inicializar com timestamp atual
      playerActionDebounce: this.ACTION_DEBOUNCE_MS,
      enemyActionDebounce: this.ACTION_DEBOUNCE_MS,
      isProcessing: false
    };
    
    // Armazenar sessão
    this.activeSessions.set(sessionId, session);
    
    console.log(`[TurnControl] Nova sessão de batalha criada: ${sessionId} (battleId: ${battleId})`);
    console.log(`[TurnControl] Sessões ativas: ${this.activeSessions.size}`);
    
    // Agendar limpeza automática (tempo maior para evitar limpeza prematura)
    setTimeout(() => {
      // Só limpar se não estiver sendo usada
      if (this.activeSessions.has(sessionId) && !this.isSessionValid(sessionId)) {
        this.cleanupSession(sessionId);
      }
    }, this.SESSION_CLEANUP_INTERVAL * 2); // Dobrar o tempo para maior estabilidade
    
    return session;
  }
  
  /**
   * NOVO: Limpa sessões antigas com o mesmo battleId
   */
  private static cleanupSessionsByBattleId(battleId: string): void {
    const sessionsToRemove: string[] = [];
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.battleId === battleId) {
        sessionsToRemove.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToRemove) {
      console.log(`[TurnControl] Removendo sessão antiga: ${sessionId}`);
      this.cleanupSession(sessionId);
    }
  }
  
  /**
   * Verifica se uma ação pode ser executada (não é duplicada)
   */
  static canPerformAction(
    sessionId: string, 
    actor: 'player' | 'enemy', 
    actionType: string
  ): { canPerform: boolean; reason?: string; actionId?: string } {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[TurnControl] Sessão não encontrada: ${sessionId}`);
      console.log(`[TurnControl] Sessões ativas:`, Array.from(this.activeSessions.keys()));
      
      // NOVO: Tentar encontrar uma sessão ativa alternativa
      if (this.activeSessions.size > 0) {
        const fallbackSession = Array.from(this.activeSessions.values())[0];
        console.log(`[TurnControl] Usando sessão fallback: ${fallbackSession.sessionId}`);
        return this.canPerformAction(fallbackSession.sessionId, actor, actionType);
      }
      
      return { canPerform: false, reason: 'Sessão não encontrada' };
    }
    
    const now = Date.now();
    
    // NOVO: Verificar se a sessão está travada há muito tempo
    if (session.isProcessing && session.lastActionTimestamp > 0) {
      const timeSinceLastAction = now - session.lastActionTimestamp;
      if (timeSinceLastAction > this.PROCESSING_TIMEOUT_MS) {
        console.warn(`[TurnControl] Sessão travada detectada (${timeSinceLastAction}ms), liberando...`);
        session.isProcessing = false;
        
        // Limpar locks expirados relacionados
        this.clearExpiredLocks();
      }
    }
    
    // 1. Verificar se já está processando uma ação
    if (session.isProcessing) {
      const timeSinceLastAction = now - session.lastActionTimestamp;
      console.log(`[TurnControl] Ação bloqueada - sessão já processando: ${sessionId} (${timeSinceLastAction}ms)`);
      return { canPerform: false, reason: `Ação já sendo processada (${timeSinceLastAction}ms)` };
    }
    
    // 2. Verificar debounce temporal (mais flexível para novas sessões e inimigos)
    const debounceTime = actor === 'player' ? session.playerActionDebounce : session.enemyActionDebounce;
    const timeSinceLastAction = now - session.lastActionTimestamp;
    
    // NOVO: Debounce muito mais flexível para inimigos
    let effectiveDebounceTime = debounceTime;
    if (actor === 'enemy') {
      effectiveDebounceTime = Math.min(debounceTime, 100); // Máximo 100ms para inimigos
      console.log(`[TurnControl] Debounce para inimigo reduzido para ${effectiveDebounceTime}ms`);
    }
    
    // NOVO: Se a sessão é muito recente (menos de 50ms), não aplicar debounce
    if (timeSinceLastAction < 50) {
      console.log(`[TurnControl] Sessão muito recente (${timeSinceLastAction}ms), ignorando debounce`);
    } else if (timeSinceLastAction < effectiveDebounceTime) {
      const remainingTime = effectiveDebounceTime - timeSinceLastAction;
      
      // NOVO: Para inimigos, se o debounce restante é pequeno, permitir
      if (actor === 'enemy' && remainingTime < 50) {
        console.log(`[TurnControl] Permitindo ação do inimigo - debounce residual pequeno (${remainingTime}ms)`);
      } else {
        console.log(`[TurnControl] Ação bloqueada - debounce: ${remainingTime}ms restantes (${actor})`);
        return { canPerform: false, reason: `Debounce ativo (${remainingTime}ms)` };
      }
    }
    
    // 3. Gerar ID único para esta ação
    const currentTurnId = session.currentTurnId || TurnIdGenerator.generateTurnId(session.battleId, actor);
    const actionId = TurnIdGenerator.generateActionId(currentTurnId, actionType);
    
    // 4. Verificar se ação similar já foi processada
    const actionKey = `${currentTurnId}-${actionType}`;
    if (session.processedActions.has(actionKey)) {
      console.log(`[TurnControl] Ação duplicada detectada: ${actionKey}`);
      return { canPerform: false, reason: 'Ação já processada neste turno' };
    }
    
    // 5. Verificar lock de ação
    const existingLock = this.actionLocks.get(actionKey);
    if (existingLock && existingLock.isLocked && now < existingLock.expiresAt) {
      console.log(`[TurnControl] Ação bloqueada por lock: ${actionKey}`);
      return { canPerform: false, reason: 'Ação temporariamente bloqueada' };
    }
    
    console.log(`[TurnControl] Ação aprovada: ${actionKey}`);
    return { canPerform: true, actionId };
  }
  
  /**
   * Marca o início de uma ação (cria lock)
   */
  static startAction(sessionId: string, actionId: string, actor: 'player' | 'enemy', actionType: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`[TurnControl] Sessão não encontrada para startAction: ${sessionId}`);
      return false;
    }
    
    const now = Date.now();
    
    // Criar lock de ação
    const actionKey = `${session.currentTurnId}-${actionType}`;
    const lock: ActionLock = {
      actionId,
      timestamp: now,
      actor,
      isLocked: true,
      expiresAt: now + this.ACTION_LOCK_DURATION_MS
    };
    
    this.actionLocks.set(actionKey, lock);
    
    // Marcar sessão como processando
    session.isProcessing = true;
    session.lastActionTimestamp = now;
    
    // Registrar ação como processada
    session.processedActions.add(actionKey);
    this.processedActions.add(actionId);
    
    console.log(`[TurnControl] Ação iniciada: ${actionKey} (actionId: ${actionId})`);
    
    // NOVO: Agendar liberação automática em caso de travamento
    setTimeout(() => {
      this.forceFinishAction(sessionId, actionId);
    }, this.PROCESSING_TIMEOUT_MS);
    
    return true;
  }
  
  /**
   * Marca o fim de uma ação (remove lock)
   */
  static finishAction(sessionId: string, actionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[TurnControl] Sessão não encontrada para finishAction: ${sessionId} - limpando locks órfãos`);
      // Mesmo sem sessão, limpar locks relacionados para evitar travamentos
      for (const [key, lock] of this.actionLocks.entries()) {
        if (lock.actionId === actionId) {
          this.actionLocks.delete(key);
          console.log(`[TurnControl] Lock órfão removido: ${key} (actionId: ${actionId})`);
          break;
        }
      }
      this.processedActions.add(actionId);
      return;
    }
    
    // Remover flag de processamento
    session.isProcessing = false;
    session.lastActionTimestamp = Date.now();
    
    // Encontrar e remover lock
    for (const [key, lock] of this.actionLocks.entries()) {
      if (lock.actionId === actionId) {
        this.actionLocks.delete(key);
        console.log(`[TurnControl] Ação finalizada: ${key} (actionId: ${actionId})`);
        break;
      }
    }
    
    // Marcar ação como processada
    this.processedActions.add(actionId);
  }
  
  /**
   * NOVO: Força a finalização de uma ação em caso de travamento
   */
  private static forceFinishAction(sessionId: string, actionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    // Verificar se ainda está processando a mesma ação
    const isStillProcessing = this.processedActions.has(actionId) && session.isProcessing;
    
    if (isStillProcessing) {
      console.warn(`[TurnControl] Forçando finalização de ação travada: ${actionId}`);
      this.finishAction(sessionId, actionId);
    }
  }
  
  /**
   * NOVO: Limpa locks expirados
   */
  private static clearExpiredLocks(): void {
    const now = Date.now();
    let clearedCount = 0;
    
    for (const [key, lock] of this.actionLocks.entries()) {
      if (now > lock.expiresAt) {
        this.actionLocks.delete(key);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      console.log(`[TurnControl] ${clearedCount} locks expirados limpos`);
    }
  }
  
  /**
   * Inicia um novo turno
   */
  static startTurn(sessionId: string, actor: 'player' | 'enemy'): string | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`[TurnControl] Sessão não encontrada para startTurn: ${sessionId}`);
      return null;
    }
    
    const turnId = TurnIdGenerator.generateTurnId(session.battleId, actor);
    session.currentTurnId = turnId;
    session.processedTurns.add(turnId);
    this.processedTurns.add(turnId);
    
    console.log(`[TurnControl] Novo turno iniciado: ${turnId} (${actor})`);
    return turnId;
  }
  
  /**
   * Verifica se um turno já foi processado
   */
  static isTurnProcessed(turnId: string): boolean {
    return this.processedTurns.has(turnId);
  }
  
  /**
   * Verifica se uma ação já foi processada
   */
  static isActionProcessed(actionId: string): boolean {
    return this.processedActions.has(actionId);
  }
  
  /**
   * Obtém a sessão ativa por ID
   */
  static getSession(sessionId: string): BattleSession | null {
    return this.activeSessions.get(sessionId) || null;
  }
  
  /**
   * NOVO: Força a liberação de uma sessão específica
   */
  static forceUnlockSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isProcessing = false;
      console.log(`[TurnControl] Sessão forçadamente liberada: ${sessionId}`);
      return true;
    }
    return false;
  }
  
  /**
   * Limpa uma sessão específica
   */
  static cleanupSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Limpar locks relacionados ao battleId
      for (const [key, lock] of this.actionLocks.entries()) {
        if (key.startsWith(session.battleId) || lock.actionId.includes(session.battleId)) {
          this.actionLocks.delete(key);
        }
      }
      
      // Limpar turnos processados relacionados
      for (const turnId of this.processedTurns) {
        if (turnId.includes(session.battleId)) {
          this.processedTurns.delete(turnId);
        }
      }
      
      // Limpar ações processadas relacionadas
      for (const actionId of this.processedActions) {
        if (actionId.includes(session.battleId)) {
          this.processedActions.delete(actionId);
        }
      }
      
      // Remover sessão
      this.activeSessions.delete(sessionId);
      
      console.log(`[TurnControl] Sessão e dados relacionados limpos: ${sessionId}`);
    }
  }
  
  /**
   * Limpeza geral de sessões e locks expirados
   */
  static performCleanup(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 60000; // 1 minuto
    const STUCK_SESSION_THRESHOLD = 10000; // 10 segundos para sessões travadas
    
    // Limpar locks expirados
    this.clearExpiredLocks();
    
    // NOVO: Detectar e corrigir sessões duplicadas
    this.cleanupDuplicateSessions();
    
    // NOVO: Limpar tracker de criação de sessões antigas
    for (const [battleKey, timestamp] of this.sessionCreationTracker.entries()) {
      if (now - timestamp > 10000) { // 10 segundos
        this.sessionCreationTracker.delete(battleKey);
      }
    }
    
    // Limpar sessões antigas ou travadas
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const timeSinceLastAction = now - session.lastActionTimestamp;
      
      if (timeSinceLastAction > CLEANUP_THRESHOLD) {
        console.log(`[TurnControl] Removendo sessão antiga: ${sessionId} (${timeSinceLastAction}ms inativa)`);
        this.cleanupSession(sessionId);
      } else if (session.isProcessing && timeSinceLastAction > STUCK_SESSION_THRESHOLD) {
        console.warn(`[TurnControl] Detectada sessão travada: ${sessionId} (processando há ${timeSinceLastAction}ms)`);
        session.isProcessing = false;
        session.lastActionTimestamp = now;
      }
    }
    
    console.log(`[TurnControl] Limpeza realizada: ${this.activeSessions.size} sessões ativas, ${this.actionLocks.size} locks ativos, ${this.sessionCreationTracker.size} trackers`);
  }
  
  /**
   * Força a liberação de todas as ações (para debug/emergência)
   */
  static forceUnlockAll(): void {
    this.actionLocks.clear();
    
    for (const session of this.activeSessions.values()) {
      session.isProcessing = false;
    }
    
    console.log(`[TurnControl] Todas as ações foram forçadamente liberadas`);
  }
  
  /**
   * NOVO: Limpa todas as sessões e dados relacionados a uma batalha específica
   */
  static cleanupBattleData(battleId: string): void {
    // Encontrar e limpar sessões relacionadas
    const sessionsToCleanup: string[] = [];
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.battleId === battleId) {
        sessionsToCleanup.push(sessionId);
      }
    }
    
    // Limpar cada sessão
    sessionsToCleanup.forEach(sessionId => {
      this.cleanupSession(sessionId);
    });
    
    // Limpar qualquer dado órfão relacionado
    for (const [key, lock] of this.actionLocks.entries()) {
      if (lock.actionId.includes(battleId)) {
        this.actionLocks.delete(key);
      }
    }
    
    for (const turnId of this.processedTurns) {
      if (turnId.includes(battleId)) {
        this.processedTurns.delete(turnId);
      }
    }
    
    for (const actionId of this.processedActions) {
      if (actionId.includes(battleId)) {
        this.processedActions.delete(actionId);
      }
    }
    
    console.log(`[TurnControl] Dados da batalha ${battleId} completamente limpos`);
  }
  
  /**
   * NOVO: Verifica se uma sessão existe e está válida
   */
  static isSessionValid(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    
    const now = Date.now();
    const timeSinceLastAction = now - session.lastActionTimestamp;
    
    // Sessão é inválida se está travada há muito tempo E está marcada como processando
    if (session.isProcessing && timeSinceLastAction > this.PROCESSING_TIMEOUT_MS) {
      console.warn(`[TurnControl] Sessão inválida detectada: ${sessionId} (travada há ${timeSinceLastAction}ms)`);
      return false;
    }
    
    // NOVO: Sessão recém-criada (menos de 2 segundos) sempre é válida, mesmo com debounce
    if (timeSinceLastAction < 2000) {
      return true;
    }
    
    return true;
  }
  
    /**
   * NOVO: Encontra ou cria uma sessão válida para uma batalha
   */
  static ensureValidSession(floor: number, enemyName: string, preferredSessionId?: string): BattleSession {
    const battleKey = `${floor}-${enemyName.replace(/\s+/g, '_')}`;
    
    // NOVO: Verificar cooldown rigoroso para criação de sessões
    const lastCreation = this.sessionCreationTracker.get(battleKey);
    if (lastCreation && (Date.now() - lastCreation) < this.SESSION_CREATION_COOLDOWN_MS) {
      console.log(`[TurnControl] Cooldown ativo - BLOQUEANDO criação de nova sessão para: ${battleKey}`);
      
      // SEMPRE retornar uma sessão existente durante cooldown
      const existingSessions = Array.from(this.activeSessions.entries())
        .filter(([, session]) => session.battleId.includes(battleKey))
        .sort(([, a], [, b]) => b.lastActionTimestamp - a.lastActionTimestamp);
      
      if (existingSessions.length > 0) {
        const [sessionId, session] = existingSessions[0];
        console.log(`[TurnControl] Reutilizando sessão durante cooldown: ${sessionId}`);
        return session;
      }
      
      // Se há sessão preferida, usar mesmo que não seja totalmente válida
      if (preferredSessionId && this.activeSessions.has(preferredSessionId)) {
        const session = this.activeSessions.get(preferredSessionId)!;
        console.log(`[TurnControl] Forçando uso da sessão preferida durante cooldown: ${preferredSessionId}`);
        return session;
      }
    }
    
    // 1. Se temos uma sessão preferida, verificar se é válida e para esta batalha
    if (preferredSessionId && this.isSessionValid(preferredSessionId)) {
      const session = this.activeSessions.get(preferredSessionId);
      if (session && session.battleId.includes(battleKey)) {
        console.log(`[TurnControl] Usando sessão preferida válida: ${preferredSessionId}`);
        return session;
      }
    }
    
    // 2. Procurar por QUALQUER sessão existente para esta batalha específica (mesmo que não totalmente válida)
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.battleId.includes(battleKey)) {
        console.log(`[TurnControl] Reutilizando sessão existente para batalha: ${sessionId}`);
        return session;
      }
    }
    
    // 3. ÚLTIMO RECURSO: Procurar por sessões do mesmo andar
    const floorSessions = Array.from(this.activeSessions.entries())
      .filter(([sessionId, session]) => 
        session.battleId.includes(`battle-${floor}-`) && 
        this.isSessionValid(sessionId)
      )
      .sort(([, a], [, b]) => b.lastActionTimestamp - a.lastActionTimestamp);
    
    if (floorSessions.length > 0) {
      const [sessionId, session] = floorSessions[0];
      console.log(`[TurnControl] Reutilizando sessão do mesmo andar: ${sessionId}`);
      return session;
    }
    
    // 4. Só criar nova sessão se realmente não há nada disponível
    console.log(`[TurnControl] CRIANDO nova sessão para batalha: andar ${floor}, inimigo ${enemyName}`);
    
    // Marcar tempo de criação
    this.sessionCreationTracker.set(battleKey, Date.now());
    
    return this.initializeBattleSession(floor, enemyName);
  }
  
  /**
   * Debug: Obtém estatísticas do sistema
   */
  static getDebugStats(): {
    activeSessions: number;
    actionLocks: number;
    processedTurns: number;
    processedActions: number;
    sessionCreationTrackers: number;
    sessionsDetails: Array<{
      sessionId: string;
      battleId: string;
      isProcessing: boolean;
      lastActionTimestamp: number;
      timeSinceLastAction: number;
    }>;
    creationTrackers: Array<{
      battleKey: string;
      timestamp: number;
      timeSinceCreation: number;
    }>;
  } {
    const now = Date.now();
    const sessionsDetails = Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      battleId: session.battleId,
      isProcessing: session.isProcessing,
      lastActionTimestamp: session.lastActionTimestamp,
      timeSinceLastAction: now - session.lastActionTimestamp
    }));
    
    const creationTrackers = Array.from(this.sessionCreationTracker.entries()).map(([battleKey, timestamp]) => ({
      battleKey,
      timestamp,
      timeSinceCreation: now - timestamp
    }));
    
    return {
      activeSessions: this.activeSessions.size,
      actionLocks: this.actionLocks.size,
      processedTurns: this.processedTurns.size,
      processedActions: this.processedActions.size,
      sessionCreationTrackers: this.sessionCreationTracker.size,
      sessionsDetails,
      creationTrackers
    };
  }
  
  /**
   * NOVO: Detecta e corrige sessões duplicadas para a mesma batalha
   */
  private static cleanupDuplicateSessions(): void {
    const battleGroups = new Map<string, Array<{ sessionId: string; session: BattleSession }>>();
    
    // Agrupar sessões por padrão de batalha
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const battlePattern = session.battleId.split('-').slice(0, 3).join('-'); // "battle-floor-enemy"
      
      if (!battleGroups.has(battlePattern)) {
        battleGroups.set(battlePattern, []);
      }
      battleGroups.get(battlePattern)!.push({ sessionId, session });
    }
    
    // Limpar duplicatas
    for (const [battlePattern, sessions] of battleGroups.entries()) {
      if (sessions.length > 1) {
        console.warn(`[TurnControl] Detectadas ${sessions.length} sessões duplicadas para ${battlePattern}`);
        
        // Manter apenas a sessão mais recente
        sessions.sort((a, b) => b.session.lastActionTimestamp - a.session.lastActionTimestamp);
        const sessionToKeep = sessions[0];
        
        for (let i = 1; i < sessions.length; i++) {
          const sessionToRemove = sessions[i];
          console.log(`[TurnControl] Removendo sessão duplicada: ${sessionToRemove.sessionId}`);
          this.cleanupSession(sessionToRemove.sessionId);
        }
        
        console.log(`[TurnControl] Mantida sessão principal: ${sessionToKeep.sessionId}`);
      }
    }
  }

  /**
   * NOVO: Debug específico para problemas de múltiplas sessões
   */
  static debugMultipleSessions(floor: number, enemyName: string): void {
    const battlePattern = `${floor}-${enemyName.replace(/\s+/g, '_')}`;
    console.log(`[TurnControl] DEBUG: Analisando sessões para ${battlePattern}`);
    
    const matchingSessions = Array.from(this.activeSessions.entries())
      .filter(([, session]) => session.battleId.includes(battlePattern));
    
    console.log(`[TurnControl] DEBUG: ${matchingSessions.length} sessões encontradas:`);
    matchingSessions.forEach(([sessionId, session]) => {
      console.log(`[TurnControl] DEBUG:   - ${sessionId}: ${session.battleId} (válida: ${this.isSessionValid(sessionId)})`);
    });
    
    const tracker = this.sessionCreationTracker.get(battlePattern);
    if (tracker) {
      console.log(`[TurnControl] DEBUG: Tracker de criação: ${Date.now() - tracker}ms atrás`);
    } else {
      console.log(`[TurnControl] DEBUG: Nenhum tracker de criação encontrado`);
    }
  }
}

// Limpeza automática a cada 30 segundos
setInterval(() => {
  TurnControlService.performCleanup();
}, 30000); 