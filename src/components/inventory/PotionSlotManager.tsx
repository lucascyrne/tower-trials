import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, type PotionSlot } from '@/resources/game/slot.service';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { toast } from 'sonner';
import { Beaker, Plus, X, Heart, Zap, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { formatPotionSlotEffect, formatConsumableEffect } from '@/utils/consumable-utils';

interface PotionSlotManagerProps {
  characterId: string;
  consumables: CharacterConsumable[];
  onSlotsUpdate?: () => void;
}

export function PotionSlotManager({
  characterId,
  consumables,
  onSlotsUpdate,
}: PotionSlotManagerProps) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const loadPotionSlots = async () => {
    try {
      const response = await SlotService.getCharacterPotionSlots(characterId);
      if (response.success && response.data) {
        setPotionSlots(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar slots de poção:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (characterId) {
      loadPotionSlots();
    }
  }, [characterId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
        setDropdownPosition(null);
      }
    };

    const handleScroll = () => {
      setOpenDropdown(null);
      setDropdownPosition(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Calcular posição do dropdown quando abrir
  useEffect(() => {
    if (openDropdown !== null && slotRefs.current[openDropdown]) {
      const slotElement = slotRefs.current[openDropdown];
      if (slotElement) {
        const rect = slotElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = 200; // altura estimada reduzida

        let top = rect.bottom + 4;
        let left = rect.left;

        // Se o dropdown sair da tela na parte inferior, posicionar acima do slot
        if (top + dropdownHeight > viewportHeight) {
          top = rect.top - dropdownHeight - 4;
        }

        // Se sair da tela na lateral direita, ajustar para a esquerda
        if (left + 240 > window.innerWidth) {
          left = window.innerWidth - 240 - 8;
        }

        // Garantir que não saia da tela na lateral esquerda
        if (left < 8) {
          left = 8;
        }

        setDropdownPosition({ top, left });
      }
    }
  }, [openDropdown]);

  const handleSetPotionSlot = async (slotPosition: number, consumableId: string) => {
    try {
      const response = await SlotService.setPotionSlot(characterId, slotPosition, consumableId);

      if (response.success) {
        await loadPotionSlots();
        onSlotsUpdate?.();
        toast.success('Poção atribuída ao slot!');
        setOpenDropdown(null);
        setDropdownPosition(null);
      } else {
        toast.error(response.error || 'Erro ao atribuir poção');
      }
    } catch (error) {
      console.error('Erro ao configurar slot:', error);
      toast.error('Erro ao configurar slot');
    }
  };

  const handleClearSlot = async (slotPosition: number) => {
    try {
      const response = await SlotService.clearPotionSlot(characterId, slotPosition);

      if (response.success) {
        await loadPotionSlots();
        onSlotsUpdate?.();
        toast.success('Slot limpo!');
      } else {
        toast.error(response.error || 'Erro ao limpar slot');
      }
    } catch (error) {
      console.error('Erro ao limpar slot:', error);
      toast.error('Erro ao limpar slot');
    }
  };

  const handleSlotClick = (slotPosition: number) => {
    if (openDropdown === slotPosition) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      setOpenDropdown(slotPosition);
    }
  };

  const getSlotKeyBinding = (position: number) => {
    switch (position) {
      case 1:
        return 'Q';
      case 2:
        return 'W';
      case 3:
        return 'E';
      default:
        return '';
    }
  };

  const getPotionIcon = (slot: PotionSlot) => {
    if (!slot.consumable_description) return <Beaker className="h-4 w-4 text-slate-500" />;

    if (
      slot.consumable_description.includes('HP') ||
      slot.consumable_description.includes('Vida')
    ) {
      return <Heart className="h-4 w-4 text-red-400" />;
    }
    if (slot.consumable_description.includes('Mana')) {
      return <Zap className="h-4 w-4 text-blue-400" />;
    }
    return <Beaker className="h-4 w-4 text-purple-400" />;
  };

  const getPotionQuantity = (slot: PotionSlot) => {
    if (!slot.consumable_id) return 0;

    const consumable = consumables.find(c => c.consumable_id === slot.consumable_id);
    return consumable?.quantity || 0;
  };

  const getPotionEffectLabel = (slot: PotionSlot) => {
    if (!slot.effect_value || !slot.consumable_description) return '';
    return formatPotionSlotEffect(slot.effect_value, slot.consumable_description);
  };

  // Função modificada para filtrar poções que já estão em outros slots
  const getAvailablePotions = (currentSlotPosition?: number) => {
    // Obter consumíveis de outros slots (excluindo o slot atual)
    const occupiedConsumableIds = potionSlots
      .filter(slot => slot.consumable_id && slot.slot_position !== currentSlotPosition)
      .map(slot => slot.consumable_id);

    // Filtrar consumíveis disponíveis excluindo os que já estão em outros slots
    const availablePotions = consumables.filter(c => {
      const isValidPotion = c.consumable && c.consumable.type === 'potion' && c.quantity > 0;
      const isNotOccupied = !occupiedConsumableIds.includes(c.consumable_id);

      return isValidPotion && isNotOccupied;
    });

    return availablePotions;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium">Atalhos Rápidos</div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div
              key={`loading-slot-${i}`}
              className="w-12 h-12 bg-slate-700/20 rounded border border-slate-700/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Componente do dropdown para renderizar via portal
  const DropdownContent = ({ slot }: { slot: PotionSlot }) => {
    const availablePotions = getAvailablePotions(slot.slot_position);

    return (
      <div
        ref={dropdownRef}
        className="fixed w-60 bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 rounded-md shadow-xl max-h-48 overflow-y-auto"
        style={{
          top: dropdownPosition?.top || 0,
          left: dropdownPosition?.left || 0,
          zIndex: 9999,
        }}
      >
        {availablePotions.length > 0 ? (
          <div className="p-1">
            {availablePotions.map(consumable => (
              <button
                key={`dropdown-${consumable.id}`}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700/50 transition-colors flex items-center gap-2 text-sm"
                onClick={() => handleSetPotionSlot(slot.slot_position, consumable.consumable_id)}
              >
                <div className="flex-shrink-0">
                  {consumable.consumable!.description.includes('HP') ||
                  consumable.consumable!.description.includes('Vida') ? (
                    <Heart className="h-3 w-3 text-red-400" />
                  ) : consumable.consumable!.description.includes('Mana') ? (
                    <Zap className="h-3 w-3 text-blue-400" />
                  ) : (
                    <Beaker className="h-3 w-3 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {consumable.consumable!.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatConsumableEffect(consumable.consumable!)} • x{consumable.quantity}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center">
            <div className="text-slate-400 text-xs">Nenhuma poção disponível</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 font-medium">Atalhos Rápidos</div>
        <div className="text-xs text-slate-600">Q • W • E</div>
      </div>

      <div className="flex gap-2">
        {potionSlots.map(slot => {
          const keyBinding = getSlotKeyBinding(slot.slot_position);
          const isEmpty = !slot.consumable_id;
          const isDropdownOpen = openDropdown === slot.slot_position;

          return (
            <div
              key={`potion-slot-${slot.slot_position}`}
              className="relative"
              ref={el => {
                slotRefs.current[slot.slot_position] = el;
              }}
            >
              {/* Slot principal */}
              <div className="relative group">
                <Button
                  variant="outline"
                  className={`w-12 h-12 p-1 border transition-all duration-200 ${
                    isEmpty
                      ? 'border-slate-600/50 bg-slate-800/20 hover:border-slate-500/70 hover:bg-slate-700/30'
                      : 'border-blue-500/60 bg-blue-900/20 hover:border-blue-400/80 hover:bg-blue-800/30'
                  } ${isDropdownOpen ? 'ring-1 ring-blue-400/50' : ''}`}
                  onClick={() => {
                    if (isEmpty) {
                      handleSlotClick(slot.slot_position);
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center">
                    {isEmpty ? (
                      <div className="flex items-center">
                        <Plus className="h-3 w-3 text-slate-500" />
                        <ChevronDown
                          className={`h-2 w-2 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    ) : (
                      getPotionIcon(slot)
                    )}
                  </div>
                </Button>

                {/* Badge com tecla */}
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-slate-600 text-white text-xs font-medium border border-slate-700 text-[10px]">
                  {keyBinding}
                </Badge>

                {/* Botão de remover */}
                {!isEmpty && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-1 -left-1 h-4 w-4 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => {
                      e.stopPropagation();
                      handleClearSlot(slot.slot_position);
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                )}

                {/* Tooltip */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <div className="bg-slate-900/95 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700/50 whitespace-nowrap">
                    {isEmpty ? `Slot ${keyBinding}` : slot.consumable_name || 'Poção'}
                    {!isEmpty && slot.effect_value && (
                      <div className="text-emerald-300 text-[10px]">
                        {getPotionEffectLabel(slot)}
                      </div>
                    )}
                    {!isEmpty && getPotionQuantity(slot) > 0 && (
                      <div className="text-blue-300 text-[10px]">x{getPotionQuantity(slot)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dropdown renderizado via Portal */}
      {openDropdown !== null &&
        dropdownPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <DropdownContent slot={potionSlots.find(s => s.slot_position === openDropdown)!} />,
          document.body
        )}
    </div>
  );
}
