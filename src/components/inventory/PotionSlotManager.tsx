'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, PotionSlot } from '@/resources/game/slot.service';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';
import { toast } from 'sonner';
import { Beaker, Plus, X, Keyboard } from 'lucide-react';

interface PotionSlotManagerProps {
  characterId: string;
  consumables: CharacterConsumable[];
  onSlotsUpdate?: () => void;
}

export function PotionSlotManager({ characterId, consumables, onSlotsUpdate }: PotionSlotManagerProps) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

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

  const handleSetPotionSlot = async (slotPosition: number, consumableId: string) => {
    try {
      const response = await SlotService.setPotionSlot(characterId, slotPosition, consumableId);
      
      if (response.success) {
        await loadPotionSlots();
        onSlotsUpdate?.();
        toast.success('Poção atribuída ao slot!');
        setEditingSlot(null);
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

  const getSlotKeyBinding = (position: number) => {
    switch (position) {
      case 1: return 'Q';
      case 2: return 'W';
      case 3: return 'E';
      default: return '';
    }
  };

  const getAvailablePotions = () => {
    return consumables.filter(c => 
      c.consumable && 
      c.consumable.type === 'potion' && 
      c.quantity > 0
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Slots de Poção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-32"></div>
            <div className="flex gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-20 h-20 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5" />
          Slots de Poção
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure suas poções para acesso rápido na batalha
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Keyboard className="h-4 w-4" />
          <span>Atalhos: Q, W, E</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {potionSlots.map((slot) => {
            const keyBinding = getSlotKeyBinding(slot.slot_position);
            const isEmpty = !slot.consumable_id;
            const isEditing = editingSlot === slot.slot_position;
            
            return (
              <div key={slot.slot_position} className="space-y-2">
                {/* Slot visual */}
                <div className="relative">
                  <Button
                    variant={isEmpty ? 'outline' : 'default'}
                    className={`w-full h-20 p-2 relative ${
                      isEmpty 
                        ? 'border-dashed border-muted-foreground/30' 
                        : 'border-solid'
                    }`}
                    onClick={() => {
                      if (isEmpty) {
                        setEditingSlot(slot.slot_position);
                      }
                    }}
                  >
                    {isEmpty ? (
                      <div className="flex flex-col items-center gap-1">
                        <Plus className="h-6 w-6 text-muted-foreground/50" />
                        <span className="text-xs">Adicionar</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-lg">
                          🧪
                        </div>
                        <div className="text-xs font-medium truncate max-w-full">
                          {slot.consumable_name}
                        </div>
                        {slot.effect_value && (
                          <div className="text-xs font-bold">
                            +{slot.effect_value}
                          </div>
                        )}
                      </div>
                    )}
                  </Button>
                  
                  {/* Badge com tecla */}
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 text-xs font-bold flex items-center justify-center"
                  >
                    {keyBinding}
                  </Badge>
                  
                  {/* Botão de remover */}
                  {!isEmpty && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -left-2 h-6 w-6 p-0 rounded-full"
                      onClick={() => handleClearSlot(slot.slot_position)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {/* Seleção de poção */}
                {isEditing && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Escolha uma poção:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {getAvailablePotions().map((consumable) => (
                        <Button
                          key={consumable.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-auto p-2"
                          onClick={() => handleSetPotionSlot(slot.slot_position, consumable.consumable_id)}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>🧪</span>
                            <div className="flex-1 truncate">
                              <div className="truncate">{consumable.consumable!.name}</div>
                              <div className="text-muted-foreground">
                                +{consumable.consumable!.effect_value} • x{consumable.quantity}
                              </div>
                            </div>
                          </div>
                        </Button>
                      ))}
                      
                      {getAvailablePotions().length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          Nenhuma poção disponível
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSlot(null)}
                      className="w-full"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Informações sobre os slots */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
          <p>• Arraste poções para os slots ou clique para configurar</p>
          <p>• Use as teclas Q, W, E durante a batalha para usar rapidamente</p>
          <p>• Slots são esvaziados automaticamente quando a poção acaba</p>
        </div>
      </CardContent>
    </Card>
  );
} 