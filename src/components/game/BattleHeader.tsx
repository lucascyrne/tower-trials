import React from 'react';
import { FloorType } from '@/resources/game/game-model';

interface BattleHeaderProps {
  currentFloor: {
    type: FloorType;
    description: string;
    isCheckpoint: boolean;
    minLevel: number;
  };
  playerLevel: number;
}

export function BattleHeader({ currentFloor, playerLevel }: BattleHeaderProps) {
  // Log para debug das props recebidas
  React.useEffect(() => {
    console.log('[BattleHeader] Props recebidas:');
    console.log('- currentFloor:', currentFloor?.description, `(tipo: ${currentFloor?.type})`);
    console.log('- playerLevel:', playerLevel);
  }, [currentFloor, playerLevel]);

  const getFloorIcon = (type: FloorType) => {
    switch (type) {
      case 'boss': return '👑';
      case 'elite': return '⭐';
      case 'event': return '❓';
      default: return '🗺️';
    }
  };

  return (
    <div className="mb-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold text-primary">
            {getFloorIcon(currentFloor.type)} {currentFloor.description}
          </h2>
          {currentFloor.isCheckpoint && (
            <span className="bg-primary/20 text-primary text-sm px-2 py-1 rounded">
              Checkpoint
            </span>
          )}
        </div>
        {playerLevel < currentFloor.minLevel && (
          <div className="text-yellow-500 text-sm">
            ⚠️ Nível recomendado: {currentFloor.minLevel}
          </div>
        )}
      </div>
    </div>
  );
} 