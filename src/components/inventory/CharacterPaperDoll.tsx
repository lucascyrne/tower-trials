import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Sword, Shield, ShirtIcon, Gem } from 'lucide-react';
import { Character } from '@/resources/game/models/character.model';
import { EquipmentSlots, Equipment } from '@/resources/game/models/equipment.model';

interface CharacterPaperDollProps {
  character: Character;
  equippedItems: EquipmentSlots;
  onUnequipSlot: (slotType: keyof EquipmentSlots) => void;
}

export const CharacterPaperDoll: React.FC<CharacterPaperDollProps> = ({
  character,
  equippedItems,
  onUnequipSlot
}) => {
  const getSlotIcon = (slotType: keyof EquipmentSlots) => {
    switch (slotType) {
      case 'main_hand': return <Sword className="h-8 w-8" />;
      case 'off_hand': return <Shield className="h-8 w-8" />;
      case 'armor': return <ShirtIcon className="h-8 w-8" />;
      case 'accessory': return <Gem className="h-8 w-8" />;
    }
  };

  const getSlotLabel = (slotType: keyof EquipmentSlots) => {
    switch (slotType) {
      case 'main_hand': return 'Mão Principal';
      case 'off_hand': return 'Mão Secundária';
      case 'armor': return 'Armadura';
      case 'accessory': return 'Acessório';
    }
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

  return (
    <Card className="p-6 bg-gradient-to-br from-card/95 to-card/80 border-2 border-primary/30">
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-primary">{character.name}</h3>
        <p className="text-sm text-muted-foreground">Nível {character.level}</p>
      </div>

      <div className="space-y-3">
        {(['main_hand', 'off_hand', 'armor', 'accessory'] as const).map(slotType => {
          const equipment = equippedItems[slotType];
          
          return (
            <Card 
              key={slotType} 
              className={`p-4 bg-card/60 border-2 transition-all duration-200 ${
                equipment 
                  ? 'border-primary/50 hover:border-primary/70' 
                  : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-muted-foreground">
                  {getSlotIcon(slotType)}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    {getSlotLabel(slotType)}
                  </h4>
                  {equipment ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-primary">
                          {equipment.name}
                        </p>
                        <Badge className={getRarityColor(equipment.rarity)} variant="outline">
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
                        variant="destructive"
                        onClick={() => onUnequipSlot(slotType)}
                        className="w-full mt-2 h-7 text-xs"
                      >
                        Desequipar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Slot vazio</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Stats do personagem */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ATK:</span>
            <span className="font-medium">{character.atk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">DEF:</span>
            <span className="font-medium">{character.def}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">HP:</span>
            <span className="font-medium">{character.hp}/{character.max_hp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MP:</span>
            <span className="font-medium">{character.mana}/{character.max_mana}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}; 