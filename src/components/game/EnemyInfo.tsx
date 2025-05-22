import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Sword } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Enemy } from '@/resources/game/game-model';
import { SpellEffect } from '@/resources/game/models/spell.model';

interface EnemyInfoProps {
  currentEnemy: Enemy;
  enemyHpPercentage: number;
  getHpColor: (percentage: number) => string;
}

export function EnemyInfo({ currentEnemy, enemyHpPercentage, getHpColor }: EnemyInfoProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-card/95 pb-2">
        <CardTitle className="text-center text-lg">{currentEnemy.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
          <div className="text-6xl font-bold text-muted-foreground">👾</div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span>HP: {currentEnemy.hp}/{currentEnemy.maxHp}</span>
              <span>{Math.round(enemyHpPercentage)}%</span>
            </div>
            <Progress 
              value={enemyHpPercentage} 
              className={`h-2 ${getHpColor(enemyHpPercentage)}`} 
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Sword className="h-4 w-4" />
              <span>Ataque: {currentEnemy.attack}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>Defesa: {currentEnemy.defense}</span>
            </div>
          </div>
          {Object.entries(currentEnemy.active_effects).map(([type, effects]) => 
            (effects as SpellEffect[]).length > 0 && (
              <div key={type} className="text-sm">
                <span className="font-medium">{type}: </span>
                {(effects as SpellEffect[]).map((e: SpellEffect) => 
                  `${e.value} (${e.duration})`
                ).join(', ')}
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
} 