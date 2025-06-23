import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Coins, Package, Minus, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SellItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => Promise<void>;
  itemName: string;
  itemIcon?: React.ReactNode;
  itemRarity?: string;
  availableQuantity: number;
  unitSellPrice: number;
  originalPrice?: number;
  isLoading?: boolean;
}

export const SellItemModal: React.FC<SellItemModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemIcon,
  itemRarity,
  availableQuantity,
  unitSellPrice,
  originalPrice,
  isLoading = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset quantity when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  const totalPrice = quantity * unitSellPrice;
  const discountPercentage = originalPrice
    ? Math.round((1 - unitSellPrice / originalPrice) * 100)
    : 0;

  const handleQuantityChange = (newQuantity: number) => {
    const clampedQuantity = Math.max(1, Math.min(newQuantity, availableQuantity));
    setQuantity(clampedQuantity);
  };

  const handleConfirm = async () => {
    if (quantity <= 0 || quantity > availableQuantity) {
      toast.error('Quantidade inválida');
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm(quantity);
      onClose();
    } catch (error) {
      console.error('Erro ao vender item:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const getRarityColor = (rarity?: string) => {
    const colors = {
      common: 'border-slate-600 bg-slate-800/30 text-slate-300',
      uncommon: 'border-emerald-600 bg-emerald-900/30 text-emerald-300',
      rare: 'border-blue-600 bg-blue-900/30 text-blue-300',
      epic: 'border-purple-600 bg-purple-900/30 text-purple-300',
      legendary: 'border-amber-600 bg-amber-900/30 text-amber-300',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900/95 border-slate-700/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Package className="h-5 w-5 text-amber-400" />
            Vender Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-700/50 bg-slate-800/30">
            <div className="flex-shrink-0">
              {itemIcon || <Package className="h-8 w-8 text-slate-400" />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-100">{itemName}</h3>
              <div className="flex items-center gap-2 mt-1">
                {itemRarity && (
                  <Badge className={`text-xs ${getRarityColor(itemRarity)}`}>{itemRarity}</Badge>
                )}
                <span className="text-xs text-slate-400">Disponível: {availableQuantity}</span>
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium text-slate-300">
              Quantidade
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1 || isLoading}
                className="h-8 w-8 p-0 border-slate-600"
              >
                <Minus className="h-3 w-3" />
              </Button>

              <Input
                id="quantity"
                type="number"
                min={1}
                max={availableQuantity}
                value={quantity}
                onChange={e => handleQuantityChange(parseInt(e.target.value) || 1)}
                disabled={isLoading}
                className="text-center bg-slate-800/50 border-slate-600 text-slate-100"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= availableQuantity || isLoading}
                className="h-8 w-8 p-0 border-slate-600"
              >
                <Plus className="h-3 w-3" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(availableQuantity)}
                disabled={quantity === availableQuantity || isLoading}
                className="text-xs px-2 border-slate-600"
              >
                Máx
              </Button>
            </div>
          </div>

          {/* Price Preview */}
          <div className="space-y-3 p-4 rounded-lg border border-slate-700/50 bg-slate-800/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Preço unitário:</span>
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3 text-amber-400" />
                <span className="text-amber-300 font-medium">{unitSellPrice}</span>
              </div>
            </div>

            {originalPrice && discountPercentage > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Preço original:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 line-through">{originalPrice}</span>
                  <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">
                    -{discountPercentage}%
                  </Badge>
                </div>
              </div>
            )}

            <div className="border-t border-slate-700/50 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">Total:</span>
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span className="text-lg font-bold text-amber-300">{totalPrice}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning for low sell price */}
          {discountPercentage >= 70 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-600/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-300">
                <p className="font-medium">Preço baixo de venda</p>
                <p className="text-amber-400/80">
                  Você receberá apenas {100 - discountPercentage}% do valor original.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isConfirming || isLoading}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming || isLoading || quantity <= 0}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-current"></div>
                  Vendendo...
                </div>
              ) : (
                `Vender por ${totalPrice} gold`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
