import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Droplets, Zap, Sparkles } from 'lucide-react';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { type Character } from '@/resources/game/models/character.model';

interface ConsumableCardProps {
  item: CharacterConsumable;
  character: Character;
  isUsing: boolean;
  onUseConsumable: (item: CharacterConsumable) => void;
}

export const ConsumableCard: React.FC<ConsumableCardProps> = ({
  item,
  character,
  isUsing,
  onUseConsumable
}) => {
  const checkCanUseConsumable = (item: CharacterConsumable): { allowed: boolean; reason?: string } => {
    if (!item.consumable) {
      return { allowed: false, reason: 'Consumível inválido' };
    }

    switch (item.consumable.type) {
      case 'potion':
        if (item.consumable.description.includes('HP') || item.consumable.description.includes('Vida')) {
          if (character.hp >= character.max_hp) {
            return { allowed: false, reason: 'HP já está no máximo' };
          }
        } else if (item.consumable.description.includes('Mana')) {
          if (character.mana >= character.max_mana) {
            return { allowed: false, reason: 'Mana já está no máximo' };
          }
        }
        break;
      case 'antidote':
        return { allowed: false, reason: 'Use durante batalhas' };
      case 'buff':
        return { allowed: false, reason: 'Use durante batalhas' };
      default:
        return { allowed: false, reason: 'Tipo não suportado' };
    }

    return { allowed: true };
  };

  const getConsumableIcon = (type: string, description: string) => {
    if (type === 'potion') {
      if (description.includes('HP') || description.includes('Vida')) {
        return <Heart className="h-4 w-4 text-red-400" />;
      } else if (description.includes('Mana')) {
        return <Droplets className="h-4 w-4 text-blue-400" />;
      }
    }
    if (type === 'buff') return <Zap className="h-4 w-4 text-purple-400" />;
    return <Sparkles className="h-4 w-4 text-emerald-400" />;
  };

  if (!item.consumable || item.quantity <= 0) {
    return null;
  }

  const canUse = checkCanUseConsumable(item);

  return (
    <Card className={`p-4 border-slate-700/50 backdrop-blur-sm transition-all duration-200 hover:shadow-lg ${
      canUse.allowed 
        ? 'bg-slate-800/50 hover:shadow-primary/20 hover:bg-slate-800/70' 
        : 'bg-slate-800/30 opacity-60'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
          {getConsumableIcon(item.consumable.type, item.consumable.description)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100 truncate">{item.consumable.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-300 border-slate-600">
              {item.consumable.type}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
              x{item.quantity}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{item.consumable.description}</p>

      {item.consumable.effect_value > 0 && (
        <div className="flex items-center gap-1 text-xs mb-3">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-300">Efeito: +{item.consumable.effect_value}</span>
        </div>
      )}

      <Button
        onClick={() => onUseConsumable(item)}
        disabled={!canUse.allowed || isUsing}
        size="sm"
        className={`w-full h-8 text-xs ${
          canUse.allowed 
            ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20' 
            : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isUsing ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-current"></div>
            Usando...
          </div>
        ) : canUse.allowed ? (
          'Usar Agora'
        ) : (
          canUse.reason
        )}
      </Button>
    </Card>
  );
}; 