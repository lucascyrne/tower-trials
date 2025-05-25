'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sword, 
  Shield, 
  ArrowLeft,
  Zap,
  Flame,
  Snowflake,
  Heart,
  Sparkles,
  Target,
  ShieldCheck,
  Activity,
  Plus
} from 'lucide-react';
import { ActionType, GamePlayer } from '@/resources/game/game-model';
import { PlayerSpell } from '@/resources/game/models/spell.model';
import { SlotService, PotionSlot } from '@/resources/game/slot.service';
import { toast } from 'sonner';

interface CombinedBattleInterfaceProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer;
  onPlayerStatsUpdate: (newHp: number, newMana: number) => void;
}

// Mapeamento de ícones para magias baseado no nome/tipo
const getSpellIcon = (spell: PlayerSpell) => {
  const name = spell.name.toLowerCase();
  const description = spell.description.toLowerCase();
  
  if (name.includes('bola de fogo') || name.includes('fireball') || description.includes('fogo')) {
    return <Flame className="h-4 w-4" />;
  }
  if (name.includes('raio de gelo') || name.includes('ice') || description.includes('gelo')) {
    return <Snowflake className="h-4 w-4" />;
  }
  if (name.includes('cura') || name.includes('heal') || description.includes('restaura')) {
    return <Heart className="h-4 w-4" />;
  }
  if (name.includes('raio') || name.includes('bolt') || description.includes('raio')) {
    return <Zap className="h-4 w-4" />;
  }
  if (name.includes('escudo') || name.includes('shield') || description.includes('defesa')) {
    return <ShieldCheck className="h-4 w-4" />;
  }
  if (name.includes('dano') || description.includes('damage') || description.includes('dano')) {
    return <Target className="h-4 w-4" />;
  }
  if (description.includes('overtime') || description.includes('tempo')) {
    return <Activity className="h-4 w-4" />;
  }
  
  return <Sparkles className="h-4 w-4" />;
};

export function CombinedBattleInterface({ 
  handleAction, 
  isPlayerTurn, 
  loading, 
  player, 
  onPlayerStatsUpdate 
}: CombinedBattleInterfaceProps) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [usingSlot, setUsingSlot] = useState<number | null>(null);

  const isDisabled = !isPlayerTurn || loading.performAction;

  const loadPotionSlots = async () => {
    try {
      const response = await SlotService.getCharacterPotionSlots(player.id);
      if (response.success && response.data) {
        setPotionSlots(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar slots de poção:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (player.id) {
      loadPotionSlots();
    }
  }, [player.id]);

  // Função para usar poção do slot
  const handlePotionSlotUse = async (slotPosition: number) => {
    if (isDisabled || usingSlot !== null) return;

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
      if (isDisabled || usingSlot !== null) return;

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
  }, [isDisabled, usingSlot, potionSlots]);

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
      if (slot.consumable_description?.toLowerCase().includes('mana')) {
        return '🔵';
      }
      return '🔴';
    }
    return null;
  };

  return (
    <Card className="border-0 bg-card/95">
      <CardContent className="p-6 space-y-6">
        {/* Seção de Poções Rápidas */}
        <div className="text-center space-y-4">
          <div className="text-base font-medium text-muted-foreground">
            Poções Rápidas
          </div>
          
          <div className="flex justify-center gap-4">
            {loadingSlots ? (
              [1, 2, 3].map(i => (
                <div key={i} className="w-16 h-20 bg-muted rounded-lg animate-pulse" />
              ))
            ) : (
              potionSlots.map((slot) => {
                const isUsing = usingSlot === slot.slot_position;
                const isEmpty = !slot.consumable_id;
                const keyBinding = getSlotKeyBinding(slot.slot_position);
                
                return (
                  <div key={slot.slot_position} className="relative flex flex-col items-center">
                    <Button
                      variant={isEmpty ? 'outline' : 'default'}
                      className={`h-16 w-16 rounded-xl p-2 relative flex flex-col items-center gap-1 ${
                        isEmpty 
                          ? 'border-dashed border-muted-foreground/30 bg-transparent hover:bg-muted/20' 
                          : 'bg-green-600 hover:bg-green-700 border-2 border-green-500'
                      } ${isUsing ? 'opacity-50' : ''}`}
                      onClick={() => handlePotionSlotUse(slot.slot_position)}
                      disabled={isDisabled || isEmpty || isUsing}
                      title={slot.consumable_name ? `${slot.consumable_name} (+${slot.effect_value})` : `Slot ${keyBinding} vazio`}
                    >
                      {isEmpty ? (
                        <>
                          <Plus className="h-5 w-5 text-muted-foreground/50" />
                          <span className="text-xs text-muted-foreground/70">Vazio</span>
                        </>
                      ) : (
                        <>
                          <div className="text-xl">
                            {getPotionIcon(slot)}
                          </div>
                          {slot.effect_value && (
                            <div className="text-xs font-bold text-white bg-black/20 px-1 rounded">
                              +{slot.effect_value}
                            </div>
                          )}
                        </>
                      )}
                      
                      {isUsing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </Button>
                    
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs font-bold flex items-center justify-center"
                    >
                      {keyBinding}
                    </Badge>
                    
                    <div className="mt-1 text-center min-h-[1.5rem] flex items-center">
                      {!isEmpty && slot.consumable_name ? (
                        <div className="text-xs font-medium text-foreground max-w-16 leading-tight truncate">
                          {slot.consumable_name}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {keyBinding}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            Configure no Inventário • Teclas Q, W, E
          </div>
        </div>

        {/* Divisor */}
        <div className="border-t border-border"></div>

        {/* Seção de Ações Básicas */}
        <div className="text-center space-y-4">
          <div className="text-base font-medium text-muted-foreground">
            Ações de Batalha
          </div>
          
          <div className="flex justify-center gap-4">
            <div className="relative">
              <Button
                onClick={() => handleAction('attack')}
                disabled={isDisabled}
                size="lg"
                className="h-16 w-16 rounded-full p-0 bg-red-600 hover:bg-red-700 border-2 border-red-500"
                title="Atacar"
              >
                <Sword className="h-6 w-6" />
              </Button>
              <Badge variant="secondary" className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs">
                Atacar
              </Badge>
            </div>

            <div className="relative">
              <Button
                onClick={() => handleAction('defend')}
                disabled={isDisabled || player.defenseCooldown > 0}
                size="lg"
                className={`h-16 w-16 rounded-full p-0 relative ${
                  player.isDefending 
                    ? 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-500' 
                    : 'bg-gray-600 hover:bg-gray-700 border-2 border-gray-500'
                }`}
                title={player.isDefending ? "Defendendo" : "Defender"}
              >
                <Shield className="h-6 w-6" />
                {player.defenseCooldown > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {player.defenseCooldown}
                  </div>
                )}
              </Button>
              <Badge variant="secondary" className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs">
                Defender
              </Badge>
            </div>

            <div className="relative">
              <Button
                onClick={() => handleAction('flee')}
                disabled={isDisabled}
                size="lg"
                className="h-16 w-16 rounded-full p-0 bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500"
                title="Fugir"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <Badge variant="secondary" className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 text-xs">
                Fugir
              </Badge>
            </div>
          </div>
        </div>

        {/* Seção de Magias */}
        {player.spells.length > 0 && (
          <>
            <div className="border-t border-border"></div>
            
            <div className="text-center space-y-4">
              <div className="text-base font-medium text-muted-foreground">
                Magias
              </div>
              
              <div className="flex flex-wrap justify-center gap-3">
                {player.spells.map((spell) => {
                  const canCast = player.mana >= spell.mana_cost && spell.current_cooldown === 0;
                  const spellIcon = getSpellIcon(spell);
                  
                  return (
                    <div key={spell.id} className="relative">
                      <Button
                        onClick={() => handleAction('spell', spell.id)}
                        disabled={isDisabled || !canCast}
                        size="lg"
                        className={`h-14 w-14 rounded-full p-0 relative ${
                          canCast
                            ? 'bg-purple-600 hover:bg-purple-700 border-2 border-purple-500'
                            : 'bg-gray-400 cursor-not-allowed border-2 border-gray-300'
                        }`}
                        title={`${spell.name} (${spell.mana_cost} mana)`}
                      >
                        {spellIcon}
                        
                        {/* Cooldown indicator */}
                        {spell.current_cooldown > 0 && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {spell.current_cooldown}
                          </div>
                        )}
                        
                        {/* Mana cost indicator */}
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {spell.mana_cost}
                        </div>
                      </Button>
                      
                      <Badge 
                        variant="secondary" 
                        className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-xs max-w-16 truncate"
                        title={spell.name}
                      >
                        {spell.name.split(' ')[0]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 