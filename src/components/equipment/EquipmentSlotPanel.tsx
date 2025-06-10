import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { type EquipmentSlots, type Equipment } from '@/resources/game/models/equipment.model';
import { Sword, Shield, Shirt, Gem, Plus } from 'lucide-react';

interface EquipmentSlotPanelProps {
  equippedSlots: EquipmentSlots;
  onSlotClick: (slotType: string, item: Equipment | null) => void;
  onSlotLongPress: (slotType: string) => void;
}

export const EquipmentSlotPanel: React.FC<EquipmentSlotPanelProps> = ({
  equippedSlots,
  onSlotClick,
  onSlotLongPress,
}) => {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const startPress = useCallback(
    (slotType: string) => {
      setIsLongPress(false);
      const timer = setTimeout(() => {
        setIsLongPress(true);
        // Chamar o callback do componente pai que fará a navegação
        onSlotLongPress(slotType);
      }, 800); // 800ms para dar tempo suficiente para o usuário perceber
      setPressTimer(timer);
    },
    [onSlotLongPress]
  );

  const endPress = useCallback(
    (slotType: string, item: Equipment | null) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }

      // Só executa o click se não foi um long press
      if (!isLongPress) {
        onSlotClick(slotType, item);
      }

      // Reset do estado após um pequeno delay
      setTimeout(() => setIsLongPress(false), 100);
    },
    [pressTimer, isLongPress, onSlotClick]
  );

  const cancelPress = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setIsLongPress(false);
  }, [pressTimer]);

  const getSlotIcon = (slotType: string, item: Equipment | null) => {
    if (item) {
      switch (item.type) {
        case 'weapon':
          return <Sword className="h-8 w-8 text-red-400" />;
        case 'armor':
          return <Shirt className="h-8 w-8 text-blue-400" />;
        case 'accessory':
          return <Gem className="h-8 w-8 text-purple-400" />;
        default:
          return <Shield className="h-8 w-8 text-slate-400" />;
      }
    }

    switch (slotType) {
      case 'main_hand':
      case 'off_hand':
        return <Sword className="h-8 w-8 text-slate-500" />;
      case 'armor':
        return <Shirt className="h-8 w-8 text-slate-500" />;
      case 'accessory':
        return <Gem className="h-8 w-8 text-slate-500" />;
      default:
        return <Plus className="h-8 w-8 text-slate-500" />;
    }
  };

  const getRarityColor = (rarity?: string) => {
    if (!rarity) return 'border-slate-600 bg-slate-800/30';

    const colors = {
      common: 'border-slate-600 bg-slate-800/30',
      uncommon: 'border-emerald-600 bg-emerald-900/30',
      rare: 'border-blue-600 bg-blue-900/30',
      epic: 'border-purple-600 bg-purple-900/30',
      legendary: 'border-amber-600 bg-amber-900/30',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const renderEquipmentSlot = (slotType: keyof EquipmentSlots, label: string) => {
    const item = equippedSlots[slotType];
    const isEmpty = !item;

    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 block text-center">{label}</label>
        <div className="relative group">
          <Button
            variant="outline"
            className={`w-full h-32 p-4 border-2 transition-all duration-300 ${
              isEmpty
                ? 'border-dashed border-slate-600 bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:border-slate-500 hover:from-slate-700/50 hover:to-slate-800/70'
                : `${getRarityColor(item.rarity)} hover:brightness-110 shadow-lg`
            } hover:scale-[1.02] active:scale-[0.98] select-none`}
            // Mouse events
            onMouseDown={() => startPress(slotType)}
            onMouseUp={() => endPress(slotType, item ?? null)}
            onMouseLeave={cancelPress}
            // Touch events
            onTouchStart={() => startPress(slotType)}
            onTouchEnd={() => endPress(slotType, item ?? null)}
            onTouchCancel={cancelPress}
            // Prevent context menu on long press
            onContextMenu={e => e.preventDefault()}
          >
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <div className={`p-3 rounded-lg ${isEmpty ? 'bg-slate-700/30' : 'bg-black/20'}`}>
                {getSlotIcon(slotType, item ?? null)}
              </div>
              {item ? (
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium text-slate-200 leading-tight max-w-full">
                    {item.name.length > 12 ? `${item.name.substring(0, 12)}...` : item.name}
                  </div>
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    {item.rarity}
                  </Badge>
                </div>
              ) : (
                <div className="text-sm text-slate-500 font-medium">Vazio</div>
              )}
            </div>
          </Button>

          {/* Indicador visual para long press */}
          <div className="absolute inset-0 rounded-lg border-2 border-transparent group-active:border-amber-400/50 transition-colors duration-200 pointer-events-none" />

          {/* Tooltip sutil */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <div className="bg-slate-900/90 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700/50 shadow-lg whitespace-nowrap">
              {isEmpty ? 'Toque e segure para equipar' : 'Toque para detalhes'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderArmorSlot = (index: number) => {
    // Apenas o primeiro slot (peitoral) está habilitado
    const isEnabled = index === 0;
    const slotName =
      index === 0 ? 'Peitoral' : index === 1 ? 'Capacete' : index === 2 ? 'Pernas' : 'Botas';

    if (isEnabled) {
      // Usar o slot de armor existente para o peitoral
      return renderEquipmentSlot('armor', slotName);
    }

    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 block text-center">{slotName}</label>
        <div className="relative group">
          <Button
            variant="outline"
            className="w-full h-32 p-4 border-2 border-dashed border-slate-600 bg-gradient-to-br from-slate-800/20 to-slate-900/40 transition-all duration-300 opacity-60"
            disabled
          >
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <div className="p-3 rounded-lg bg-slate-700/20">
                <Shirt className="h-8 w-8 text-slate-500" />
              </div>
              <div className="text-sm text-slate-500 font-medium">Em breve</div>
            </div>
          </Button>
        </div>
      </div>
    );
  };

  const renderAccessorySlot = (index: number) => {
    const hasItem = index === 0 && equippedSlots.accessory;
    const isDisabled = index > 0;

    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 block text-center">
          {index === 0 ? 'Anel 1' : index === 1 ? 'Anel 2' : index === 2 ? 'Colar' : 'Amuleto'}
        </label>
        <div className="relative group">
          <Button
            variant="outline"
            className={`w-full h-32 p-4 border-2 transition-all duration-300 ${
              hasItem
                ? `${getRarityColor(equippedSlots.accessory!.rarity)} hover:brightness-110 shadow-lg hover:scale-[1.02]`
                : isDisabled
                  ? 'border-dashed border-slate-600 bg-gradient-to-br from-slate-800/20 to-slate-900/40 opacity-60'
                  : 'border-dashed border-slate-600 bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:border-slate-500 hover:from-slate-700/50 hover:to-slate-800/70 hover:scale-[1.02]'
            } active:scale-[0.98] select-none`}
            // Mouse events
            onMouseDown={() => index === 0 && startPress('accessory')}
            onMouseUp={() => index === 0 && endPress('accessory', equippedSlots.accessory ?? null)}
            onMouseLeave={cancelPress}
            // Touch events
            onTouchStart={() => index === 0 && startPress('accessory')}
            onTouchEnd={() => index === 0 && endPress('accessory', equippedSlots.accessory ?? null)}
            onTouchCancel={cancelPress}
            // Prevent context menu on long press
            onContextMenu={e => e.preventDefault()}
            disabled={isDisabled}
          >
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <div className={`p-3 rounded-lg ${hasItem ? 'bg-black/20' : 'bg-slate-700/30'}`}>
                <Gem className="h-8 w-8 text-slate-500" />
              </div>
              {hasItem ? (
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium text-slate-200 leading-tight max-w-full">
                    {equippedSlots.accessory!.name.length > 12
                      ? `${equippedSlots.accessory!.name.substring(0, 12)}...`
                      : equippedSlots.accessory!.name}
                  </div>
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    {equippedSlots.accessory!.rarity}
                  </Badge>
                </div>
              ) : (
                <div className="text-sm text-slate-500 font-medium">
                  {index === 0 ? 'Vazio' : 'Em breve'}
                </div>
              )}
            </div>
          </Button>

          {/* Indicador visual para long press */}
          {!isDisabled && (
            <div className="absolute inset-0 rounded-lg border-2 border-transparent group-active:border-amber-400/50 transition-colors duration-200 pointer-events-none" />
          )}

          {/* Tooltip sutil */}
          {!isDisabled && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <div className="bg-slate-900/90 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700/50 shadow-lg whitespace-nowrap">
                {hasItem ? 'Toque para detalhes' : 'Toque e segure para equipar'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-400" />
          Equipamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Armas */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-6">Armas</h3>
          <div className="grid grid-cols-2 gap-6">
            {renderEquipmentSlot('main_hand', 'Mão Principal')}
            {renderEquipmentSlot('off_hand', 'Mão Secundária')}
          </div>
        </div>

        {/* Armaduras */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-6">Armaduras</h3>
          <div className="grid grid-cols-2 gap-6">
            {[0, 1, 2, 3].map(index => (
              <div key={`armor-slot-${index}`}>{renderArmorSlot(index)}</div>
            ))}
          </div>
        </div>

        {/* Acessórios */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-6">Acessórios</h3>
          <div className="grid grid-cols-2 gap-6">
            {[0, 1, 2, 3].map(index => (
              <div key={`accessory-slot-${index}`}>{renderAccessorySlot(index)}</div>
            ))}
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-slate-700/30 p-4 rounded-lg">
          <p className="text-sm text-slate-400 text-center">
            Toque para ver detalhes • Toque e segure para equipar/trocar
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
