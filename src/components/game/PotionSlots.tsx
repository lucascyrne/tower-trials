'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, PotionSlot } from '@/resources/game/slot.service';
import { GamePlayer } from '@/resources/game/game-model';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

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
      toast.warning(`Slot ${getSlotKeyBinding(slotPosition)} está vazio`);
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

      // Verificar se o usuário está digitando em um input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

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

  const getPotionIcon = (slot: PotionSlot) => {
    if (slot.consumable_id) {
      // Usar ícone baseado no tipo de poção
      if (slot.consumable_description?.toLowerCase().includes('mana')) {
        return '🔵'; // Poção de mana
      }
      return '🔴'; // Poção de HP
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-12 h-12 bg-card border rounded-full animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-muted-foreground text-center">
        Poções Rápidas
      </div>
      
      <div className="flex justify-center gap-3">
        {potionSlots.map((slot) => {
          const isUsing = usingSlot === slot.slot_position;
          const isEmpty = !slot.consumable_id;
          const keyBinding = getSlotKeyBinding(slot.slot_position);
          
          return (
            <div key={slot.slot_position} className="relative">
              <Button
                variant={isEmpty ? 'outline' : 'default'}
                size="lg"
                className={`h-12 w-12 rounded-full p-0 relative ${
                  isEmpty 
                    ? 'border-dashed border-muted-foreground/30 bg-transparent hover:bg-muted/20' 
                    : 'bg-green-600 hover:bg-green-700 border-2 border-green-500'
                } ${isUsing ? 'opacity-50' : ''}`}
                onClick={() => handlePotionSlotUse(slot.slot_position)}
                disabled={disabled || isEmpty || isUsing}
                title={slot.consumable_name ? `${slot.consumable_name} (+${slot.effect_value})` : `Slot ${keyBinding} vazio`}
              >
                {isEmpty ? (
                  <Plus className="h-4 w-4 text-muted-foreground/50" />
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-lg">
                      {getPotionIcon(slot)}
                    </div>
                  </div>
                )}
                
                {isUsing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
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
              
              {/* Efeito visual quando vazio */}
              {isEmpty && (
                <Badge 
                  variant="outline" 
                  className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs bg-background/80"
                >
                  Vazio
                </Badge>
              )}
              
              {/* Valor do efeito quando não vazio */}
              {!isEmpty && slot.effect_value && (
                <Badge 
                  variant="secondary" 
                  className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs bg-green-100 text-green-800 border-green-300"
                >
                  +{slot.effect_value}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Instruções */}
      <div className="text-xs text-muted-foreground text-center mt-1">
        Configure no Inventário • Teclas Q, W, E
      </div>
    </div>
  );
} 