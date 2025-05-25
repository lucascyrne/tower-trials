'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Droplet,
  Droplets
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

interface TooltipInfo {
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  position: { x: number; y: number };
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
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      toast.warning(`Slot ${getPotionKeyBinding(slotPosition)} está vazio`);
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

      // Ações de combate
      switch (key) {
        case 'a':
          event.preventDefault();
          handleAction('attack');
          return;
        case 's':
          if (player.defenseCooldown === 0) {
            event.preventDefault();
            handleAction('defend');
          }
          return;
        case 'd':
          event.preventDefault();
          handleAction('flee');
          return;
      }

      // Poções
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
          // Magias (1, 2, 3)
          const spellIndex = parseInt(key) - 1;
          if (spellIndex >= 0 && spellIndex < Math.min(3, player.spells.length)) {
            const spell = player.spells[spellIndex];
            if (player.mana >= spell.mana_cost && spell.current_cooldown === 0) {
              event.preventDefault();
              handleAction('spell', spell.id);
            }
          }
          return;
      }

      if (slotPosition > 0) {
      event.preventDefault();
      handlePotionSlotUse(slotPosition);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isDisabled, usingSlot, potionSlots, player.spells, player.mana, player.defenseCooldown]);

  const getPotionKeyBinding = (position: number) => {
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
        return <Droplet className="h-5 w-5 text-blue-500" />;
      }
      return <Droplets className="h-5 w-5 text-red-500" />;
    }
    return null;
  };

  // Função para mostrar tooltip detalhado
  const showTooltip = (info: Omit<TooltipInfo, 'position'>, position: { x: number; y: number }) => {
    setTooltip({
      ...info,
      position
    });
  };

  // Função para esconder tooltip
  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
    }, 150); // Pequeno delay para evitar flicker
  };

  // Handlers para desktop (mouse)
  const handleMouseDown = (info: Omit<TooltipInfo, 'position'>, event: React.MouseEvent) => {
    // Capturar coordenadas antes do setTimeout
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
    
    const timer = setTimeout(() => {
      showTooltip(info, position);
    }, 500); // 500ms para mostrar tooltip
    setPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleMouseLeave = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    hideTooltip();
  };

  // Handlers para mobile (touch)
  const handleTouchStart = (info: Omit<TooltipInfo, 'position'>, event: React.TouchEvent) => {
    event.preventDefault();
    
    // Capturar coordenadas antes do setTimeout
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
    
    const timer = setTimeout(() => {
      showTooltip(info, position);
    }, 500);
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  // Limitar magias a 3 para UI mais enxuta
  const displaySpells = player.spells.slice(0, 3);

  return (
    <>
      <Card className="border-0 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-3 md:p-3 space-y-3 md:space-y-2">
          {/* Primeira linha: Ações de Combate (esquerda) + Poções (direita) */}
          <div className="flex flex-col md:flex-row md:justify-center md:items-start gap-3 md:gap-4">
            {/* Ações de Combate - Esquerda */}
            <div className="flex-1 md:max-w-xs md:flex-none">
              <div className="text-xs font-medium text-muted-foreground/80 mb-2 text-center md:text-left">
                Ações de Combate
              </div>
              <div className="flex justify-center md:justify-start gap-2">
                <div className="relative">
                  <Button
                    onClick={() => handleAction('attack')}
                    onMouseDown={(e) => handleMouseDown({
                      title: 'Atacar',
                      description: 'Realiza um ataque físico contra o inimigo usando sua arma equipada',
                      stats: [
                        { label: 'Dano base', value: `${player.atk}` },
                        { label: 'Tipo', value: 'Físico' },
                        { label: 'Tecla', value: 'A' }
                      ]
                    }, e)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart({
                      title: 'Atacar',
                      description: 'Realiza um ataque físico contra o inimigo usando sua arma equipada',
                      stats: [
                        { label: 'Dano base', value: `${player.atk}` },
                        { label: 'Tipo', value: 'Físico' }
                      ]
                    }, e)}
                    onTouchEnd={handleTouchEnd}
                    disabled={isDisabled}
                    variant="ghost"
                    size="lg"
                    className="h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 shadow-lg shadow-red-500/10 transition-all duration-200"
                  >
                    <Sword className="h-4 w-4 md:h-5 md:w-5 text-red-500/80" />
                  </Button>
                  <Badge 
                    variant="outline" 
                    className="absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30 hidden md:flex"
                  >
                    A
                  </Badge>
                </div>

                <div className="relative">
                  <Button
                    onClick={() => handleAction('defend')}
                    onMouseDown={(e) => handleMouseDown({
                      title: player.isDefending ? 'Defendendo' : 'Defender',
                      description: player.isDefending 
                        ? 'Você está em posição defensiva, reduzindo o dano recebido' 
                        : 'Adota uma postura defensiva, reduzindo o dano do próximo ataque',
                      stats: [
                        { label: 'Redução de dano', value: '85%' },
                        { label: 'Cooldown', value: player.defenseCooldown > 0 ? `${player.defenseCooldown} turnos` : 'Disponível' },
                        { label: 'Tecla', value: 'S' }
                      ]
                    }, e)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart({
                      title: player.isDefending ? 'Defendendo' : 'Defender',
                      description: player.isDefending 
                        ? 'Você está em posição defensiva, reduzindo o dano recebido' 
                        : 'Adota uma postura defensiva, reduzindo o dano do próximo ataque',
                      stats: [
                        { label: 'Redução de dano', value: '85%' },
                        { label: 'Cooldown', value: player.defenseCooldown > 0 ? `${player.defenseCooldown} turnos` : 'Disponível' }
                      ]
                    }, e)}
                    onTouchEnd={handleTouchEnd}
                    disabled={isDisabled || player.defenseCooldown > 0}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 relative border-2 transition-all duration-200 ${
                      player.isDefending 
                        ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                        : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 shadow-lg shadow-blue-500/10'
                    }`}
                  >
                    <Shield className="h-4 w-4 md:h-5 md:w-5 text-blue-500/80" />
                    {player.defenseCooldown > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500/90 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                        {player.defenseCooldown}
                      </div>
                    )}
                  </Button>
                  <Badge 
                    variant="outline" 
                    className="absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30 hidden md:flex"
                    style={{ display: player.defenseCooldown > 0 ? 'none' : 'flex' }}
                  >
                    S
                  </Badge>
                </div>

                <div className="relative">
                  <Button
                    onClick={() => handleAction('flee')}
                    onMouseDown={(e) => handleMouseDown({
                      title: 'Fugir',
                      description: 'Tenta escapar da batalha. Nem sempre funciona contra inimigos mais fortes',
                      stats: [
                        { label: 'Chance base', value: '70%' },
                        { label: 'Penalidade', value: 'Possível dano' },
                        { label: 'Tecla', value: 'D' }
                      ]
                    }, e)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart({
                      title: 'Fugir',
                      description: 'Tenta escapar da batalha. Nem sempre funciona contra inimigos mais fortes',
                      stats: [
                        { label: 'Chance base', value: '70%' },
                        { label: 'Penalidade', value: 'Possível dano' }
                      ]
                    }, e)}
                    onTouchEnd={handleTouchEnd}
                    disabled={isDisabled}
                    variant="ghost"
                    size="lg"
                    className="h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 shadow-lg shadow-amber-500/10 transition-all duration-200"
                  >
                    <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-amber-500/80" />
                  </Button>
                  <Badge 
                    variant="outline" 
                    className="absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30 hidden md:flex"
                  >
                    D
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Poções - Direita */}
            <div className="flex-1 md:max-w-xs md:flex-none">
              <div className="text-xs font-medium text-muted-foreground/80 mb-2 text-center md:text-right">
                Poções Rápidas
              </div>
              <div className="flex justify-center md:justify-end gap-2">
              {loadingSlots ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="w-12 h-12 md:w-14 md:h-14 bg-muted/20 rounded-xl animate-pulse" />
                ))
              ) : (
                potionSlots.map((slot) => {
                  const isUsing = usingSlot === slot.slot_position;
                  const isEmpty = !slot.consumable_id;
                    const keyBinding = getPotionKeyBinding(slot.slot_position);
                  
                  const tooltipInfo = {
                    title: slot.consumable_name || `Slot ${keyBinding}`,
                    description: isEmpty ? 'Slot vazio - Configure no inventário' : slot.consumable_description || 'Poção',
                    stats: isEmpty ? [] : [
                      { label: 'Efeito', value: `+${slot.effect_value}` },
                      { label: 'Tecla', value: keyBinding }
                    ]
                  };
                  
                  return (
                    <div key={slot.slot_position} className="relative">
                      <Button
                        variant="ghost"
                        className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-2 relative border-2 transition-all duration-200 ${
                          isEmpty 
                            ? 'border-dashed border-muted-foreground/20 bg-transparent hover:bg-muted/10 hover:border-muted-foreground/30' 
                            : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                        } ${isUsing ? 'opacity-50' : ''}`}
                        onClick={() => handlePotionSlotUse(slot.slot_position)}
                        onMouseDown={(e) => handleMouseDown(tooltipInfo, e)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={(e) => handleTouchStart(tooltipInfo, e)}
                        onTouchEnd={handleTouchEnd}
                        disabled={isDisabled || isEmpty || isUsing}
                      >
                        {isEmpty ? (
                          <Plus className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/40" />
                        ) : (
                          <div className="flex items-center justify-center">
                            {getPotionIcon(slot)}
                          </div>
                        )}
                        
                        {isUsing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                            <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                      </Button>
                      
                      <Badge 
                        variant="outline" 
                        className="absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30"
                      >
                        {keyBinding}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
            </div>
          </div>

          {/* Segunda linha: Magias (apenas se houver magias) */}
          {displaySpells.length > 0 && (
            <>
              <div className="border-t border-border/50 pt-2">
                <div className="text-xs font-medium text-muted-foreground/80 mb-2 text-center">
                  Magias
                </div>
                
                <div className="flex justify-center gap-2 md:max-w-md md:mx-auto">
                  {displaySpells.map((spell, index) => {
                    const canCast = player.mana >= spell.mana_cost && spell.current_cooldown === 0;
                    const spellIcon = getSpellIcon(spell);
                    const keyBinding = (index + 1).toString();
                    
                    const tooltipInfo = {
                      title: spell.name,
                      description: spell.description,
                      stats: [
                        { label: 'Custo de Mana', value: `${spell.mana_cost}` },
                        { label: 'Cooldown', value: spell.current_cooldown > 0 ? `${spell.current_cooldown} turnos` : 'Disponível' },
                        { label: 'Dano/Efeito', value: `${spell.effect_value}` },
                        { label: 'Tecla', value: keyBinding }
                      ]
                    };
                    
                    return (
                      <div key={spell.id} className="relative">
                        <Button
                          onClick={() => handleAction('spell', spell.id)}
                          onMouseDown={(e) => handleMouseDown(tooltipInfo, e)}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={(e) => handleTouchStart(tooltipInfo, e)}
                          onTouchEnd={handleTouchEnd}
                          disabled={isDisabled || !canCast}
                          variant="ghost"
                          size="lg"
                          className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 relative border-2 transition-all duration-200 ${
                            canCast
                              ? 'border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 shadow-lg shadow-violet-500/10'
                              : 'border-muted-foreground/10 bg-muted/5 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className={canCast ? 'text-violet-500/80' : 'text-muted-foreground/50'}>
                            {spellIcon}
                          </div>
                          
                          {/* Cooldown indicator */}
                          {spell.current_cooldown > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500/90 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                              {spell.current_cooldown}
                            </div>
                          )}
                          
                          {/* Mana cost indicator */}
                          <div className={`absolute -bottom-1 -right-1 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background ${
                            canCast ? 'bg-blue-500/90' : 'bg-muted-foreground/70'
                          }`}>
                            {spell.mana_cost}
                          </div>
                        </Button>
                        
                        <Badge 
                          variant="outline" 
                          className="absolute -top-1 -left-1 md:-top-2 md:-left-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30 hidden md:flex"
                        >
                          {keyBinding}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                </div>
              </>
            )}

          {/* Dica de atalhos apenas no desktop */}
          <div className="hidden md:block text-center">
            <div className="text-xs text-muted-foreground/60">
              Atalhos: A/S/D (Combate) • Q/W/E (Poções) • 1/2/3 (Magias)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tooltip Modal */}
      {tooltip && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.position.x,
            top: tooltip.position.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-xl max-w-xs">
            <h4 className="font-medium text-sm mb-1">{tooltip.title}</h4>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{tooltip.description}</p>
            {tooltip.stats.length > 0 && (
              <div className="space-y-1">
                {tooltip.stats.map((stat, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{stat.label}:</span>
                    <span className="font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
} 