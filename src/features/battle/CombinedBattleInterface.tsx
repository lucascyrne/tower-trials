import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Star,
} from 'lucide-react';
import { type ActionType, type GamePlayer } from '@/resources/game/game.model';
import { type PlayerSpell } from '@/resources/spell/spell.model';
import { type ConsumableType } from '@/resources/consumable/consumable.model';
import { type PotionSlot } from '@/resources/equipment/slot.service';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { toast } from 'sonner';
import { useGameStateStore } from '@/stores/useGameStateStore';
// ✅ CORREÇÃO: Removido useBattleStore - usando handleAction das props
interface CombinedBattleInterfaceProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer | null;
  onPlayerStatsUpdate: (newHp: number, newMana: number) => void;
  currentEnemy?: { hp: number; maxHp: number; name: string } | null;
  battleRewards?: {
    xp: number;
    gold: number;
    drops: { name: string; quantity: number }[];
    leveledUp: boolean;
    newLevel?: number;
  } | null;
  potionSlots: PotionSlot[];
  loadingPotionSlots: boolean;
  onSlotsChange: () => Promise<void>;
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
  currentEnemy,
  battleRewards,
  potionSlots,
  loadingPotionSlots,
  onSlotsChange,
}: CombinedBattleInterfaceProps) {
  // ✅ CORREÇÃO: Remover performAction da destructuring para evitar dependência instável

  // ✅ CORREÇÃO: Todos os estados devem vir ANTES de qualquer early return
  const [usingSlot, setUsingSlot] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [usedPotionAnimation, setUsedPotionAnimation] = useState<number | null>(null);
  const [continuingAdventure, setContinuingAdventure] = useState(false);

  // Refs
  const actionProcessingRef = useRef<boolean>(false);
  const lastActionTimestampRef = useRef<number>(0);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constantes
  const ACTION_COOLDOWN_MS = 300;

  // ✅ CORREÇÃO: Memoizar valores derivados para evitar re-cálculos desnecessários
  const isDisabled = useMemo(
    () => !isPlayerTurn || loading.performAction,
    [isPlayerTurn, loading.performAction]
  );
  const potionUsedThisTurn = useMemo(
    () => player?.potionUsedThisTurn || false,
    [player?.potionUsedThisTurn]
  );
  const isPlayerDead = useMemo(
    () => (player?.hp !== undefined ? player.hp <= 0 : false),
    [player?.hp]
  );
  const isFleeDisabled = useMemo(
    () => loading.performAction || isPlayerDead,
    [loading.performAction, isPlayerDead]
  );

  // ✅ CORREÇÃO: Memoizar condição do botão para evitar re-cálculos
  const shouldShowNextFloorButton = useMemo(
    () =>
      Boolean(
        battleRewards &&
          !loading.performAction &&
          !isPlayerDead &&
          !continuingAdventure &&
          (!currentEnemy || (currentEnemy.hp !== undefined && currentEnemy.hp <= 0))
      ),
    [battleRewards, loading.performAction, isPlayerDead, continuingAdventure, currentEnemy]
  );

  // ✅ CORREÇÃO: Função para avançar para o próximo andar - ANTES do early return
  const handleContinueAdventure = useCallback(async () => {
    // ✅ CORREÇÃO: Capturar estados no momento da execução
    const currentContinuing = continuingAdventure;
    const currentBattleRewards = battleRewards;

    if (currentContinuing || !currentBattleRewards) return;

    setContinuingAdventure(true);

    try {
      // ✅ CORREÇÃO: Usar handleAction das props ao invés de performAction da store
      handleAction('continue');

      toast.success('Avançando para o próximo andar!', {
        description: 'Preparando nova batalha...',
        duration: 2000,
      });
    } catch {
      toast.error('Erro ao avançar para o próximo andar');
      setContinuingAdventure(false);
    }
  }, [continuingAdventure, battleRewards, handleAction]); // ✅ CORREÇÃO: Usar handleAction das props

  // ✅ CORREÇÃO: Função para verificar se uma ação pode ser executada - ANTES do early return
  const canPerformAction = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimestampRef.current;

    if (actionProcessingRef.current) {
      return false;
    }

    if (timeSinceLastAction < ACTION_COOLDOWN_MS) {
      return false;
    }

    return true;
  }, []); // ✅ CORREÇÃO: Sem dependências - usar valores via refs

  // ✅ CORREÇÃO: Função para executar ação com proteção - ANTES do early return
  const executeAction = useCallback(
    async (
      action: ActionType,
      spellId?: string,
      event?: React.MouseEvent | React.KeyboardEvent
    ) => {
      if (!canPerformAction()) return;

      event?.preventDefault?.();

      actionProcessingRef.current = true;
      lastActionTimestampRef.current = Date.now();

      try {
        await handleAction(action, spellId);
      } finally {
        setTimeout(() => {
          actionProcessingRef.current = false;
        }, ACTION_COOLDOWN_MS);
      }
    },
    [canPerformAction, handleAction] // ✅ CORREÇÃO: Remover ACTION_COOLDOWN_MS das dependências
  );

  // ✅ CORREÇÃO: Função para usar poção do slot - ANTES do early return
  const handlePotionSlotUse = useCallback(
    async (slotPosition: number) => {
      // ✅ CORREÇÃO: Acessar estados no momento da execução
      const currentPlayer = player;
      const currentPotionUsed = currentPlayer?.potionUsedThisTurn || false;
      const currentIsPlayerDead = currentPlayer?.hp !== undefined ? currentPlayer.hp <= 0 : false;
      const currentIsDisabled = !isPlayerTurn || loading.performAction;

      if (currentIsPlayerDead || currentIsDisabled || usingSlot !== null || !currentPlayer?.id)
        return;

      const currentPotionSlots = potionSlots;
      const slot = currentPotionSlots.find(s => s.slot_position === slotPosition);
      if (!slot?.consumable_id) {
        toast.warning(`Slot ${getPotionKeyBinding(slotPosition)} está vazio`);
        return;
      }

      if (currentPotionUsed) {
        toast.error('Você já usou uma poção neste turno!', {
          description: 'Você só pode usar uma poção por turno',
          duration: 3000,
        });
        return;
      }

      if (slot.available_quantity <= 0) {
        toast.error('Poção não disponível!', {
          description: 'Você não possui esta poção no inventário',
          duration: 3000,
        });
        return;
      }

      setUsingSlot(slotPosition);

      try {
        console.log('[CombinedBattleInterface] Iniciando uso da poção:', {
          slotPosition,
          consumableId: slot.consumable_id,
          availableQuantity: slot.available_quantity,
          playerId: currentPlayer.id,
        });

        // ✅ CORREÇÃO: Não invalidar cache ANTES da requisição - deixar o cache funcionar
        const { SlotService } = await import('@/resources/equipment/slot.service');
        const response = await SlotService.consumePotionFromSlot(currentPlayer.id, slotPosition);

        console.log('[CombinedBattleInterface] Resposta do SlotService:', {
          success: response.success,
          hasData: !!response.data,
          error: response.error,
          data: response.data,
        });

        if (response.success && response.data) {
          const { message, new_hp, new_mana } = response.data;

          // ✅ CORREÇÃO: Atualizar stats do player imediatamente
          onPlayerStatsUpdate(new_hp, new_mana);

          // ✅ CORREÇÃO: Atualizar potionUsedThisTurn através da store (não modificar objeto diretamente)
          useGameStateStore.getState().updateGameState(draft => {
            if (draft.player) {
              draft.player.potionUsedThisTurn = true;
            }
          });

          // ✅ CORREÇÃO: Animação de feedback visual
          setUsedPotionAnimation(slotPosition);
          setTimeout(() => setUsedPotionAnimation(null), 2000);

          // ✅ CRÍTICO: Recarregar slots IMEDIATAMENTE - sem delay
          console.log('[CombinedBattleInterface] Recarregando slots imediatamente...');
          await onSlotsChange();

          toast.success(message, {
            description: `HP: ${new_hp} | Mana: ${new_mana}`,
            duration: 4000,
          });

          console.log('[CombinedBattleInterface] Poção usada com sucesso e slots atualizados');
        } else {
          // ✅ CORREÇÃO: Log mais detalhado do erro
          console.warn('[CombinedBattleInterface] ❌ Falha ao usar poção:', {
            success: response.success,
            error: response.error,
            data: response.data,
            slotPosition,
            playerId: currentPlayer.id,
            responseObject: response,
          });

          // ✅ CORREÇÃO: Mesmo em caso de erro, recarregar slots para garantir sincronização
          console.log(
            '[CombinedBattleInterface] Recarregando slots após erro para garantir sincronização...'
          );
          await onSlotsChange();

          // ✅ CORREÇÃO: Mensagem de erro mais específica
          const errorMessage = response.error || 'Erro desconhecido ao usar poção';
          console.error('[CombinedBattleInterface] Exibindo toast de erro:', errorMessage);
          toast.error(errorMessage, {
            description: `Slot ${slotPosition} - Verifique os logs do console para mais detalhes`,
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('[CombinedBattleInterface] Erro crítico ao usar poção:', error);

        // ✅ CORREÇÃO: Em caso de erro crítico, também recarregar slots
        try {
          console.log('[CombinedBattleInterface] Recarregando slots após erro crítico...');
          await onSlotsChange();
        } catch (reloadError) {
          console.error('[CombinedBattleInterface] Erro ao recarregar slots:', reloadError);
        }

        toast.error('Erro ao usar poção');
      } finally {
        setUsingSlot(null);
      }
    },
    [
      player,
      isPlayerTurn,
      loading.performAction,
      usingSlot,
      potionSlots, // ✅ MANTIDO: Necessário pois muda referência
      onPlayerStatsUpdate,
      onSlotsChange,
    ] // ✅ CORREÇÃO: Dependências essenciais apenas
  );

  // Função auxiliar para obter tecla de atalho
  const getPotionKeyBinding = (position: number) => {
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

  // ✅ CORREÇÃO: Handlers para ações - ANTES do early return
  const handleAttack = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      executeAction('attack', undefined, event);
    },
    [executeAction]
  );

  const handleDefend = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      executeAction('defend', undefined, event);
    },
    [executeAction]
  );

  const handleFlee = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      executeAction('flee');
    },
    [executeAction]
  );

  const handleSpellCast = useCallback(
    (event: React.MouseEvent, spellId: string) => {
      event.preventDefault();
      executeAction('spell', spellId, event);
    },
    [executeAction]
  );

  // ✅ CORREÇÃO: Função para mostrar tooltip - ANTES do early return
  const showTooltip = useCallback(
    (info: Omit<TooltipInfo, 'position'>, position: { x: number; y: number }) => {
      setTooltip({
        ...info,
        position,
      });
    },
    []
  );

  // ✅ CORREÇÃO: Função para esconder tooltip - ANTES do early return
  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
    }, 150);
  }, []);

  // ✅ CORREÇÃO: Handlers para tooltip - ANTES do early return
  const handleMouseDown = useCallback(
    (info: Omit<TooltipInfo, 'position'>, event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      };

      const timer = setTimeout(() => {
        showTooltip(info, position);
      }, 500);
      setPressTimer(timer);
    },
    [showTooltip]
  );

  const handleMouseUp = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

  const handleMouseLeave = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    hideTooltip();
  }, [pressTimer, hideTooltip]);

  const handleTouchStart = useCallback(
    (info: Omit<TooltipInfo, 'position'>, event: React.TouchEvent) => {
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      };

      const timer = setTimeout(() => {
        showTooltip(info, position);
      }, 500);
      setPressTimer(timer);
    },
    [showTooltip]
  );

  const handleTouchEnd = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

  // ✅ CORREÇÃO: useEffect para atalhos de teclado - ANTES do early return e com dependências otimizadas
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // ✅ CORREÇÃO: Acessar estados no momento da execução para evitar dependências
      const currentPlayer = player;
      const currentIsPlayerDead = currentPlayer?.hp !== undefined ? currentPlayer.hp <= 0 : false;
      const currentIsDisabled = !isPlayerTurn || loading.performAction;
      const currentIsFleeDisabled = loading.performAction || currentIsPlayerDead;

      if (currentIsPlayerDead || usingSlot !== null) return;

      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      switch (key) {
        case 'a':
          if (currentIsDisabled) return;
          event.preventDefault();
          handleAction('attack');
          return;
        case 's':
          if (
            currentIsDisabled ||
            (currentPlayer?.defenseCooldown && currentPlayer.defenseCooldown > 0)
          )
            return;
          event.preventDefault();
          handleAction('defend');
          return;
        case 'd':
          if (currentIsFleeDisabled) return;
          event.preventDefault();
          executeAction('flee');
          return;
      }

      if (currentIsDisabled) return;

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
          const spellIndex = parseInt(key) - 1;
          if (
            currentPlayer &&
            spellIndex >= 0 &&
            spellIndex < Math.min(3, currentPlayer.spells.length)
          ) {
            const spell = currentPlayer.spells[spellIndex];
            if (currentPlayer.mana >= spell.mana_cost && spell.current_cooldown === 0) {
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
  }, [
    player, // ✅ CORREÇÃO: Apenas o objeto player como dependência
    isPlayerTurn,
    loading.performAction,
    usingSlot,
    handleAction,
    executeAction,
    handlePotionSlotUse,
  ]); // ✅ CORREÇÃO: Dependências mínimas e estáveis

  // ✅ CORREÇÃO: Memoizar magias para evitar re-cálculos - ANTES do early return
  const displaySpells = useMemo(() => player?.spells?.slice(0, 3) || [], [player?.spells]);

  // ✅ CORREÇÃO: AGORA o early return vem DEPOIS de todos os hooks
  if (!player) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="text-muted-foreground">Carregando interface de batalha...</div>
      </div>
    );
  }

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
                  <div className="text-xs text-green-300 font-medium mb-1">
                    Recompensas Obtidas:
                  </div>
                  <div className="flex justify-center items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-blue-400" />
                      <span className="text-blue-400 font-semibold">+{battleRewards?.xp} XP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-lg">💰</span>
                      <span className="text-yellow-400 font-semibold">
                        +{battleRewards?.gold} Gold
                      </span>
                    </div>
                    {battleRewards?.drops && battleRewards.drops.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-purple-400 text-lg">📦</span>
                        <span className="text-purple-400 font-semibold">
                          +{battleRewards.drops.length} item
                          {battleRewards.drops.length > 1 ? 's' : ''}
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
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all duration-200 transform hover:scale-105 w-full md:w-auto cursor-pointer"
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
                    onClick={handleAttack}
                    disabled={isDisabled || shouldShowNextFloorButton || isPlayerDead}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 shadow-lg shadow-red-500/10 transition-all duration-200 cursor-pointer ${
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
                    onClick={handleDefend}
                    disabled={
                      isDisabled ||
                      player.defenseCooldown > 0 ||
                      shouldShowNextFloorButton ||
                      isPlayerDead
                    }
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 shadow-lg shadow-blue-500/10 transition-all duration-200 cursor-pointer ${
                      isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                  >
                    <Shield className="h-4 w-4 md:h-5 md:w-5 text-blue-500/80" />
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
                    onClick={handleFlee}
                    disabled={isFleeDisabled}
                    variant="ghost"
                    size="lg"
                    className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 shadow-lg shadow-amber-500/10 transition-all duration-200 cursor-pointer ${
                      isPlayerDead
                        ? 'opacity-30 cursor-not-allowed'
                        : loading.performAction
                          ? 'opacity-50 animate-pulse'
                          : ''
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

            {/* Seção de Poções - Direita */}
            <div className="flex-1 md:max-w-xs md:flex-none">
              <div className="text-xs font-medium text-muted-foreground/80 mb-2 text-center md:text-right">
                Poções Rápidas
              </div>
              <div className="flex justify-center md:justify-end gap-1 md:gap-2">
                {loadingPotionSlots
                  ? // Loading state para slots
                    [1, 2, 3].map(position => (
                      <div key={position} className="relative">
                        <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
                        <Badge
                          variant="outline"
                          className="absolute -top-1 -right-1 md:-top-2 md:-right-2 h-4 w-4 md:h-5 md:w-5 p-0 text-xs font-medium flex items-center justify-center bg-background/90 border-muted-foreground/30"
                        >
                          {getPotionKeyBinding(position)}
                        </Badge>
                      </div>
                    ))
                  : // Renderizar slots normalmente
                    (() => {
                      // ✅ CORREÇÃO: Garantir que sempre temos 3 slots, mesmo se alguns estão vazios
                      const allSlots = [1, 2, 3].map(position => {
                        const existingSlot = potionSlots.find(s => s.slot_position === position);

                        // Se não existe slot ou não tem consumível, criar slot vazio
                        if (!existingSlot || !existingSlot.consumable_id) {
                          return {
                            slot_position: position,
                            consumable_id: null,
                            consumable_name: null,
                            consumable_description: null,
                            effect_value: null,
                            consumable_type: null,
                            available_quantity: 0,
                            consumable_price: null,
                          };
                        }

                        // ✅ CRÍTICO: Se tem consumible_id mas quantidade é 0, tratar como slot vazio
                        if (existingSlot.available_quantity <= 0) {
                          return {
                            slot_position: position,
                            consumable_id: null,
                            consumable_name: null,
                            consumable_description: null,
                            effect_value: null,
                            consumable_type: null,
                            available_quantity: 0,
                            consumable_price: null,
                          };
                        }

                        return existingSlot;
                      });

                      return allSlots.map(slot => {
                        const keyBinding = getPotionKeyBinding(slot.slot_position);
                        const isEmpty = !slot.consumable_id || slot.available_quantity <= 0;
                        const isUsing = usingSlot === slot.slot_position;
                        const hasUsedAnimation = usedPotionAnimation === slot.slot_position;
                        const isPotionDisabled = potionUsedThisTurn && !isEmpty;

                        // ✅ CRÍTICO: Quantidade sempre 0 para slots vazios
                        const displayQuantity = isEmpty ? 0 : Math.max(0, slot.available_quantity);

                        const tooltipInfo = isEmpty
                          ? {
                              title: `Slot ${keyBinding}`,
                              description: 'Slot vazio - arraste uma poção aqui',
                              stats: [{ label: 'Tecla de atalho', value: keyBinding }],
                            }
                          : {
                              title: slot.consumable_name || 'Poção',
                              description: slot.consumable_description || '',
                              stats: [
                                { label: 'Efeito', value: `+${slot.effect_value}` },
                                { label: 'Quantidade', value: `${displayQuantity}` },
                                { label: 'Tecla', value: keyBinding },
                                ...(isPotionDisabled
                                  ? [{ label: 'Status', value: 'Já usada neste turno' }]
                                  : []),
                              ],
                            };

                        // ✅ CORREÇÃO: Melhor detecção de falta de estoque
                        const isOutOfStock = !isEmpty && displayQuantity === 0;

                        return (
                          <div key={slot.slot_position} className="relative">
                            <Button
                              onClick={() => handlePotionSlotUse(slot.slot_position)}
                              disabled={
                                isDisabled ||
                                isEmpty ||
                                isUsing ||
                                shouldShowNextFloorButton ||
                                isPotionDisabled ||
                                isOutOfStock ||
                                isPlayerDead
                              }
                              variant="ghost"
                              className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-2 relative border-2 transition-all duration-200 cursor-pointer ${
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
                              onMouseDown={e => handleMouseDown(tooltipInfo, e)}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseLeave}
                              onTouchStart={e => handleTouchStart(tooltipInfo, e)}
                              onTouchEnd={handleTouchEnd}
                            >
                              {isEmpty ? (
                                <Plus className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/40" />
                              ) : slot.consumable_id ? (
                                <div className="flex items-center justify-center">
                                  <ConsumableImage
                                    consumable={{
                                      id: slot.consumable_id,
                                      name: slot.consumable_name || 'Poção',
                                      description: slot.consumable_description || '',
                                      type: (slot.consumable_type as ConsumableType) || 'potion',
                                      effect_value: slot.effect_value || 0,
                                      price: slot.consumable_price || 0,
                                      level_requirement: 1,
                                      created_at: '',
                                      updated_at: '',
                                    }}
                                    size="lg"
                                    className="h-5 w-5"
                                    showFallback={true}
                                  />
                                  {(isPotionDisabled || isOutOfStock) && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-6 h-0.5 bg-red-500 rotate-45 absolute"></div>
                                      <div className="w-6 h-0.5 bg-red-500 -rotate-45 absolute"></div>
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {isUsing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                                  <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-2 border-primary border-t-transparent" />
                                </div>
                              )}

                              {hasUsedAnimation && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-green-400 font-bold text-xs animate-bounce">
                                    ✓
                                  </div>
                                </div>
                              )}
                            </Button>

                            {/* ✅ CORREÇÃO: Indicador de quantidade - apenas se não for slot vazio */}
                            {!isEmpty && displayQuantity > 0 && (
                              <div
                                className={`absolute -bottom-1 -left-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center border border-background font-semibold ${
                                  displayQuantity < 5 ? 'bg-orange-500/90' : 'bg-emerald-500/90'
                                }`}
                              >
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
                            {isPotionDisabled && !isEmpty && (
                              <div className="absolute top-0 left-0 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                                ✗
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
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
                    const canCast = player
                      ? player.mana >= spell.mana_cost && spell.current_cooldown === 0
                      : false;
                    const spellIcon = getSpellIcon(spell);
                    const keyBinding = (index + 1).toString();

                    const tooltipInfo = {
                      title: spell.name,
                      description: spell.description,
                      stats: [
                        { label: 'Custo de Mana', value: `${spell.mana_cost}` },
                        {
                          label: 'Cooldown',
                          value:
                            spell.current_cooldown > 0
                              ? `${spell.current_cooldown} turnos`
                              : 'Disponível',
                        },
                        { label: 'Dano/Efeito', value: `${spell.effect_value}` },
                        { label: 'Tecla', value: keyBinding },
                      ],
                    };

                    return (
                      <div key={spell.id} className="relative">
                        <Button
                          onClick={e => handleSpellCast(e, spell.id)}
                          onMouseDown={e => handleMouseDown(tooltipInfo, e)}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={e => handleTouchStart(tooltipInfo, e)}
                          onTouchEnd={handleTouchEnd}
                          disabled={
                            isDisabled ||
                            !canCast ||
                            shouldShowNextFloorButton ||
                            isPlayerDead ||
                            !player
                          }
                          variant="ghost"
                          size="lg"
                          className={`h-12 w-12 md:h-14 md:w-14 rounded-xl p-0 relative border-2 transition-all duration-200 cursor-pointer ${
                            canCast
                              ? 'border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 shadow-lg shadow-violet-500/10'
                              : 'border-muted-foreground/10 bg-muted/5 opacity-50 cursor-not-allowed'
                          } ${isPlayerDead ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <div
                            className={canCast ? 'text-violet-500/80' : 'text-muted-foreground/50'}
                          >
                            {spellIcon}
                          </div>

                          {/* Cooldown indicator */}
                          {spell.current_cooldown > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500/90 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background">
                              {spell.current_cooldown}
                            </div>
                          )}

                          {/* Mana cost indicator */}
                          <div
                            className={`absolute -bottom-1 -right-1 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center border border-background ${
                              canCast ? 'bg-blue-500/90' : 'bg-muted-foreground/70'
                            }`}
                          >
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
              {isPlayerDead
                ? 'Interface bloqueada - Personagem morto'
                : 'Atalhos: A/S/D (Combate) • Q/W/E (Poções) • 1/2/3 (Magias)'}
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
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-xl max-w-xs">
            <h4 className="font-medium text-sm mb-1">{tooltip.title}</h4>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              {tooltip.description}
            </p>
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
