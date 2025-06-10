import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sword, Shield } from 'lucide-react';
import { type Equipment } from '@/resources/game/models/equipment.model';

interface WeaponSlotSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment;
  onSlotSelected: (slotType: 'main_hand' | 'off_hand') => void;
  currentMainHand?: Equipment | null;
  currentOffHand?: Equipment | null;
}

export const WeaponSlotSelectionModal: React.FC<WeaponSlotSelectionModalProps> = ({
  isOpen,
  onClose,
  equipment,
  onSlotSelected,
  currentMainHand,
  currentOffHand,
}) => {
  const handleSlotSelection = (slotType: 'main_hand' | 'off_hand') => {
    onSlotSelected(slotType);
    onClose();
  };

  const getRarityColor = (rarity: Equipment['rarity']) => {
    const colors = {
      common: 'text-gray-400 bg-gray-900/50',
      uncommon: 'text-green-400 bg-green-900/50',
      rare: 'text-blue-400 bg-blue-900/50',
      epic: 'text-purple-400 bg-purple-900/50',
      legendary: 'text-yellow-400 bg-yellow-900/50',
    };
    return colors[rarity];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5" />
            Escolher Slot para Equipar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do item */}
          <Card className="p-4 bg-card/95">
            <div className="flex items-start gap-3">
              <Sword className="h-8 w-8 text-primary mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary">{equipment.name}</h3>
                <span className={`px-2 py-1 rounded text-sm ${getRarityColor(equipment.rarity)}`}>
                  {equipment.rarity}
                </span>
                <p className="text-sm text-muted-foreground mt-2">{equipment.description}</p>

                <div className="flex gap-4 mt-2 text-sm">
                  {equipment.atk_bonus > 0 && (
                    <span className="text-red-400">+{equipment.atk_bonus} Ataque</span>
                  )}
                  {equipment.def_bonus > 0 && (
                    <span className="text-blue-400">+{equipment.def_bonus} Defesa</span>
                  )}
                  {equipment.mana_bonus > 0 && (
                    <span className="text-purple-400">+{equipment.mana_bonus} Mana</span>
                  )}
                  {equipment.speed_bonus > 0 && (
                    <span className="text-yellow-400">+{equipment.speed_bonus} Velocidade</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <p className="text-center text-muted-foreground">
            Escolha em qual slot você deseja equipar esta arma:
          </p>

          {/* Opções de slot */}
          <div className="grid grid-cols-2 gap-4">
            {/* Mão Principal */}
            <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-2 border-primary/20 hover:border-primary/40">
              <button onClick={() => handleSlotSelection('main_hand')} className="w-full text-left">
                <div className="flex items-center gap-3 mb-3">
                  <Sword className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold">Mão Principal</h3>
                </div>

                {currentMainHand ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Equipado atualmente:</p>
                    <div className="bg-muted p-2 rounded">
                      <p className="font-medium text-sm">{currentMainHand.name}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getRarityColor(currentMainHand.rarity)}`}
                      >
                        {currentMainHand.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-yellow-500">⚠️ Substituirá o item atual</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Slot vazio</p>
                )}
              </button>
            </Card>

            {/* Mão Secundária */}
            <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer border-2 border-primary/20 hover:border-primary/40">
              <button onClick={() => handleSlotSelection('off_hand')} className="w-full text-left">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="h-6 w-6 text-blue-400" />
                  <h3 className="text-lg font-semibold">Mão Secundária</h3>
                </div>

                {currentOffHand ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Equipado atualmente:</p>
                    <div className="bg-muted p-2 rounded">
                      <p className="font-medium text-sm">{currentOffHand.name}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs ${getRarityColor(currentOffHand.rarity)}`}
                      >
                        {currentOffHand.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-yellow-500">⚠️ Substituirá o item atual</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Slot vazio</p>
                    <p className="text-xs text-blue-400">
                      💡 Dual-wielding: +15% de dano de ataque!
                    </p>
                  </div>
                )}
              </button>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
