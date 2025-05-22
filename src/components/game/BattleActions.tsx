import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { ActionType, GamePlayer } from '@/resources/game/game-model';
import { PlayerSpell } from '@/resources/game/models/spell.model';
import { ConsumablesPanel } from './ConsumablesPanel';

interface BattleActionsProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer;
}

export function BattleActions({ handleAction, isPlayerTurn, loading, player }: BattleActionsProps) {
  const renderSpellButton = (spell: PlayerSpell) => (
    <Button
      key={spell.id}
      onClick={() => handleAction('spell', spell.id)}
      disabled={!isPlayerTurn || spell.current_cooldown > 0 || player.mana < spell.mana_cost}
      className="flex flex-col items-center justify-center h-24 relative"
      variant="outline"
    >
      <Sparkles className="h-8 w-8 mb-1" />
      <span>{spell.name}</span>
      {spell.current_cooldown > 0 && (
        <span className="absolute bottom-1 text-xs">
          CD: {spell.current_cooldown}
        </span>
      )}
      <span className="absolute top-1 right-1 text-xs text-blue-500">
        {spell.mana_cost}
      </span>
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-center text-lg">Ações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <Button 
            onClick={() => handleAction('attack')} 
            className="flex-1"
            disabled={!isPlayerTurn || loading.performAction}
          >
            Atacar
          </Button>
          <Button 
            onClick={() => handleAction('defend')} 
            variant="outline" 
            className="flex-1"
            disabled={!isPlayerTurn || loading.performAction}
          >
            Defender
          </Button>
          <Button 
            onClick={() => handleAction('flee')} 
            variant="outline" 
            className="flex-1"
            disabled={!isPlayerTurn || loading.performAction}
          >
            Fugir
          </Button>
          <ConsumablesPanel />
        </div>

        {player.spells.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Magias</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {player.spells.map(renderSpellButton)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 