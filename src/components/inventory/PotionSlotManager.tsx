'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlotService, PotionSlot } from '@/resources/game/slot.service';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';
import { toast } from 'sonner';
import { Beaker, Plus, X, Keyboard, Heart, Zap } from 'lucide-react';

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

  const getPotionIcon = (slot: PotionSlot) => {
    if (!slot.consumable_description) return <Beaker className="h-8 w-8 text-slate-500" />;
    
    if (slot.consumable_description.includes('HP') || slot.consumable_description.includes('Vida')) {
      return <Heart className="h-8 w-8 text-red-400" />;
    }
    if (slot.consumable_description.includes('Mana')) {
      return <Zap className="h-8 w-8 text-blue-400" />;
    }
    return <Beaker className="h-8 w-8 text-purple-400" />;
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Keyboard className="h-4 w-4" />
            <span>Atalhos: Q, W, E</span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={`loading-slot-${i}`} className="w-full h-20 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Keyboard className="h-4 w-4" />
          <span>Atalhos: Q, W, E</span>
        </div>
        <div className="text-xs text-slate-500">
          Clique para configurar
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {potionSlots.map((slot) => {
          const keyBinding = getSlotKeyBinding(slot.slot_position);
          const isEmpty = !slot.consumable_id;
          const isEditing = editingSlot === slot.slot_position;
          
          return (
            <div key={`potion-slot-${slot.slot_position}`} className="relative">
              {/* Slot principal */}
              <div className="relative group">
                <Button
                  variant="outline"
                  className={`w-full h-20 p-3 border-2 transition-all duration-300 ${
                    isEmpty 
                      ? 'border-dashed border-slate-600 bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:border-slate-500 hover:from-slate-700/50 hover:to-slate-800/70' 
                      : 'border-solid border-blue-600 bg-gradient-to-br from-blue-900/30 to-blue-800/40 hover:brightness-110 shadow-lg shadow-blue-400/20'
                  } hover:scale-[1.02] active:scale-[0.98]`}
                  onClick={() => {
                    if (isEmpty) {
                      setEditingSlot(slot.slot_position);
                    }
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className={`p-2 rounded-lg ${isEmpty ? 'bg-slate-700/30' : 'bg-black/20'}`}>
                      {isEmpty ? (
                        <Plus className="h-8 w-8 text-slate-500" />
                      ) : (
                        getPotionIcon(slot)
                      )}
                    </div>
                    {!isEmpty && slot.effect_value && (
                      <div className="text-xs font-bold text-slate-200 bg-slate-800/50 px-2 py-1 rounded">
                        +{slot.effect_value}
                      </div>
                    )}
                    {isEmpty && (
                      <div className="text-xs text-slate-500 font-medium">Vazio</div>
                    )}
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
                    onClick={(e) => {
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
              
              {/* Modal de seleção de poção */}
              {isEditing && (
                <div className="absolute top-full left-0 z-20 mt-2 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl min-w-64">
                  <div className="text-sm font-medium text-slate-200 mb-3">
                    Escolha uma poção para o Slot {keyBinding}:
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {getAvailablePotions().map((consumable) => (
                      <Button
                        key={`consumable-${consumable.id}-slot-${slot.slot_position}`}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs h-auto p-2 hover:bg-blue-900/30 border-slate-600"
                        onClick={() => handleSetPotionSlot(slot.slot_position, consumable.consumable_id)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex-shrink-0">
                            {consumable.consumable!.description.includes('HP') ? (
                              <Heart className="h-4 w-4 text-red-400" />
                            ) : consumable.consumable!.description.includes('Mana') ? (
                              <Zap className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Beaker className="h-4 w-4 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-medium text-slate-200 truncate">
                              {consumable.consumable!.name}
                            </div>
                            <div className="text-slate-400 text-xs">
                              +{consumable.consumable!.effect_value} • x{consumable.quantity}
                            </div>
                          </div>
                        </div>
                      </Button>
                    ))}
                    
                    {getAvailablePotions().length === 0 && (
                      <div className="text-xs text-slate-400 text-center py-6">
                        <div className="flex flex-col items-center gap-2">
                          <Beaker className="h-8 w-8 text-slate-600" />
                          <span>Nenhuma poção disponível</span>
                          <span className="text-xs text-slate-500">Compre poções na loja</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSlot(null)}
                    className="w-full mt-3 text-slate-400 hover:text-slate-200"
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
      <div className="text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
        <div className="space-y-1">
          <p className="font-medium text-slate-400">Como usar:</p>
          <p>• Clique em slots vazios para adicionar poções</p>
          <p>• Use Q, W, E durante batalhas para consumir rapidamente</p>
          <p>• Slots são limpos automaticamente quando esgotam</p>
        </div>
      </div>
    </div>
  );
} 