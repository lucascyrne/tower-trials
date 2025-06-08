// Modelos para o sistema de iniciativa e turnos baseados em velocidade
// Data: 2024-12-20

export interface InitiativeData {
  playerInitiative: number;
  enemyInitiative: number;
  playerSpeed: number;
  enemySpeed: number;
  playerExtraTurns: number;
  enemyExtraTurns: number;
  currentTurn: 'player' | 'enemy';
  turnOrder: ('player' | 'enemy')[];
  turnIndex: number;
}

export interface SpeedComparison {
  playerSpeed: number;
  enemySpeed: number;
  speedDifference: number;
  playerAdvantage: boolean;
  extraTurns: number;
  description: string;
}

export interface TurnEvent {
  type: 'turn_start' | 'turn_end' | 'initiative_calculated' | 'extra_turn_granted' | 'enemy_thinking';
  actor: 'player' | 'enemy';
  message: string;
  data?: {
    initiative?: number;
    damage?: number;
    speedDifference?: number;
    extraTurns?: number;
    turnIndex?: number;
    delayMs?: number;
  };
}

export interface BattleState {
  initiative: InitiativeData;
  turnEvents: TurnEvent[];
  currentPhase: 'initiative' | 'combat' | 'resolution';
  battleId: string;
}

// NOVO: Sistema robusto para controle de turnos únicos
export interface TurnControl {
  turnId: string;
  actionId: string;
  timestamp: number;
  actor: 'player' | 'enemy';
  actionType: string;
  processed: boolean;
  battleId: string;
}

export interface BattleSession {
  sessionId: string;
  battleId: string;
  currentTurnId: string;
  processedTurns: Set<string>;
  processedActions: Set<string>;
  lastActionTimestamp: number;
  playerActionDebounce: number;
  enemyActionDebounce: number;
  isProcessing: boolean;
}

export interface ActionLock {
  actionId: string;
  timestamp: number;
  actor: 'player' | 'enemy';
  isLocked: boolean;
  expiresAt: number;
}

// Utilitários para geração de IDs únicos
export class TurnIdGenerator {
  private static counter = 0;
  
  static generateTurnId(battleId: string, actor: 'player' | 'enemy'): string {
    this.counter++;
    return `${battleId}-${actor}-turn-${Date.now()}-${this.counter}`;
  }
  
  static generateActionId(turnId: string, actionType: string): string {
    return `${turnId}-${actionType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  static generateBattleId(floor: number, enemyName: string): string {
    return `battle-${floor}-${enemyName.replace(/\s+/g, '_')}-${Date.now()}`;
  }
  
  static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface AttributeDiversityInfo {
  diversityScore: number; // 0-1
  diversityPercentage: number; // 0-100
  diversityBonus: number; // Multiplicador de bônus
  monoBuildPenalty: number; // Penalidade para mono-builds
  dominantAttribute: string;
  dominantPercentage: number;
  isMonoBuild: boolean;
  recommendation: string;
}

export interface BuildAnalysis {
  buildType: 'balanced' | 'specialist' | 'hybrid' | 'mono';
  primaryAttributes: string[];
  secondaryAttributes: string[];
  strengths: string[];
  weaknesses: string[];
  synergies: string[];
  efficiency: number; // 0-100
  diversity: AttributeDiversityInfo;
} 