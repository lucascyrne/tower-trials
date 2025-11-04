import { type FloorType } from '@/models/game.model';
import { Badge } from '@/components/ui/badge';
import { Crown, Target, Star, Building } from 'lucide-react';

interface BattleHeaderProps {
  currentFloor: {
    floorNumber?: number;
    type: FloorType;
    description: string;
    isCheckpoint: boolean;
    minLevel: number;
  };
  playerLevel: number;
}

export function BattleHeader({ currentFloor, playerLevel }: BattleHeaderProps) {
  const getFloorIcon = (type: FloorType) => {
    switch (type) {
      case 'boss':
        return '👑';
      case 'elite':
        return '⭐';
      default:
        return '🗺️';
    }
  };

  // ✅ CORRIGIDO: Calcular informações usando lógica padronizada
  const floorNumber = currentFloor.floorNumber || 1;
  const currentTier = Math.ceil(floorNumber / 20);
  const cyclePosition = ((floorNumber - 1) % 20) + 1;

  // ✅ NOVA LÓGICA CONSISTENTE: Boss floors são 5, 10, 20, 30, 40...
  const isBossFloor = floorNumber === 5 || floorNumber % 10 === 0;
  const isEliteFloor = floorNumber % 5 === 0 && floorNumber > 5 && !isBossFloor;
  const isHighTier = currentTier > 1;

  return (
    <div className="mb-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          <h2 className="text-2xl font-bold text-primary">
            {getFloorIcon(currentFloor.type)} {currentFloor.description}
          </h2>

          {/* Badge do andar */}
          <Badge variant="outline" className="bg-background/50">
            <Building className="h-3 w-3 mr-1" />
            Andar {floorNumber}
          </Badge>

          {/* Badge do Tier para tiers altos */}
          {isHighTier && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              <Crown className="h-3 w-3 mr-1" />
              Tier {currentTier}
            </Badge>
          )}

          {/* Badge de Boss Floor */}
          {isBossFloor && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              <Target className="h-3 w-3 mr-1" />
              BOSS
            </Badge>
          )}

          {/* Badge de Elite Floor */}
          {isEliteFloor && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              <Star className="h-3 w-3 mr-1" />
              ELITE
            </Badge>
          )}

          {/* Badge de Checkpoint */}
          {currentFloor.isCheckpoint && (
            <Badge className="bg-primary/20 text-primary">
              <Star className="h-3 w-3 mr-1" />
              Checkpoint
            </Badge>
          )}
        </div>

        {/* Informações adicionais do ciclo para tiers altos */}
        {isHighTier && (
          <div className="text-xs text-muted-foreground mb-2">
            <span className="bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
              Sistema Cíclico: Posição {cyclePosition}/20 no Ciclo {currentTier}
              {isBossFloor && ' • Monstros Escalados'}
            </span>
          </div>
        )}

        {/* Aviso de nível recomendado */}
        {playerLevel < currentFloor.minLevel && (
          <div className="text-yellow-500 text-sm">
            ⚠️ Nível recomendado: {currentFloor.minLevel}
          </div>
        )}

        {/* Descrição especial para tiers altos */}
        {isHighTier && (
          <div className="text-sm text-purple-400 mt-2">
            Os monstros foram fortalecidos pelo poder ancestral da torre!
          </div>
        )}
      </div>
    </div>
  );
}
