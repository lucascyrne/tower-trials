import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sword, 
  Shield, 
  ArrowLeft,
  Zap,
  Flame,
  Snowflake,
  Heart,
  Sparkles,
  Target,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { ActionType, GamePlayer } from '@/resources/game/game-model';
import { PlayerSpell } from '@/resources/game/models/spell.model';

interface BattleActionsProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer;
}

// Mapeamento de ícones para magias baseado no nome/tipo
const getSpellIcon = (spell: PlayerSpell) => {
  const name = spell.name.toLowerCase();
  const description = spell.description.toLowerCase();
  
  if (name.includes('bola de fogo') || name.includes('fireball') || description.includes('fogo')) {
    return <Flame className="h-4 w-4" />;
  }
  if (name.includes('raio de gelo') || name.includes('ice') || description.includes('gelo')) {
    return <Snowflake className="h-4 w-4" />;
  }
  if (name.includes('cura') || name.includes('heal') || description.includes('restaura')) {
    return <Heart className="h-4 w-4" />;
  }
  if (name.includes('raio') || name.includes('bolt') || description.includes('raio')) {
    return <Zap className="h-4 w-4" />;
  }
  if (name.includes('escudo') || name.includes('shield') || description.includes('defesa')) {
    return <ShieldCheck className="h-4 w-4" />;
  }
  if (name.includes('dano') || description.includes('damage') || description.includes('dano')) {
    return <Target className="h-4 w-4" />;
  }
  if (description.includes('overtime') || description.includes('tempo')) {
    return <Activity className="h-4 w-4" />;
  }
  
  // Ícone padrão para magias
  return <Sparkles className="h-4 w-4" />;
};

export function BattleActions({ handleAction, isPlayerTurn, loading, player }: BattleActionsProps) {
  const isDisabled = !isPlayerTurn || loading.performAction;

  return (
    <Card className="border-0 bg-card/95">
      <CardContent className="p-4">
        {/* Ações Básicas */}
        <div className="flex justify-center gap-3 mb-4">
          <div className="relative">
            <Button
              onClick={() => handleAction('attack')}
              disabled={isDisabled}
              size="lg"
              className="h-14 w-14 rounded-full p-0 bg-red-600 hover:bg-red-700 border-2 border-red-500"
              title="Atacar"
            >
              <Sword className="h-6 w-6" />
            </Button>
            <Badge variant="secondary" className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs">
              Atacar
            </Badge>
          </div>

          <div className="relative">
            <Button
              onClick={() => handleAction('defend')}
              disabled={isDisabled || player.defenseCooldown > 0}
              size="lg"
              className={`h-14 w-14 rounded-full p-0 relative ${
                player.isDefending 
                  ? 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-700 border-2 border-gray-500'
              }`}
              title={player.isDefending ? "Defendendo" : "Defender"}
            >
              <Shield className="h-6 w-6" />
              {player.defenseCooldown > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {player.defenseCooldown}
                </div>
              )}
            </Button>
            <Badge variant="secondary" className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs">
              Defender
            </Badge>
          </div>

          <div className="relative">
            <Button
              onClick={() => handleAction('flee')}
              disabled={isDisabled}
              size="lg"
              className="h-14 w-14 rounded-full p-0 bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500"
              title="Fugir"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Badge variant="secondary" className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs">
              Fugir
            </Badge>
          </div>
        </div>

        {/* Magias */}
        {player.spells.length > 0 && (
          <div>
            <div className="text-sm text-muted-foreground text-center mb-3">Magias</div>
            <div className="flex flex-wrap justify-center gap-3">
              {player.spells.map((spell) => {
                const canCast = player.mana >= spell.mana_cost && spell.current_cooldown === 0;
                const spellIcon = getSpellIcon(spell);
                
                return (
                  <div key={spell.id} className="relative">
                    <Button
                      onClick={() => handleAction('spell', spell.id)}
                      disabled={isDisabled || !canCast}
                      size="lg"
                      className={`h-12 w-12 rounded-full p-0 relative ${
                        canCast
                          ? 'bg-purple-600 hover:bg-purple-700 border-2 border-purple-500'
                          : 'bg-gray-400 cursor-not-allowed border-2 border-gray-300'
                      }`}
                      title={`${spell.name} (${spell.mana_cost} mana)`}
                    >
                      {spellIcon}
                      
                      {/* Cooldown indicator */}
                      {spell.current_cooldown > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {spell.current_cooldown}
                        </div>
                      )}
                      
                      {/* Mana cost indicator */}
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                        {spell.mana_cost}
                      </div>
                    </Button>
                    
                    <Badge 
                      variant="secondary" 
                      className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs max-w-16 truncate"
                      title={spell.name}
                    >
                      {spell.name.split(' ')[0]}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 