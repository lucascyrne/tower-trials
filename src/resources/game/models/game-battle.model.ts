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