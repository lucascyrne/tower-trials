import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Sword, Shield, ShirtIcon, Gem } from 'lucide-react';
import { type Character } from '@/resources/game/character.model';
import { type EquipmentSlots, type Equipment } from '@/resources/game/equipment.model';

interface CharacterPaperDollProps {
  character: Character;
  equippedItems: EquipmentSlots;
  onUnequipSlot: (slotType: keyof EquipmentSlots) => void;
}

export const CharacterPaperDoll: React.FC<CharacterPaperDollProps> = ({
  character,
  equippedItems,
  onUnequipSlot,
}) => {
  const getSlotIcon = (slotType: keyof EquipmentSlots) => {
    switch (slotType) {
      case 'main_hand':
        return <Sword className="h-8 w-8 text-red-400" />;
      case 'off_hand':
        return <Shield className="h-8 w-8 text-blue-400" />;
      case 'armor':
        return <ShirtIcon className="h-8 w-8 text-emerald-400" />;
      case 'accessory':
        return <Gem className="h-8 w-8 text-purple-400" />;
    }
  };

  const getSlotLabel = (slotType: keyof EquipmentSlots) => {
    switch (slotType) {
      case 'main_hand':
        return 'Mão Principal';
      case 'off_hand':
        return 'Mão Secundária';
      case 'armor':
        return 'Armadura';
      case 'accessory':
        return 'Acessório';
    }
  };

  const getRarityColor = (rarity: Equipment['rarity']) => {
    const colors = {
      common: 'bg-slate-800/80 text-slate-300 border-slate-600',
      uncommon: 'bg-emerald-900/80 text-emerald-300 border-emerald-600',
      rare: 'bg-blue-900/80 text-blue-300 border-blue-600',
      epic: 'bg-purple-900/80 text-purple-300 border-purple-600',
      legendary: 'bg-amber-900/80 text-amber-300 border-amber-600',
    };
    return colors[rarity];
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-primary/30 backdrop-blur-sm">
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 flex items-center justify-center backdrop-blur-sm">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-primary">{character.name}</h3>
        <p className="text-sm text-slate-400">Nível {character.level}</p>
      </div>

      <div className="space-y-3">
        {(['main_hand', 'off_hand', 'armor', 'accessory'] as const).map(slotType => {
          const equipment = equippedItems[slotType];

          return (
            <Card
              key={slotType}
              className={`p-4 border-2 transition-all duration-200 backdrop-blur-sm ${
                equipment
                  ? 'bg-slate-800/60 border-primary/50 hover:border-primary/70 shadow-lg shadow-primary/10'
                  : 'bg-slate-800/30 border-dashed border-slate-600/50 hover:border-slate-500/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-slate-400">{getSlotIcon(slotType)}</div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-slate-300 mb-1">
                    {getSlotLabel(slotType)}
                  </h4>
                  {equipment ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-primary truncate">
                          {equipment.name}
                        </p>
                        <Badge
                          className={`${getRarityColor(equipment.rarity)} text-xs`}
                          variant="outline"
                        >
                          {equipment.rarity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {equipment.atk_bonus > 0 && (
                          <span className="text-red-400">+{equipment.atk_bonus} ATK</span>
                        )}
                        {equipment.def_bonus > 0 && (
                          <span className="text-blue-400">+{equipment.def_bonus} DEF</span>
                        )}
                        {equipment.mana_bonus > 0 && (
                          <span className="text-purple-400">+{equipment.mana_bonus} MP</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUnequipSlot(slotType)}
                        className="w-full mt-2 h-7 text-xs border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-slate-100"
                      >
                        Desequipar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Slot vazio</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Stats do personagem */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2 bg-slate-800/30 rounded border border-slate-700/30">
            <span className="text-slate-400">ATK:</span>
            <span className="font-medium text-red-400">{character.atk}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-800/30 rounded border border-slate-700/30">
            <span className="text-slate-400">DEF:</span>
            <span className="font-medium text-blue-400">{character.def}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-800/30 rounded border border-slate-700/30">
            <span className="text-slate-400">HP:</span>
            <span className="font-medium text-emerald-400">
              {character.hp}/{character.max_hp}
            </span>
          </div>
          <div className="flex justify-between p-2 bg-slate-800/30 rounded border border-slate-700/30">
            <span className="text-slate-400">MP:</span>
            <span className="font-medium text-purple-400">
              {character.mana}/{character.max_mana}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
