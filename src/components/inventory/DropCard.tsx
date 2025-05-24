import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Coins } from 'lucide-react';
import { MonsterDrop } from '@/resources/game/models/consumable.model';

interface CharacterDrop {
  id: string;
  drop_id: string;
  quantity: number;
  drop?: MonsterDrop;
}

interface DropCardProps {
  item: CharacterDrop;
}

export const DropCard: React.FC<DropCardProps> = ({ item }) => {
  const getRarityColor = (rarity: MonsterDrop['rarity']) => {
    const colors = {
      common: 'border-gray-500 bg-gray-500/10 text-gray-300',
      uncommon: 'border-green-500 bg-green-500/10 text-green-300',
      rare: 'border-blue-500 bg-blue-500/10 text-blue-300',
      epic: 'border-purple-500 bg-purple-500/10 text-purple-300',
      legendary: 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
    };
    return colors[rarity];
  };

  if (!item.drop || item.quantity <= 0) {
    return null;
  }

  return (
    <Card className={`p-4 bg-card/95 border-2 ${getRarityColor(item.drop.rarity)}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-primary">{item.drop.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{item.drop.description}</p>
          <p className="text-xs font-medium mt-2">Quantidade: {item.quantity}</p>
        </div>
        <Badge className={getRarityColor(item.drop.rarity)} variant="outline">
          <Star className="h-3 w-3 mr-1" />
          {item.drop.rarity}
        </Badge>
      </div>

      <div className="flex items-center justify-center text-xs text-yellow-400 bg-yellow-400/10 rounded p-2">
        <Coins className="h-3 w-3 mr-1" />
        Valor: {item.drop.value} gold cada
      </div>
    </Card>
  );
}; 