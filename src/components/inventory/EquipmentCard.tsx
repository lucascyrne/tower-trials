import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sword, Shield, Gem, Axe, Hammer, Star, Coins } from 'lucide-react';
import { CharacterEquipment, Equipment } from '@/resources/game/models/equipment.model';

interface EquipmentCardProps {
  item: CharacterEquipment;
  onEquipItem: (item: CharacterEquipment) => void;
  onSellItem: (item: CharacterEquipment) => void;
}

export const EquipmentCard: React.FC<EquipmentCardProps> = ({
  item,
  onEquipItem,
  onSellItem
}) => {
  const getEquipmentTypeIcon = (type: Equipment['type'], subtype?: string) => {
    if (type === 'weapon') {
      switch (subtype) {
        case 'sword': return <Sword className="h-4 w-4" />;
        case 'axe': return <Axe className="h-4 w-4" />;
        case 'blunt': return <Hammer className="h-4 w-4" />;
        default: return <Sword className="h-4 w-4" />;
      }
    }
    if (type === 'armor') return <Shield className="h-4 w-4" />;
    if (type === 'accessory') return <Gem className="h-4 w-4" />;
    return <Sword className="h-4 w-4" />;
  };

  const getRarityColor = (rarity: Equipment['rarity']) => {
    const colors = {
      common: 'border-gray-500 bg-gray-500/10 text-gray-300',
      uncommon: 'border-green-500 bg-green-500/10 text-green-300',
      rare: 'border-blue-500 bg-blue-500/10 text-blue-300',
      epic: 'border-purple-500 bg-purple-500/10 text-purple-300',
      legendary: 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
    };
    return colors[rarity];
  };

  if (!item.equipment) {
    return null;
  }

  return (
    <Card className={`p-4 bg-card/95 border-2 transition-all duration-200 hover:shadow-lg ${getRarityColor(item.equipment.rarity)}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-2 flex-1">
          <div className="flex-shrink-0 mt-1">
            {getEquipmentTypeIcon(item.equipment.type, item.equipment.weapon_subtype)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-primary truncate">{item.equipment.name}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.equipment.description}</p>
          </div>
        </div>
        <Badge className={getRarityColor(item.equipment.rarity)} variant="outline">
          <Star className="h-3 w-3 mr-1" />
          {item.equipment.rarity}
        </Badge>
      </div>

      <div className="space-y-1 mb-3">
        {item.equipment.atk_bonus > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Sword className="h-3 w-3 text-red-400" />
            <span className="text-red-400">+{item.equipment.atk_bonus} Ataque</span>
          </div>
        )}
        {item.equipment.def_bonus > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Shield className="h-3 w-3 text-blue-400" />
            <span className="text-blue-400">+{item.equipment.def_bonus} Defesa</span>
          </div>
        )}
        {item.equipment.mana_bonus > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Gem className="h-3 w-3 text-purple-400" />
            <span className="text-purple-400">+{item.equipment.mana_bonus} Mana</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onEquipItem(item)}
          size="sm"
          className="flex-1 h-8 text-xs"
        >
          Equipar
        </Button>
        <Button
          onClick={() => onSellItem(item)}
          variant="destructive"
          size="sm"
          className="flex-1 h-8 text-xs"
        >
          <Coins className="h-3 w-3 mr-1" />
          {Math.floor(item.equipment.price / 2)}
        </Button>
      </div>
    </Card>
  );
}; 