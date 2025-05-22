import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Sword, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { GamePlayer } from '@/resources/game/game-model';
import { SpellEffect } from '@/resources/game/models/spell.model';

interface PlayerInfoProps {
  player: GamePlayer;
  playerHpPercentage: number;
  playerManaPercentage: number;
  getHpColor: (percentage: number) => string;
}

export function PlayerInfo({ player, playerHpPercentage, playerManaPercentage, getHpColor }: PlayerInfoProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-card/95 pb-2">
        <CardTitle className="text-center text-lg">{player.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
          <div className="text-6xl font-bold text-muted-foreground">🧙</div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span>HP: {player.hp}/{player.max_hp}</span>
              <span>{Math.round(playerHpPercentage)}%</span>
            </div>
            <Progress 
              value={playerHpPercentage} 
              className={`h-2 ${getHpColor(playerHpPercentage)}`} 
            />
          </div>
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span>Mana: {player.mana}/{player.max_mana}</span>
              <span>{Math.round(playerManaPercentage)}%</span>
            </div>
            <Progress 
              value={playerManaPercentage} 
              className="h-2 bg-blue-500" 
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Sword className="h-4 w-4" />
              <span>Ataque: {player.atk}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>Defesa: {player.def}</span>
            </div>
            <div className="bg-muted p-2 rounded flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span>Nível: {player.level}</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex justify-between mb-1 text-sm">
              <span>XP: {player.xp}/{player.xp_next_level}</span>
              <span>{Math.round((player.xp / player.xp_next_level) * 100)}%</span>
            </div>
            <Progress 
              value={(player.xp / player.xp_next_level) * 100} 
              className="h-2 bg-primary/20" 
            />
          </div>
          {Object.entries(player.active_effects).map(([type, effects]) => 
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