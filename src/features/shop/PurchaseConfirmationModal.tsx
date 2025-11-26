import { useState } from 'react';
import AnimatedModal from '@/components/core/animated-modal';
import { Button } from '@/components/ui/button';
import { type Equipment } from '@/resources/equipment/equipment.model';
import { type Consumable } from '@/resources/consumable/consumable.model';
import { EquipmentImage } from '@/components/ui/equipment-image';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { Coins } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PurchaseConfirmationModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onConfirm: () => Promise<void>;
  item: Equipment | Consumable;
  quantity?: number;
  currentGold: number;
  totalPrice: number;
}

export const PurchaseConfirmationModal: React.FC<PurchaseConfirmationModalProps> = ({
  isOpen,
  setIsOpen,
  onConfirm,
  item,
  quantity = 1,
  currentGold,
  totalPrice,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const isEquipment = 'atk_bonus' in item;
  const newGold = currentGold - totalPrice;
  const canAfford = currentGold >= totalPrice;

  const handleConfirm = async () => {
    if (!canAfford) {
      setIsOpen(false);
      return;
    }

    try {
      setIsLoading(true);
      await onConfirm();
      setIsOpen(false);
    } catch (error) {
      console.error('Erro na confirmação de compra:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="sm"
      title="Confirmar Compra"
      subTitle="Revise os detalhes antes de confirmar"
    >
      <div className="flex flex-col gap-6">
        {/* Item Info */}
        <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
          <div className="flex-shrink-0">
            {isEquipment ? (
              <EquipmentImage equipment={item as Equipment} size="xl" />
            ) : (
              <ConsumableImage consumable={item as Consumable} size="xl" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-slate-100 truncate">{item.name}</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{item.description}</p>
            {quantity > 1 && <p className="text-sm text-slate-500 mt-1">Quantidade: {quantity}x</p>}
          </div>
        </div>

        <Separator />

        {/* Price Info */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-amber-900/30 rounded-lg border border-amber-800/50">
            <span className="text-sm font-medium text-slate-300">Preço Unitário:</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-amber-300">{item.price} gold</span>
            </div>
          </div>

          {quantity > 1 && (
            <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <span className="text-sm font-medium text-slate-300">Total:</span>
              <div className="flex items-center gap-1">
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-slate-100">{totalPrice} gold</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
            <span className="text-sm font-medium text-slate-300">Gold Atual:</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-slate-100">{currentGold} gold</span>
            </div>
          </div>

          <div
            className={`flex justify-between items-center p-3 rounded-lg border ${
              canAfford
                ? 'bg-emerald-900/30 border-emerald-800/50'
                : 'bg-red-900/30 border-red-800/50'
            }`}
          >
            <span className="text-sm font-medium text-slate-300">Gold Após Compra:</span>
            <div className="flex items-center gap-1">
              <Coins className={`h-4 w-4 ${canAfford ? 'text-emerald-400' : 'text-red-400'}`} />
              <span className={`font-bold ${canAfford ? 'text-emerald-300' : 'text-red-300'}`}>
                {newGold} gold
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canAfford || isLoading}
            className={`min-w-[100px] ${
              !canAfford
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
            }`}
          >
            {isLoading ? 'Processando...' : canAfford ? 'Confirmar Compra' : 'Gold Insuficiente'}
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};
