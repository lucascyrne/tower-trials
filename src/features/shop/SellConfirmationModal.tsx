import { useState } from 'react';
import AnimatedModal from '@/components/core/animated-modal';
import { Button } from '@/components/ui/button';
import { type Equipment } from '@/resources/equipment/equipment.model';
import { EquipmentImage } from '@/components/ui/equipment-image';
import { Coins } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SellConfirmationModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onConfirm: () => Promise<void>;
  equipment: Equipment;
  sellPrice: number;
  currentGold: number;
}

export const SellConfirmationModal: React.FC<SellConfirmationModalProps> = ({
  isOpen,
  setIsOpen,
  onConfirm,
  equipment,
  sellPrice,
  currentGold,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const newGold = currentGold + sellPrice;

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      setIsOpen(false);
    } catch (error) {
      console.error('Erro na confirmação de venda:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="sm"
      title="Confirmar Venda"
      subTitle="Revise os detalhes antes de confirmar"
    >
      <div className="flex flex-col gap-6">
        {/* Item Info */}
        <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600/50">
          <div className="flex-shrink-0">
            <EquipmentImage equipment={equipment} size="xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-slate-100 truncate">{equipment.name}</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{equipment.description}</p>
          </div>
        </div>

        <Separator />

        {/* Price Info */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-amber-900/30 rounded-lg border border-amber-800/50">
            <span className="text-sm font-medium text-slate-300">Preço de Venda:</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-amber-300">{sellPrice} gold</span>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
            <span className="text-sm font-medium text-slate-300">Gold Atual:</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-slate-100">{currentGold} gold</span>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-emerald-900/30 rounded-lg border border-emerald-800/50">
            <span className="text-sm font-medium text-slate-300">Gold Após Venda:</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-emerald-300">{newGold} gold</span>
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
            disabled={isLoading}
            className="min-w-[100px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600"
          >
            {isLoading ? 'Processando...' : 'Confirmar Venda'}
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};
