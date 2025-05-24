import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Droplets, Zap } from 'lucide-react';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';
import { Character } from '@/resources/game/models/character.model';

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

  if (!item.consumable || item.quantity <= 0) {
    return null;
  }

  const canUse = checkCanUseConsumable(item);

  return (
    <Card className="p-4 bg-card/95 border-2 border-primary/20">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
            {item.consumable.type === 'potion' && item.consumable.description.includes('HP') ? (
              <Heart className="h-4 w-4 text-red-400" />
            ) : item.consumable.type === 'potion' && item.consumable.description.includes('Mana') ? (
              <Droplets className="h-4 w-4 text-blue-400" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {item.consumable.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">{item.consumable.description}</p>
          <p className="text-xs font-medium mt-2">Quantidade: {item.quantity}</p>
          {item.consumable.effect_value > 0 && (
            <p className="text-xs text-green-600 mt-1">
              Efeito: +{item.consumable.effect_value}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={() => onUseConsumable(item)}
        disabled={!canUse.allowed || isUsing}
        size="sm"
        className="w-full h-8 text-xs"
        variant={canUse.allowed ? "default" : "secondary"}
      >
        {isUsing ? 'Usando...' : canUse.allowed ? 'Usar' : canUse.reason}
      </Button>
    </Card>
  );
}; 