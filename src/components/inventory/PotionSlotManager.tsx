import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, type PotionSlot } from '@/resources/game/slot.service';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { toast } from 'sonner';
import { Beaker, Plus, X, Keyboard, Heart, Zap, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

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
        const dropdownHeight = 250; // altura estimada do dropdown

        let top = rect.bottom + 8;
        let left = rect.left;

        // Se o dropdown sair da tela na parte inferior, posicionar acima do slot
        if (top + dropdownHeight > viewportHeight) {
          top = rect.top - dropdownHeight - 8;
        }

        // Se sair da tela na lateral direita, ajustar para a esquerda
        if (left + 256 > window.innerWidth) {
          // 256 = w-64
          left = window.innerWidth - 256 - 16;
        }

        // Garantir que não saia da tela na lateral esquerda
        if (left < 16) {
          left = 16;
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
    if (!slot.consumable_description) return <Beaker className="h-8 w-8 text-slate-500" />;

    if (
      slot.consumable_description.includes('HP') ||
      slot.consumable_description.includes('Vida')
    ) {
      return <Heart className="h-8 w-8 text-red-400" />;
    }
    if (slot.consumable_description.includes('Mana')) {
      return <Zap className="h-8 w-8 text-blue-400" />;
    }
    return <Beaker className="h-8 w-8 text-purple-400" />;
  };

  // Função modificada para filtrar poções que já estão em outros slots
  const getAvailablePotions = (currentSlotPosition?: number) => {
    // Obter consumíveis de outros slots (excluindo o slot atual)
    const occupiedConsumableIds = potionSlots
      .filter(slot => slot.consumable_id && slot.slot_position !== currentSlotPosition)
      .map(slot => slot.consumable_id);

    console.log('[PotionSlotManager] Slots ocupados (excluindo atual):', occupiedConsumableIds);

    // Filtrar consumíveis disponíveis excluindo os que já estão em outros slots
    const availablePotions = consumables.filter(c => {
      const isValidPotion = c.consumable && c.consumable.type === 'potion' && c.quantity > 0;
      const isNotOccupied = !occupiedConsumableIds.includes(c.consumable_id);

      if (isValidPotion && !isNotOccupied) {
        console.log(
          `[PotionSlotManager] Poção ${c.consumable?.name} filtrada (já está em outro slot)`
        );
      }

      return isValidPotion && isNotOccupied;
    });

    console.log(
      `[PotionSlotManager] Poções disponíveis para slot ${currentSlotPosition}:`,
      availablePotions.length
    );

    return availablePotions;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Keyboard className="h-4 w-4" />
            <span>Atalhos: Q, W, E</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={`loading-slot-${i}`}
              className="w-full h-20 bg-slate-700/30 rounded-lg animate-pulse"
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
        className="fixed w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        style={{
          top: dropdownPosition?.top || 0,
          left: dropdownPosition?.left || 0,
          zIndex: 9999,
        }}
      >
        {availablePotions.length > 0 ? (
          <div className="p-2 space-y-1">
            <div className="text-xs text-slate-400 px-2 py-1">Selecione uma poção:</div>
            {availablePotions.map(consumable => (
              <button
                key={`dropdown-${consumable.id}`}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700 transition-colors flex items-center gap-3"
                onClick={() => handleSetPotionSlot(slot.slot_position, consumable.consumable_id)}
              >
                <div className="flex-shrink-0">
                  {consumable.consumable!.description.includes('HP') ||
                  consumable.consumable!.description.includes('Vida') ? (
                    <Heart className="h-4 w-4 text-red-400" />
                  ) : consumable.consumable!.description.includes('Mana') ? (
                    <Zap className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Beaker className="h-4 w-4 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">
                    {consumable.consumable!.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    +{consumable.consumable!.effect_value} • x{consumable.quantity}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center">
            <div className="text-slate-400 text-sm">Nenhuma poção disponível</div>
            <div className="text-slate-500 text-xs mt-1">
              {consumables.filter(
                c => c.consumable && c.consumable.type === 'potion' && c.quantity > 0
              ).length > 0
                ? 'Todas as poções já estão equipadas'
                : 'Compre poções na loja'}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Keyboard className="h-4 w-4" />
          <span>Atalhos: Q, W, E</span>
        </div>
        <div className="text-xs text-slate-500">
          Clique para configurar • {consumables.length} consumíveis
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
                  className={`w-full h-20 p-3 border-2 transition-all duration-300 ${
                    isEmpty
                      ? 'border-dashed border-slate-600 bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:border-slate-500 hover:from-slate-700/50 hover:to-slate-800/70'
                      : 'border-solid border-blue-600 bg-gradient-to-br from-blue-900/30 to-blue-800/40 hover:brightness-110 shadow-lg shadow-blue-400/20'
                  } hover:scale-[1.02] active:scale-[0.98] ${isDropdownOpen ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => {
                    if (isEmpty) {
                      handleSlotClick(slot.slot_position);
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div
                      className={`p-2 rounded-lg ${isEmpty ? 'bg-slate-700/30' : 'bg-black/20'}`}
                    >
                      {isEmpty ? (
                        <div className="flex items-center">
                          <Plus className="h-6 w-6 text-slate-500" />
                          <ChevronDown
                            className={`h-4 w-4 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      ) : (
                        getPotionIcon(slot)
                      )}
                    </div>
                    {!isEmpty && slot.effect_value && (
                      <div className="text-xs font-bold text-slate-200 bg-slate-800/50 px-2 py-1 rounded">
                        +{slot.effect_value}
                      </div>
                    )}
                    {isEmpty && <div className="text-xs text-slate-500 font-medium">Vazio</div>}
                  </div>
                </Button>

                {/* Badge com tecla */}
                <Badge className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center bg-blue-600 text-white text-xs font-bold border-2 border-slate-800 shadow-lg">
                  {keyBinding}
                </Badge>

                {/* Botão de remover */}
                {!isEmpty && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -left-2 h-6 w-6 p-0 rounded-full shadow-lg"
                    onClick={e => {
                      e.stopPropagation();
                      handleClearSlot(slot.slot_position);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}

                {/* Tooltip */}
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                  <div className="bg-slate-900/95 text-slate-300 text-xs px-3 py-2 rounded border border-slate-700/50 whitespace-nowrap shadow-lg">
                    {isEmpty ? `Slot ${keyBinding} vazio` : slot.consumable_name || 'Poção'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Informações sobre os slots */}
      <div className="text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
        <div className="space-y-1">
          <p className="font-medium text-slate-400">Como usar:</p>
          <p>• Clique em slots vazios para adicionar poções</p>
          <p>• Use Q, W, E durante batalhas para consumir rapidamente</p>
          <p>• Cada tipo de poção pode estar em apenas um slot</p>
        </div>
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
