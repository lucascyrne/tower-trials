import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Coins, Sparkles } from 'lucide-react';
import { type MonsterDrop } from '@/resources/game/models/consumable.model';

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
      common: 'bg-slate-800/80 text-slate-300 border-slate-600',
      uncommon: 'bg-emerald-900/80 text-emerald-300 border-emerald-600',
      rare: 'bg-blue-900/80 text-blue-300 border-blue-600',
      epic: 'bg-purple-900/80 text-purple-300 border-purple-600',
      legendary: 'bg-amber-900/80 text-amber-300 border-amber-600'
    };
    return colors[rarity];
  };

  if (!item.drop || item.quantity <= 0) {
    return null;
  }

  return (
    <Card className="p-4 border-slate-700/50 bg-slate-800/50 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 hover:bg-slate-800/70">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100 truncate">{item.drop.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-xs border ${getRarityColor(item.drop.rarity)}`}>
              <Star className="h-3 w-3 mr-1" />
              {item.drop.rarity}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
              x{item.quantity}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{item.drop.description}</p>

      <div className="flex items-center justify-center text-xs bg-gradient-to-r from-amber-900/30 to-amber-800/30 border border-amber-700/50 rounded-lg p-2">
        <Coins className="h-3 w-3 mr-1 text-amber-400" />
        <span className="text-amber-300 font-medium">Valor: {item.drop.value} gold cada</span>
      </div>
    </Card>
  );
}; 