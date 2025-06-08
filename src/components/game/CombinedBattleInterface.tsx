import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sword, 
  Shield, 
  ArrowLeft,
  ArrowRight,
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
  Droplets,
  Star
} from 'lucide-react';
import { type ActionType, type GamePlayer } from '@/resources/game/game-model';
import { type PlayerSpell } from '@/resources/game/models/spell.model';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { SlotService, type PotionSlot } from '@/resources/game/slot.service';
import { GameContext } from '@/resources/game/game-context';
import { toast } from 'sonner';

interface CombinedBattleInterfaceProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer;
  onPlayerStatsUpdate: (newHp: number, newMana: number) => void;
  onPlayerConsumablesUpdate: (consumables: CharacterConsumable[]) => void;
  currentEnemy?: { hp: number; maxHp: number; name: string } | null;
  battleRewards?: { xp: number; gold: number; drops: { name: string; quantity: number }[]; leveledUp: boolean; newLevel?: number } | null;
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
  onPlayerStatsUpdate,
  onPlayerConsumablesUpdate,
  currentEnemy,
  battleRewards
}: CombinedBattleInterfaceProps) {
  const { performAction } = useContext(GameContext);
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [usingSlot, setUsingSlot] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [usedPotionAnimation, setUsedPotionAnimation] = useState<number | null>(null);
  
  // OTIMIZADO: Controle para evitar múltiplos cliques e execuções duplicadas
  const [continuingAdventure, setContinuingAdventure] = useState(false);
  const actionProcessingRef = useRef<boolean>(false);
  const lastActionTimestampRef = useRef<number>(0);
  const ACTION_COOLDOWN_MS = 300; // 300ms entre ações
  
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Função para avançar para o próximo andar
  const handleContinueAdventure = useCallback(async () => {
    if (continuingAdventure || !battleRewards) return;
    
    console.log('[CombinedBattleInterface] === BOTÃO FALLBACK ACIONADO ===');
    console.log('[CombinedBattleInterface] Avançando para próximo andar via fallback...');
    
    setContinuingAdventure(true);
    
    try {
      // Usar a ação 'continue' do contexto do jogo
      performAction('continue');
      
      toast.success('Avançando para o próximo andar!', {
        description: 'Preparando nova batalha...',
        duration: 2000
      });
    } catch (error) {
      console.error('[CombinedBattleInterface] Erro ao avançar:', error);
      toast.error('Erro ao avançar para o próximo andar');
      setContinuingAdventure(false);
    }
  }, [continuingAdventure, battleRewards, performAction]);

  const isDisabled = !isPlayerTurn || loading.performAction;
  
  const potionUsedThisTurn = player.potionUsedThisTurn || false;
  
  // CRÍTICO: Verificar se o personagem está morto
  const isPlayerDead = player.hp <= 0;
  
  // DEBUG: Log detalhado do estado do turno
  useEffect(() => {
    console.log(`[CombinedBattleInterface] === ESTADO DETALHADO DO TURNO ===`);
    console.log(`[CombinedBattleInterface] isPlayerTurn: ${isPlayerTurn}`);
    console.log(`[CombinedBattleInterface] loading.performAction: ${loading.performAction}`);
    console.log(`[CombinedBattleInterface] isDisabled: ${isDisabled}`);
    console.log(`[CombinedBattleInterface] currentEnemy:`, currentEnemy ? {
      name: currentEnemy.name,
      hp: currentEnemy.hp,
      maxHp: currentEnemy.maxHp,
      isAlive: currentEnemy.hp > 0
    } : 'null');
    console.log(`[CombinedBattleInterface] battleRewards:`, battleRewards ? {
      xp: battleRewards.xp,
      gold: battleRewards.gold,
      leveledUp: battleRewards.leveledUp
    } : 'null');
    console.log(`[CombinedBattleInterface] === FIM DO LOG DETALHADO ===`);
    
    // CRÍTICO: Detectar situações problemáticas
    if (currentEnemy && currentEnemy.hp > 0 && !isPlayerTurn && !loading.performAction && !battleRewards) {
      console.warn(`[CombinedBattleInterface] ⚠️  POSSÍVEL PROBLEMA: Turno travado no inimigo`);
      console.warn(`[CombinedBattleInterface] - Inimigo vivo: ${currentEnemy.name} (${currentEnemy.hp}/${currentEnemy.maxHp})`);
      console.warn(`[CombinedBattleInterface] - Não é turno do jogador`);
      console.warn(`[CombinedBattleInterface] - Não está carregando`);
      console.warn(`[CombinedBattleInterface] - Sem recompensas de batalha`);
    }
  }, [isPlayerTurn, loading.performAction, isDisabled, currentEnemy?.name, currentEnemy?.hp, battleRewards]);
  
  // CORRIGIDO: Verificação mais rigorosa para mostrar botão de próximo andar
  const shouldShowNextFloorButton = Boolean(
    battleRewards && 
    !loading.performAction && 
    !isPlayerDead &&
    !continuingAdventure &&
    (!currentEnemy || currentEnemy.hp <= 0) // Mostrar se não há inimigo ou se está morto
  );
  
  // CRÍTICO: Fuga deve ser permitida sempre, exceto quando morto ou processando
  const isFleeDisabled = loading.performAction || isPlayerDead;
  
  // DEBUG: Log detalhado das condições do botão
  useEffect(() => {
    console.log(`[CombinedBattleInterface] === CONDIÇÕES DO BOTÃO FALLBACK ===`);
    console.log(`[CombinedBattleInterface] shouldShowNextFloorButton: ${shouldShowNextFloorButton}`);
    console.log(`[CombinedBattleInterface] - battleRewards:`, battleRewards ? {
      xp: battleRewards.xp,
      gold: battleRewards.gold,
      leveledUp: battleRewards.leveledUp,
      dropsCount: battleRewards.drops?.length || 0
    } : 'null/undefined');
    console.log(`[CombinedBattleInterface] - loading.performAction: ${loading.performAction}`);
    console.log(`[CombinedBattleInterface] - isPlayerDead: ${isPlayerDead}`);
    console.log(`[CombinedBattleInterface] - continuingAdventure: ${continuingAdventure}`);
    console.log(`[CombinedBattleInterface] - currentEnemy:`, currentEnemy ? {
      name: currentEnemy.name,
      hp: currentEnemy.hp,
      maxHp: currentEnemy.maxHp,
      isDead: currentEnemy.hp <= 0
    } : 'null/undefined');
    console.log(`[CombinedBattleInterface] === FIM DAS CONDIÇÕES ===`);
  }, [shouldShowNextFloorButton, battleRewards, loading.performAction, isPlayerDead, continuingAdventure, currentEnemy?.hp]);

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

  // CRÍTICO: Recarregar slots quando consumáveis mudam
  useEffect(() => {
    if (player.id && player.consumables) {
      console.log('[CombinedBattleInterface] Consumáveis mudaram, recarregando slots');
      loadPotionSlots();
    }
  }, [player.consumables]);

  // Função para usar poção do slot
  const handlePotionSlotUse = async (slotPosition: number) => {
    // CRÍTICO: Bloquear uso de poções se personagem está morto
    if (isPlayerDead || isDisabled || usingSlot !== null) return;

    const slot = potionSlots.find(s => s.slot_position === slotPosition);
    if (!slot?.consumable_id) {
      toast.warning(`Slot ${getPotionKeyBinding(slotPosition)} está vazio`);
      return;
    }

    // Verificar se já foi usada uma poção neste turno
    if (potionUsedThisTurn) {
      toast.error('Você já usou uma poção neste turno!', {
        description: 'Você só pode usar uma poção por turno',
        duration: 3000
      });
      return;
    }

    // Verificar se há quantidade disponível no inventário
    const consumableInInventory = player.consumables?.find(
      c => c.consumable_id === slot.consumable_id
    );
    
    if (!consumableInInventory || consumableInInventory.quantity <= 0) {
      toast.error('Poção não disponível!', {
        description: 'Você não possui esta poção no inventário',
        duration: 3000
      });
      return;
    }

    setUsingSlot(slotPosition);

    try {
      console.log(`[CombinedBattleInterface] Usando poção do slot ${slotPosition}`);
      
      const response = await SlotService.consumePotionFromSlot(player.id, slotPosition);
      
      if (response.success && response.data) {
        const { message, new_hp, new_mana } = response.data;
        
        console.log(`[CombinedBattleInterface] Poção usada com sucesso: HP ${new_hp}, Mana ${new_mana}`);
        
        // Atualizar stats do jogador IMEDIATAMENTE
        onPlayerStatsUpdate(new_hp, new_mana);
        
        // Marcar que uma poção foi usada neste turno
        player.potionUsedThisTurn = true;
        
        // CRÍTICO: Atualizar quantidade no inventário local imediatamente
        if (player.consumables && consumableInInventory) {
          const updatedConsumables = player.consumables.map(c => {
            if (c.consumable_id === slot.consumable_id) {
              return {
                ...c,
                quantity: Math.max(0, c.quantity - 1)
              };
            }
            return c;
          }).filter(c => c.quantity > 0); // Remover itens com quantidade 0
          
          // CRÍTICO: Usar função do contexto para atualizar consumáveis
          console.log(`[CombinedBattleInterface] Atualizando consumáveis via contexto:`, updatedConsumables.length);
          onPlayerConsumablesUpdate(updatedConsumables);
        }
        
        // Ativar animação de uso de poção
        setUsedPotionAnimation(slotPosition);
        setTimeout(() => setUsedPotionAnimation(null), 2000);
        
        // Recarregar slots para refletir mudanças
        await loadPotionSlots();
        
        toast.success(message, {
          description: `HP: ${new_hp} | Mana: ${new_mana}`,
          duration: 4000
        });
      } else {
        console.error('[CombinedBattleInterface] Erro ao usar poção:', response.error);
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
      // CRÍTICO: Bloquear atalhos se personagem está morto
      if (isPlayerDead || usingSlot !== null) return;

      // Verificar se o usuário está digitando em um input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const key = event.key.toLowerCase();

      // Ações de combate
      switch (key) {
        case 'a':
          // Atacar requer turno do jogador
          if (isDisabled) return;
          event.preventDefault();
          handleAction('attack');
          return;
        case 's':
          // Defender requer turno do jogador
          if (isDisabled || player.defenseCooldown > 0) return;
          event.preventDefault();
          handleAction('defend');
          return;
        case 'd':
          // CRÍTICO: Fuga pode ser usada a qualquer momento (exceto quando morto/processando)
          if (isFleeDisabled) return;
          event.preventDefault();
          executeAction('flee');
          return;
      }

      // Verificar se outras ações requerem turno do jogador
      if (isDisabled) return;

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
        default: {
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
      }

      if (slotPosition > 0) {
        event.preventDefault();
        handlePotionSlotUse(slotPosition);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isDisabled, isFleeDisabled, usingSlot, potionSlots, player.spells, player.mana, player.defenseCooldown, potionUsedThisTurn, isPlayerDead]);

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

  // Função para verificar se uma ação pode ser executada
  const canPerformAction = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimestampRef.current;
    
    if (actionProcessingRef.current) {
      console.warn('[CombinedBattleInterface] Ação bloqueada - já processando');
      return false;
    }
    
    if (timeSinceLastAction < ACTION_COOLDOWN_MS) {
      console.warn(`[CombinedBattleInterface] Ação bloqueada - cooldown (${timeSinceLastAction}ms < ${ACTION_COOLDOWN_MS}ms)`);
      return false;
    }
    
    return true;
  }, []);

  // Função para executar ação com proteção
  const executeAction = useCallback(async (action: ActionType, spellId?: string) => {
    if (!canPerformAction()) return;
    
    actionProcessingRef.current = true;
    lastActionTimestampRef.current = Date.now();
    
    try {
      await handleAction(action, spellId);
    } finally {
      // Limpar flag após um delay para permitir próxima ação
      setTimeout(() => {
        actionProcessingRef.current = false;
      }, ACTION_COOLDOWN_MS);
    }
  }, []);

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
      {/* CRÍTICO: Overlay bloqueando interface se personagem morto */}
      {isPlayerDead && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
          <div className="text-center space-y-3">
            <div className="text-red-400 text-2xl animate-pulse">💀</div>
            <div className="text-red-400 font-bold text-lg">Personagem Morto</div>
            <div className="text-muted-foreground text-sm">Interface bloqueada</div>
          </div>
        </div>
      )}
      
      <Card className="border-0 bg-card/50 backdrop-blur-sm relative">
        <CardContent className="p-3 md:p-3 space-y-3 md:space-y-2">
          
          {/* CORRIGIDO: Botão de Fallback para Avançar - Aparece quando inimigo está morto */}
          {shouldShowNextFloorButton && !isPlayerDead && (
            <div className="mb-4 p-4 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 rounded-xl animate-in slide-in-from-top-2 duration-500">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="text-lg">⚔️</div>
                  <div className="text-sm text-green-400 font-medium">
                    Inimigo derrotado - Pronto para avançar
                  </div>
                  <div className="text-lg">⚔️</div>
                </div>
                
                {/* Recompensas em destaque */}
                <div className="bg-background/30 rounded-lg p-3 border border-green-500/10">
                  <div className="text-xs text-green-300 font-medium mb-1">Recompensas Obtidas:</div>
                  <div className="flex justify-center items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-blue-400" />
                      <span className="text-blue-400 font-semibold">+{battleRewards?.xp} XP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-lg">💰</span>
                      <span className="text-yellow-400 font-semibold">+{battleRewards?.gold} Gold</span>
                    </div>
                    {battleRewards?.drops && battleRewards.drops.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-purple-400 text-lg">📦</span>
                        <span className="text-purple-400 font-semibold">
                          +{battleRewards.drops.length} item{battleRewards.drops.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  {battleRewards?.leveledUp && (
                    <div className="mt-2 text-center">
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse">
                        🎊 LEVEL UP! Nível {battleRewards.newLevel}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={handleContinueAdventure}
                  disabled={loading.performAction || isPlayerDead || continuingAdventure}
                  size="lg"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all duration-200 transform hover:scale-105 w-full md:w-auto"
                >
                  {loading.performAction || continuingAdventure ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Avançando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Continuar Aventura
                    </>
                  )}
                </Button>
                
                <div className="text-xs text-muted-foreground">
                  Continue para o próximo andar da torre
                </div>
              </div>
            </div>
          )}

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
                    onClick={() => executeAction('attack')}
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
                    disabled={isDisabled || shouldShowNextFloorButton || isPlayerDead}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 shadow-lg shadow-red-500/10 transition-all duration-200 ${
                      isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
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
                    onClick={() => executeAction('defend')}
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
                    disabled={isDisabled || player.defenseCooldown > 0 || shouldShowNextFloorButton || isPlayerDead}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 relative border-2 transition-all duration-200 ${
                      player.isDefending 
                        ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                        : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 shadow-lg shadow-blue-500/10'
                    } ${isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''}`}
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
                    onClick={() => executeAction('flee')}
                    onMouseDown={(e) => handleMouseDown({
                      title: 'Fugir',
                      description: 'Tenta escapar da batalha baseado na sua velocidade vs velocidade do inimigo',
                      stats: [
                        { label: 'Chance base', value: '70% + mod. velocidade' },
                        { label: 'Falha', value: 'Toma dano e perde turno' },
                        { label: 'Sucesso', value: 'Volta ao hub (andar 1)' },
                        { label: 'Tecla', value: 'D' }
                      ]
                    }, e)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart({
                      title: 'Fugir',
                      description: 'Tenta escapar da batalha baseado na sua velocidade vs velocidade do inimigo',
                      stats: [
                        { label: 'Chance base', value: '70% + mod. velocidade' },
                        { label: 'Falha', value: 'Toma dano e perde turno' },
                        { label: 'Sucesso', value: 'Volta ao hub (andar 1)' }
                      ]
                    }, e)}
                    onTouchEnd={handleTouchEnd}
                    disabled={isFleeDisabled}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 shadow-lg shadow-amber-500/10 transition-all duration-200 ${
                      isPlayerDead ? 'opacity-30 cursor-not-allowed' : 
                      loading.performAction ? 'opacity-50 animate-pulse' : ''
                    }`}
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
                {potionUsedThisTurn && (
                  <span className="ml-2 text-orange-400 text-xs">
                    • Poção usada neste turno
                  </span>
                )}
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
                  const isPotionDisabled = potionUsedThisTurn && !isEmpty;
                  const hasUsedAnimation = usedPotionAnimation === slot.slot_position;
                  
                  // Buscar quantidade disponível do consumível no inventário
                  const consumableInInventory = player.consumables?.find(
                    c => c.consumable_id === slot.consumable_id
                  );
                  const availableQuantity = consumableInInventory?.quantity || 0;
                  
                  // CRÍTICO: Se a poção foi usada neste turno, simular a redução local
                  // para garantir feedback imediato
                  const displayQuantity = (usedPotionAnimation === slot.slot_position && availableQuantity > 0) 
                    ? Math.max(0, availableQuantity - 1) 
                    : availableQuantity;
                  
                  const tooltipInfo = {
                    title: slot.consumable_name || `Slot ${keyBinding}`,
                    description: isEmpty 
                      ? 'Slot vazio - Configure no inventário' 
                      : displayQuantity === 0
                        ? 'Sem unidades disponíveis'
                        : potionUsedThisTurn 
                          ? 'Poção já usada neste turno'
                          : slot.consumable_description || 'Poção',
                    stats: isEmpty ? [] : [
                      { label: 'Efeito', value: `+${slot.effect_value}` },
                      { label: 'Disponível', value: `x${displayQuantity}` },
                      { label: 'Tecla', value: keyBinding },
                      ...(potionUsedThisTurn ? [{ label: 'Status', value: 'Indisponível neste turno' }] : [])
                    ]
                  };
                  
                  // Desabilitar se não há quantidade disponível
                  const isOutOfStock = !isEmpty && displayQuantity === 0;
                  
                  return (
                    <div key={slot.slot_position} className="relative">
                      <Button
                        variant="ghost"
                        className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-2 relative border-2 transition-all duration-200 ${
                          isEmpty 
                            ? 'border-dashed border-muted-foreground/20 bg-transparent hover:bg-muted/10 hover:border-muted-foreground/30' 
                            : isOutOfStock
                              ? 'border-red-500/30 bg-red-500/5 opacity-50 cursor-not-allowed'
                              : isPotionDisabled
                                ? 'border-orange-500/30 bg-orange-500/5 opacity-50 cursor-not-allowed'
                                : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                        } ${isUsing ? 'opacity-50' : ''} ${hasUsedAnimation ? 'animate-pulse scale-110' : ''} ${
                          isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                        onClick={() => handlePotionSlotUse(slot.slot_position)}
                        onMouseDown={(e) => handleMouseDown(tooltipInfo, e)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={(e) => handleTouchStart(tooltipInfo, e)}
                        onTouchEnd={handleTouchEnd}
                        disabled={isDisabled || isEmpty || isUsing || shouldShowNextFloorButton || isPotionDisabled || isOutOfStock || isPlayerDead}
                      >
                        {isEmpty ? (
                          <Plus className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/40" />
                        ) : (
                          <div className="flex items-center justify-center">
                            {getPotionIcon(slot)}
                            {(isPotionDisabled || isOutOfStock) && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-6 h-0.5 bg-red-500 rotate-45 absolute"></div>
                                <div className="w-6 h-0.5 bg-red-500 -rotate-45 absolute"></div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isUsing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                            <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                        
                        {hasUsedAnimation && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-green-400 font-bold text-xs animate-bounce">✓</div>
                          </div>
                        )}
                      </Button>
                      
                        {/* Indicador de quantidade - sempre visível se não for slot vazio */}
                        {!isEmpty && (
                          <div className={`absolute -bottom-1 -left-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center border border-background font-semibold ${
                            isOutOfStock 
                              ? 'bg-red-500/90'
                              : displayQuantity < 5 
                                ? 'bg-orange-500/90'
                                : 'bg-emerald-500/90'
                          }`}>
                            {displayQuantity}
                          </div>
                        )}
                      
                      <Badge 
                        variant="outline" 
                        className={`absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center border-muted-foreground/30 ${
                          isPotionDisabled 
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            : isOutOfStock
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-background/90'
                        }`}
                      >
                        {keyBinding}
                      </Badge>
                      
                      {/* Indicador de poção usada */}
                      {isPotionDisabled && (
                        <div className="absolute top-0 left-0 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                          ✗
                        </div>
                      )}
                      
                      {/* Indicador de sem estoque */}
                      {isOutOfStock && (
                        <div className="absolute top-0 left-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                          ⚠
                        </div>
                      )}
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
                          onClick={() => executeAction('spell', spell.id)}
                          onMouseDown={(e) => handleMouseDown(tooltipInfo, e)}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={(e) => handleTouchStart(tooltipInfo, e)}
                          onTouchEnd={handleTouchEnd}
                          disabled={isDisabled || !canCast || shouldShowNextFloorButton || isPlayerDead}
                          variant="ghost"
                          size="lg"
                          className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 relative border-2 transition-all duration-200 ${
                            canCast
                              ? 'border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 shadow-lg shadow-violet-500/10'
                              : 'border-muted-foreground/10 bg-muted/5 opacity-50 cursor-not-allowed'
                          } ${isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''}`}
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
              {isPlayerDead ? 'Interface bloqueada - Personagem morto' : 'Atalhos: A/S/D (Combate) • Q/W/E (Poções) • 1/2/3 (Magias)'}
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