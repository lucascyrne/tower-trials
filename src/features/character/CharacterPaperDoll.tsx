import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Sword, Shield, ShirtIcon, Gem, Crown, Zap, Footprints, Heart } from 'lucide-react';
import { type Character } from '@/models/character.model';
import {
  type EquipmentSlots,
  type Equipment,
  type EquipmentSlotType,
} from '@/models/equipment.model';

interface CharacterPaperDollProps {
  character: Character;
  equippedItems: EquipmentSlots;
  onUnequipSlot: (slotType: EquipmentSlotType) => void;
}

export const CharacterPaperDoll: React.FC<CharacterPaperDollProps> = ({
  character,
  equippedItems,
  onUnequipSlot,
}) => {
  const getSlotIcon = (slotType: EquipmentSlotType, equipment?: Equipment) => {
    // Se tem equipamento, usar ícone baseado no tipo do item
    if (equipment) {
      switch (equipment.type) {
        case 'weapon':
          return <Sword className="h-8 w-8 text-red-400" />;
        case 'armor':
        case 'chest':
          return <ShirtIcon className="h-8 w-8 text-blue-400" />;
        case 'helmet':
          return <Crown className="h-8 w-8 text-amber-400" />;
        case 'legs':
          return <ShirtIcon className="h-8 w-8 text-green-400" />;
        case 'boots':
          return <Footprints className="h-8 w-8 text-brown-400" />;
        case 'ring':
          return <Gem className="h-8 w-8 text-purple-400" />;
        case 'necklace':
          return <Heart className="h-8 w-8 text-pink-400" />;
        case 'amulet':
          return <Zap className="h-8 w-8 text-yellow-400" />;
        default:
          return <Shield className="h-8 w-8 text-slate-400" />;
      }
    }

    // Ícones para slots vazios baseado no tipo do slot
    switch (slotType) {
      case 'main_hand':
      case 'off_hand':
        return <Sword className="h-8 w-8 text-slate-500" />;
      case 'armor':
      case 'chest':
        return <ShirtIcon className="h-8 w-8 text-slate-500" />;
      case 'helmet':
        return <Crown className="h-8 w-8 text-slate-500" />;
      case 'legs':
        return <ShirtIcon className="h-8 w-8 text-slate-500" />;
      case 'boots':
        return <Footprints className="h-8 w-8 text-slate-500" />;
      case 'ring_1':
      case 'ring_2':
        return <Gem className="h-8 w-8 text-slate-500" />;
      case 'necklace':
        return <Heart className="h-8 w-8 text-slate-500" />;
      case 'amulet':
        return <Zap className="h-8 w-8 text-slate-500" />;
      default:
        return <Shield className="h-8 w-8 text-slate-500" />;
    }
  };

  const getSlotLabel = (slotType: EquipmentSlotType) => {
    const labels = {
      main_hand: 'Mão Principal',
      off_hand: 'Mão Secundária',
      armor: 'Armadura',
      chest: 'Peitoral',
      helmet: 'Capacete',
      legs: 'Pernas',
      boots: 'Botas',
      ring_1: 'Anel 1',
      ring_2: 'Anel 2',
      necklace: 'Colar',
      amulet: 'Amuleto',
    };
    return labels[slotType];
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

  // Organizar slots por categoria
  const weaponSlots: EquipmentSlotType[] = ['main_hand', 'off_hand'];
  const armorSlots: EquipmentSlotType[] = ['armor', 'chest', 'helmet', 'legs', 'boots'];
  const accessorySlots: EquipmentSlotType[] = ['ring_1', 'ring_2', 'necklace', 'amulet'];

  const renderSlotSection = (title: string, slots: EquipmentSlotType[]) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-primary border-b border-primary/30 pb-1">
        {title}
      </h4>
      <div className="space-y-2">
        {slots.map(slotType => {
          const equipment = equippedItems[slotType];
          const isDisabled =
            slotType !== 'main_hand' &&
            slotType !== 'off_hand' &&
            slotType !== 'armor' &&
            slotType !== 'ring_1' &&
            !equipment;

          return (
            <Card
              key={slotType}
              className={`p-3 border-2 transition-all duration-200 backdrop-blur-sm ${
                equipment
                  ? 'bg-slate-800/60 border-primary/50 hover:border-primary/70 shadow-lg shadow-primary/10'
                  : isDisabled
                    ? 'bg-slate-800/20 border-dashed border-slate-600/30 opacity-60'
                    : 'bg-slate-800/30 border-dashed border-slate-600/50 hover:border-slate-500/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-slate-400">
                  {getSlotIcon(slotType, equipment)}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-medium text-slate-300 mb-1">
                    {getSlotLabel(slotType)}
                  </h5>
                  {equipment ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
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
                      <div className="flex flex-wrap gap-1 text-xs">
                        {equipment.atk_bonus > 0 && (
                          <span className="text-red-400">+{equipment.atk_bonus} ATK</span>
                        )}
                        {equipment.def_bonus > 0 && (
                          <span className="text-blue-400">+{equipment.def_bonus} DEF</span>
                        )}
                        {equipment.mana_bonus > 0 && (
                          <span className="text-purple-400">+{equipment.mana_bonus} MP</span>
                        )}
                        {equipment.hp_bonus > 0 && (
                          <span className="text-emerald-400">+{equipment.hp_bonus} HP</span>
                        )}
                        {equipment.speed_bonus > 0 && (
                          <span className="text-yellow-400">+{equipment.speed_bonus} SPD</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUnequipSlot(slotType)}
                        className="w-full mt-2 h-6 text-xs border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-slate-100"
                      >
                        Desequipar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      {isDisabled ? 'Em breve' : 'Slot vazio'}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-primary/30 backdrop-blur-sm">
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 flex items-center justify-center backdrop-blur-sm">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-primary">{character.name}</h3>
        <p className="text-sm text-slate-400">Nível {character.level}</p>
      </div>

      <div className="space-y-6">
        {renderSlotSection('Armas', weaponSlots)}
        {renderSlotSection('Armaduras', armorSlots)}
        {renderSlotSection('Acessórios', accessorySlots)}
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
