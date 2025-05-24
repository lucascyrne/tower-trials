'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, PotionSlot } from '@/resources/game/slot.service';
import { GamePlayer } from '@/resources/game/game-model';
import { toast } from 'sonner';
import { Beaker, Keyboard } from 'lucide-react';

interface PotionSlotsProps {
  player: GamePlayer;
  onPlayerStatsUpdate: (newHp: number, newMana: number) => void;
  disabled?: boolean;
}

export function PotionSlots({ player, onPlayerStatsUpdate, disabled = false }: PotionSlotsProps) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingSlot, setUsingSlot] = useState<number | null>(null);

  const loadPotionSlots = async () => {
    try {
      const response = await SlotService.getCharacterPotionSlots(player.id);
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
    if (player.id) {
      loadPotionSlots();
    }
  }, [player.id]);

  // Função para usar poção do slot
  const handlePotionSlotUse = async (slotPosition: number) => {
    if (disabled || usingSlot !== null) return;

    const slot = potionSlots.find(s => s.slot_position === slotPosition);
    if (!slot?.consumable_id) {
      toast.warning(`Slot ${slotPosition} está vazio`);
      return;
    }

    setUsingSlot(slotPosition);

    try {
      const response = await SlotService.consumePotionFromSlot(player.id, slotPosition);
      
      if (response.success && response.data) {
        const { message, new_hp, new_mana } = response.data;
        
        // Atualizar stats do jogador
        onPlayerStatsUpdate(new_hp, new_mana);
        
        // Recarregar slots (caso a poção tenha esgotado)
        await loadPotionSlots();
        
        toast.success(message);
      } else {
        toast.error(response.error || 'Erro ao usar poção');
      }
    } catch (error) {
      console.error('Erro ao usar poção:', error);
      toast.error('Erro ao usar poção');
    } finally {
      setUsingSlot(null);
    }
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disabled || usingSlot !== null) return;

      const key = event.key.toLowerCase();
      let slotPosition = 0;

      switch (key) {
        case 'q':
          slotPosition = 1;
          break;
        case 'w':
          slotPosition = 2;
          break;
        case 'e':
          slotPosition = 3;
          break;
        default:
          return;
      }

      event.preventDefault();
      handlePotionSlotUse(slotPosition);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [disabled, usingSlot, potionSlots]);

  const getSlotKeyBinding = (position: number) => {
    switch (position) {
      case 1: return 'Q';
      case 2: return 'W';
      case 3: return 'E';
      default: return '';
    }
  };

  const getSlotIcon = (slot: PotionSlot) => {
    if (slot.consumable_id) {
      return '🧪';
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-16 h-16 bg-card border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Keyboard className="h-4 w-4" />
        <span>Poções (Q, W, E)</span>
      </div>
      
      <div className="flex gap-2">
        {potionSlots.map((slot) => {
          const isUsing = usingSlot === slot.slot_position;
          const isEmpty = !slot.consumable_id;
          const keyBinding = getSlotKeyBinding(slot.slot_position);
          
          return (
            <div key={slot.slot_position} className="relative">
              <Button
                variant={isEmpty ? 'outline' : 'default'}
                size="sm"
                className={`w-16 h-16 p-1 relative ${
                  isEmpty 
                    ? 'border-dashed border-muted-foreground/30' 
                    : 'border-solid'
                } ${isUsing ? 'opacity-50' : ''}`}
                onClick={() => handlePotionSlotUse(slot.slot_position)}
                disabled={disabled || isEmpty || isUsing}
                title={slot.consumable_name || `Slot ${slot.slot_position} vazio`}
              >
                {isEmpty ? (
                  <Beaker className="h-6 w-6 text-muted-foreground/50" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-lg">
                      {getSlotIcon(slot)}
                    </div>
                    {slot.effect_value && (
                      <div className="text-xs font-bold">
                        +{slot.effect_value}
                      </div>
                    )}
                  </div>
                )}
                
                {isUsing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  </div>
                )}
              </Button>
              
              {/* Badge com tecla de atalho */}
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs font-bold flex items-center justify-center"
              >
                {keyBinding}
              </Badge>
              
              {/* Tooltip com informações da poção */}
              {!isEmpty && slot.consumable_name && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-popover text-popover-foreground text-xs p-2 rounded border shadow-md whitespace-nowrap">
                    <div className="font-medium">{slot.consumable_name}</div>
                    {slot.consumable_description && (
                      <div className="text-muted-foreground">{slot.consumable_description}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 