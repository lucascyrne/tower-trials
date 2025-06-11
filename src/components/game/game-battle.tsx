import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useGame } from '@/resources/game/game-hook';
import { type ActionType } from '@/resources/game/game-model';
import { BattleArena } from './BattleArena';
import { CombinedBattleInterface } from './CombinedBattleInterface';
import { VictoryModal } from './VictoryModal';
import { GameOverModal } from './GameOverModal';
import { toast } from 'sonner';
import SpecialEventPanel from './SpecialEventPanel';
import AttributeDistributionModal from './AttributeDistributionModal';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { useAuth } from '@/resources/auth/auth-hook';

import { BattleHeader } from './BattleHeader';
import { GameLog } from './GameLog';
import { CharacterService } from '@/resources/game/character/character.service';
import { QuickActionPanel } from './QuickActionPanel';
import { FleeOverlay } from './FleeOverlay';

interface BattleRewards {
  xp: number;
  gold: number;
  drops: { name: string; quantity: number }[];
  leveledUp: boolean;
  newLevel?: number;
}

export default function GameBattle() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    gameState,
    performAction,
    loading,
    initializeBattle,
    addGameLogMessage,
    updatePlayerStats,
    updatePlayerConsumables,
    gameLog,
  } = useGame();
  const { player, currentEnemy, currentFloor, isPlayerTurn } = gameState;

  // Estados do componente
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showFleeOverlay, setShowFleeOverlay] = useState(false);
  const [fleeSuccess, setFleeSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [victoryRewards, setVictoryRewards] = useState<BattleRewards>({
    xp: 0,
    gold: 0,
    drops: [],
    leveledUp: false,
    newLevel: 0,
  });

  // Sistema para prevenir ações duplicadas e controlar inicialização
  const actionProcessingRef = useRef(false);
  const lastActionTimeRef = useRef(0);
  const battleInitializedRef = useRef(false);
  const mountedRef = useRef(false);
  const currentCharacterRef = useRef<string | null>(null);
  const initializationAttempts = useRef(0);
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);
  const MAX_INITIALIZATION_ATTEMPTS = 3;
  const INITIALIZATION_TIMEOUT = 15000; // 15 segundos

  // OTIMIZADO: Sistema simplificado para controle de processamento
  const processedRewardsRef = useRef<Set<string>>(new Set());

  const { character: characterId } = useParams({
    from: '/_authenticated/game/play/hub/battle/$character',
  });

  // OTIMIZADO: Memorizar percentuais para evitar recálculos desnecessários
  const battleStats = useMemo(() => {
    const enemyHpPercentage =
      currentEnemy && currentEnemy.maxHp > 0
        ? Math.max(0, Math.min(100, (currentEnemy.hp / currentEnemy.maxHp) * 100))
        : 0;
    const playerHpPercentage =
      player.max_hp > 0 ? Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100)) : 0;
    const playerManaPercentage =
      player.max_mana > 0 ? Math.max(0, Math.min(100, (player.mana / player.max_mana) * 100)) : 0;

    return { enemyHpPercentage, playerHpPercentage, playerManaPercentage };
  }, [
    currentEnemy?.hp,
    currentEnemy?.maxHp,
    player.hp,
    player.max_hp,
    player.mana,
    player.max_mana,
  ]);

  // NOVO: Função para limpar timers e reiniciar estado
  const cleanupInitialization = useCallback(() => {
    if (initializationTimeout.current) {
      clearTimeout(initializationTimeout.current);
      initializationTimeout.current = null;
    }
    battleInitializedRef.current = false;
    currentCharacterRef.current = null;
    initializationAttempts.current = 0;
    setInitializationError(null);
  }, []);

  // Controle de montagem - MELHORADO
  useEffect(() => {
    mountedRef.current = true;
    console.log('[GameBattle] Componente montado');

    return () => {
      console.log('[GameBattle] Componente desmontado - limpando recursos');
      mountedRef.current = false;
      cleanupInitialization();
    };
  }, [cleanupInitialization]);

  // CORRIGIDO: Inicialização de batalha mais robusta com timeout e recuperação
  useEffect(() => {
    // Validações básicas
    if (!mountedRef.current || !user?.id || !characterId) {
      console.log('[GameBattle] Condições básicas não atendidas:', {
        mounted: mountedRef.current,
        userId: !!user?.id,
        characterId: !!characterId,
      });
      return;
    }

    // Evitar múltiplas inicializações para o mesmo personagem
    if (battleInitializedRef.current && currentCharacterRef.current === characterId) {
      console.log('[GameBattle] Batalha já inicializada para este personagem');
      return;
    }

    // Evitar inicialização se está carregando progresso
    if (loading.loadProgress) {
      console.log('[GameBattle] Aguardando carregamento de progresso...');
      return;
    }

    // Verificar limite de tentativas
    if (initializationAttempts.current >= MAX_INITIALIZATION_ATTEMPTS) {
      console.error('[GameBattle] Máximo de tentativas de inicialização atingido');
      setInitializationError('Erro ao carregar batalha. Verifique sua conexão e tente novamente.');
      toast.error('Falha ao inicializar batalha', {
        description: 'Retorne ao hub e tente novamente',
        duration: 5000,
        action: {
          label: 'Voltar ao Hub',
          onClick: () => navigate({ to: '/game/play' }),
        },
      });
      return;
    }

    const initializeBattleForCharacter = async () => {
      try {
        console.log(
          `[GameBattle] Inicializando batalha para personagem ${characterId} (tentativa ${initializationAttempts.current + 1}/${MAX_INITIALIZATION_ATTEMPTS})`
        );

        initializationAttempts.current += 1;
        battleInitializedRef.current = true;
        currentCharacterRef.current = characterId;
        setInitializationError(null);

        // Configurar timeout de segurança
        initializationTimeout.current = setTimeout(() => {
          if (mountedRef.current && battleInitializedRef.current) {
            console.error('[GameBattle] Timeout de inicialização atingido');
            setInitializationError('Tempo limite de carregamento atingido');
            battleInitializedRef.current = false;

            if (initializationAttempts.current < MAX_INITIALIZATION_ATTEMPTS) {
              // Tentar novamente após um delay
              setTimeout(() => {
                if (mountedRef.current) {
                  console.log('[GameBattle] Tentando reinicialização após timeout...');
                  battleInitializedRef.current = false;
                }
              }, 2000);
            }
          }
        }, INITIALIZATION_TIMEOUT);

        // Buscar dados do personagem
        const characterResponse = await CharacterService.getCharacter(characterId);
        if (!characterResponse.success || !characterResponse.data) {
          throw new Error(characterResponse.error || 'Personagem não encontrado');
        }

        // Inicializar batalha
        await initializeBattle(characterResponse.data, characterId);

        // Sucesso - limpar timeout e definir como carregado
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }

        setIsLoading(false);
        setInitializationError(null);
        console.log(`[GameBattle] Batalha inicializada com sucesso`);
      } catch (error) {
        console.error('[GameBattle] Erro ao inicializar batalha:', error);

        // Limpar timeout em caso de erro
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }

        battleInitializedRef.current = false;
        currentCharacterRef.current = null;

        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setInitializationError(errorMessage);

        // Se ainda há tentativas disponíveis, não mostrar toast de erro ainda
        if (initializationAttempts.current < MAX_INITIALIZATION_ATTEMPTS) {
          console.log('[GameBattle] Tentando reinicialização em 3 segundos...');
          setTimeout(() => {
            if (mountedRef.current) {
              battleInitializedRef.current = false;
            }
          }, 3000);
        } else {
          // Máximo de tentativas atingido
          toast.error('Erro ao inicializar batalha', {
            description: errorMessage,
            duration: 5000,
            action: {
              label: 'Voltar ao Hub',
              onClick: () => navigate({ to: '/game/play' }),
            },
          });
        }
      }
    };

    // Delay pequeno para evitar inicializações muito rápidas
    const initTimer = setTimeout(() => {
      if (mountedRef.current && !battleInitializedRef.current) {
        initializeBattleForCharacter();
      }
    }, 100);

    return () => clearTimeout(initTimer);
  }, [
    user?.id,
    characterId,
    initializeBattle,
    loading.loadProgress,
    navigate,
    cleanupInitialization,
  ]);

  // OTIMIZADO: Processamento de recompensas mais eficiente
  useEffect(() => {
    if (!gameState.battleRewards || showVictoryModal) return;

    // Criar chave única para evitar processamento duplicado
    const battleKey = `${player.floor}-${currentEnemy?.name || 'unknown'}-${gameState.battleRewards.xp}-${gameState.battleRewards.gold}`;

    if (processedRewardsRef.current.has(battleKey)) {
      console.log(`[GameBattle] Recompensa já processada: ${battleKey}`);
      return;
    }

    // CRÍTICO: Verificar se realmente há recompensas válidas
    if (!gameState.battleRewards.xp && !gameState.battleRewards.gold) {
      console.log(`[GameBattle] Recompensas inválidas ou vazias - ignorando`);
      return;
    }

    // Marcar como processada
    processedRewardsRef.current.add(battleKey);

    console.log(`[GameBattle] Processando recompensa de vitória`);

    const battleRewards = gameState.battleRewards;
    setVictoryRewards({
      xp: battleRewards.xp,
      gold: battleRewards.gold,
      drops: battleRewards.drops || [],
      leveledUp: battleRewards.leveledUp,
      newLevel: battleRewards.newLevel,
    });

    setShowVictoryModal(true);
    addGameLogMessage(
      `Vitória! Você derrotou o inimigo e recebeu ${battleRewards.xp} XP e ${battleRewards.gold} Gold.`,
      'system'
    );

    if (battleRewards.leveledUp && battleRewards.newLevel) {
      addGameLogMessage(`Você subiu para o nível ${battleRewards.newLevel}!`, 'system');
    }

    // Limpar cache de recompensas antigas após delay
    setTimeout(() => {
      if (processedRewardsRef.current.size > 10) {
        const oldestKeys = Array.from(processedRewardsRef.current).slice(0, 5);
        oldestKeys.forEach(key => processedRewardsRef.current.delete(key));
      }
    }, 5000);
  }, [
    gameState.battleRewards,
    showVictoryModal,
    player.floor,
    currentEnemy?.name,
    addGameLogMessage,
  ]);

  // OTIMIZADO: Verificação de game over simplificada
  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0 && !showDeathModal) {
      console.log('[GameBattle] Personagem morreu - exibindo modal de morte');
      setShowDeathModal(true);

      if (gameState.characterDeleted) {
        addGameLogMessage(
          `${player.name} foi perdido permanentemente. O sistema de Permadeath está ativo.`,
          'system'
        );
      }
    }
  }, [
    gameState.mode,
    player.hp,
    gameState.characterDeleted,
    player.name,
    addGameLogMessage,
    showDeathModal,
  ]);

  // MELHORADO: Verificação para estados inconsistentes de batalha com recuperação mais robusta
  useEffect(() => {
    // Só verificar se a batalha foi inicializada com sucesso
    if (!battleInitializedRef.current || isLoading || initializationError) return;

    // Se estamos em modo de batalha mas não há inimigo e não há recompensas e não há evento
    const isInconsistentState =
      gameState.mode === 'battle' &&
      !currentEnemy &&
      !gameState.battleRewards &&
      !gameState.currentSpecialEvent;

    if (isInconsistentState) {
      console.warn(
        '[GameBattle] ⚠️ ESTADO INCONSISTENTE DETECTADO: modo battle sem inimigo, sem recompensas, sem evento'
      );

      // Aguardar um pouco antes de tentar recuperação para dar tempo do estado se estabilizar
      const recoveryTimer = setTimeout(async () => {
        if (!mountedRef.current) return;

        // Verificar novamente se o estado ainda está inconsistente
        const stillInconsistent =
          gameState.mode === 'battle' &&
          !currentEnemy &&
          !gameState.battleRewards &&
          !gameState.currentSpecialEvent;

        if (stillInconsistent) {
          console.log('[GameBattle] 🔄 Tentando recuperação de estado inconsistente...');

          try {
            // Opção 1: Tentar regenerar inimigo para o andar atual
            const { GameService } = await import('@/resources/game/game.service');
            const newEnemy = await GameService.generateEnemy(player.floor);

            if (newEnemy) {
              console.log(`[GameBattle] ✅ Inimigo regenerado: ${newEnemy.name}`);
              // O estado será atualizado automaticamente pelo provider
              return;
            }
          } catch (error) {
            console.error('[GameBattle] ❌ Erro ao regenerar inimigo:', error);
          }

          // Opção 2: Se a regeneração falhou, forçar reinicialização
          console.log('[GameBattle] 🔄 Forçando reinicialização completa...');
          battleInitializedRef.current = false;
          initializationAttempts.current = 0;
          setIsLoading(true);
          setInitializationError(null);

          toast.warning('Recuperando estado da batalha...', {
            description: 'Recarregando dados do jogo',
            duration: 3000,
          });
        }
      }, 3000); // 3 segundos de delay para dar tempo do estado se estabilizar

      return () => clearTimeout(recoveryTimer);
    }
  }, [
    gameState.mode,
    currentEnemy,
    gameState.battleRewards,
    gameState.currentSpecialEvent,
    player.floor,
    isLoading,
    initializationError,
  ]);

  // OTIMIZADO: Sistema de detecção de fuga mais eficiente
  useEffect(() => {
    const isFugaDetected = gameState.mode === 'fled' || gameState.fleeSuccessful === true;

    if (isFugaDetected && !showFleeOverlay) {
      console.log('[GameBattle] Fuga detectada - ativando overlay');

      const isSuccess = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
      setFleeSuccess(isSuccess);
      setShowFleeOverlay(true);
      actionProcessingRef.current = true;
    }
  }, [gameState.mode, gameState.fleeSuccessful, showFleeOverlay]);

  // OTIMIZADO: Detecção de orientação mais eficiente
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsMobilePortrait(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Listener para modal de atributos
  useEffect(() => {
    const handleOpenAttributeModal = () => setShowAttributeModal(true);
    window.addEventListener('openAttributeModal', handleOpenAttributeModal);
    return () => window.removeEventListener('openAttributeModal', handleOpenAttributeModal);
  }, []);

  // OTIMIZADO: Função para executar ações com lógica corrigida para poções
  const handleAction = useCallback(
    async (action: ActionType, spellId?: string, consumableId?: string) => {
      const currentTime = Date.now();

      console.log(`[GameBattle] Executando ação: ${action}`);

      // 1. Validações básicas
      if (gameState.mode === 'gameover' || player.hp <= 0) {
        console.warn('[GameBattle] Ação bloqueada - personagem está morto');
        return;
      }

      // 2. CORREÇÃO: Poções e fuga podem ser usadas a qualquer momento
      const isInstantAction = action === 'consumable' || action === 'flee' || action === 'continue';

      if (!isInstantAction && !isPlayerTurn) {
        console.warn(`[GameBattle] Ação '${action}' bloqueada - não é turno do jogador`);
        return;
      }

      // 3. Verificar debounce básico (exceto para poções que devem ser instantâneas)
      if (action !== 'consumable' && currentTime - lastActionTimeRef.current < 300) {
        console.warn(`[GameBattle] Debounce - aguardando`);
        return;
      }

      lastActionTimeRef.current = currentTime;

      try {
        console.log(`[GameBattle] Delegando ação '${action}' para provider`);
        await performAction(action, spellId, consumableId);
      } catch (error) {
        console.error(`[GameBattle] Erro ao executar ação '${action}':`, error);
        toast.error(`Erro ao executar ação: ${action}`);
      }
    },
    [gameState.mode, player.hp, isPlayerTurn, performAction]
  );

  // Funções de callback otimizadas
  const handlePlayerConsumablesUpdate = useCallback(
    (consumables: CharacterConsumable[]) => {
      console.log(`[game-battle] Atualizando consumáveis do jogador:`, consumables.length);
      updatePlayerConsumables(consumables);
    },
    [updatePlayerConsumables]
  );

  const handlePlayerStatsUpdate = useCallback(
    (newHp: number, newMana: number) => {
      console.log(`[game-battle] Atualizando stats do jogador: HP ${newHp}, Mana ${newMana}`);
      updatePlayerStats(newHp, newMana);

      // Atualizar no banco de dados de forma assíncrona
      if (gameState.player.id) {
        CharacterService.updateCharacterHpMana(gameState.player.id, newHp, newMana)
          .then(result => {
            if (!result.success) {
              console.error('[game-battle] Erro ao atualizar stats no banco:', result.error);
              toast.error('Erro ao atualizar status do personagem');
            }
          })
          .catch((error: Error) => {
            console.error('[game-battle] Erro ao atualizar stats:', error);
            toast.error('Erro ao atualizar status do personagem');
          });
      }
    },
    [updatePlayerStats, gameState.player.id]
  );

  const handleContinueAdventure = useCallback(async () => {
    if (actionProcessingRef.current || loading.performAction) {
      console.warn('[GameBattle] Continuar aventura bloqueado - já processando ação');
      return;
    }

    actionProcessingRef.current = true;
    setShowVictoryModal(false);

    try {
      console.log("[GameBattle] Chamando performAction('continue')...");
      await handleAction('continue');
    } catch (error) {
      console.error('[GameBattle] Erro ao avançar:', error);
      toast.error('Erro ao avançar para o próximo andar');
      setShowVictoryModal(true);
    } finally {
      actionProcessingRef.current = false;
    }
  }, [loading.performAction, handleAction]);

  const handleReturnToHub = useCallback(() => {
    navigate({ to: '/game/play/hub', search: { character: gameState.player.id } });
  }, [navigate, gameState.player.id]);

  const handleReturnToCharacterSelect = useCallback(() => {
    navigate({ to: '/game/play' });
  }, [navigate]);

  const handleOpenAttributeModal = useCallback(() => {
    setShowAttributeModal(true);
    setShowVictoryModal(false);
  }, []);

  const handleFleeOverlayComplete = useCallback(async () => {
    console.log('[GameBattle] Overlay de fuga concluído, sucesso:', fleeSuccess);
    setShowFleeOverlay(false);
    actionProcessingRef.current = false;

    if (fleeSuccess) {
      console.log('[GameBattle] Fuga bem-sucedida - redirecionando');

      toast.success('Fuga bem-sucedida!', {
        description: 'Retornando ao hub...',
        duration: 2000,
      });

      try {
        await CharacterService.updateCharacterFloor(gameState.player.id, 1);
        console.log('[GameBattle] Andar resetado para 1');
      } catch (updateError) {
        console.error('[GameBattle] Erro ao resetar andar:', updateError);
      }

      navigate({ to: '/game/play/hub', search: { character: gameState.player.id } });
    } else {
      toast.warning('Fuga falhou!', {
        description: 'Prepare-se para o contra-ataque...',
        duration: 3000,
      });
    }
  }, [fleeSuccess, gameState.player.id, navigate]);

  // OTIMIZADO: Verificação de estado de fuga
  const isFugaState =
    gameState.mode === 'fled' || gameState.fleeSuccessful === true || showFleeOverlay;

  // NOVO: Tela de erro de inicialização
  if (initializationError && initializationAttempts.current >= MAX_INITIALIZATION_ATTEMPTS) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center max-w-md">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Erro ao Carregar Batalha</h2>
          <p className="text-muted-foreground mb-6">{initializationError}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => navigate({ to: '/game/play' })}
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded"
            >
              Voltar ao Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MELHORADO: Tela de loading com mais informações e timeout visual
  if (isLoading || !battleInitializedRef.current) {
    const loadingProgress = Math.min(
      ((Date.now() -
        (initializationTimeout.current ? Date.now() - INITIALIZATION_TIMEOUT : Date.now())) /
        INITIALIZATION_TIMEOUT) *
        100,
      90
    );

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center max-w-md">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Inicializando Batalha...</h2>
          <p className="text-muted-foreground mb-4">
            {initializationAttempts.current > 1
              ? `Tentativa ${initializationAttempts.current}/${MAX_INITIALIZATION_ATTEMPTS}`
              : 'Preparando sua aventura...'}
          </p>
          {initializationError && initializationAttempts.current < MAX_INITIALIZATION_ATTEMPTS && (
            <p className="text-sm text-muted-foreground text-yellow-600 mb-2">
              Tentando reconectar...
            </p>
          )}
          <div className="w-full bg-secondary rounded-full h-2 mb-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground">Carregando dados do personagem e andar...</p>
        </div>
      </div>
    );
  }

  if (gameState.mode === 'special_event' || gameState.currentSpecialEvent) {
    return <SpecialEventPanel />;
  }

  // SIMPLIFICADO: Verificação de dados básicos
  const hasBasicData = currentFloor && player.id;
  const shouldShowLoadingScreen = !isFugaState && !hasBasicData && !gameState.battleRewards;

  if (shouldShowLoadingScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-xl font-bold mb-2">Carregando dados...</h2>
          <p className="text-muted-foreground text-sm">
            {!currentFloor && 'Carregando dados do andar...'}
            {!player.id && 'Carregando personagem...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* NOVO: Indicador sutil de carregamento de ação no topo */}
      {loading.performAction && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-muted-foreground">Processando...</span>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl">
        <BattleHeader
          currentFloor={{
            floorNumber: player.floor,
            type: currentFloor?.type || 'common',
            description: currentFloor?.description || `Andar ${player.floor}`,
            isCheckpoint: currentFloor?.isCheckpoint || false,
            minLevel: currentFloor?.minLevel || 1,
          }}
          playerLevel={player.level}
        />

        {/* Arena de Batalha */}
        <div className="mb-6 relative">
          {/* Quick Action Panel - Desktop */}
          {!isMobilePortrait && (
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-20 z-10 hidden lg:block">
              <QuickActionPanel
                handleAction={handleAction}
                isPlayerTurn={isPlayerTurn}
                loading={loading}
                player={player}
                onPlayerStatsUpdate={handlePlayerStatsUpdate}
                onPlayerConsumablesUpdate={handlePlayerConsumablesUpdate}
              />
            </div>
          )}

          {/* Quick Action Panel - Mobile */}
          {!isMobilePortrait && (
            <div className="fixed bottom-4 left-4 z-20 block lg:hidden">
              <QuickActionPanel
                handleAction={handleAction}
                isPlayerTurn={isPlayerTurn}
                loading={loading}
                player={player}
                onPlayerStatsUpdate={handlePlayerStatsUpdate}
                onPlayerConsumablesUpdate={handlePlayerConsumablesUpdate}
              />
            </div>
          )}

          <BattleArena
            player={player}
            currentEnemy={
              currentEnemy || {
                id: 'placeholder',
                name: gameState.battleRewards
                  ? 'Inimigo derrotado!'
                  : 'Preparando próximo inimigo...',
                level: 1,
                hp: 0,
                maxHp: 1,
                attack: 0,
                defense: 0,
                speed: 1,
                image: gameState.battleRewards ? '💀' : '⏳',
                behavior: 'balanced',
                mana: 0,
                reward_xp: 0,
                reward_gold: 0,
                possible_drops: [],
                active_effects: {
                  buffs: [],
                  debuffs: [],
                  dots: [],
                  hots: [],
                  attribute_modifications: [],
                },
              }
            }
            playerHpPercentage={battleStats.playerHpPercentage}
            playerManaPercentage={battleStats.playerManaPercentage}
            enemyHpPercentage={battleStats.enemyHpPercentage}
            isPlayerTurn={isPlayerTurn}
          />
        </div>

        {/* Interface de Batalha */}
        <div className="mb-6">
          <CombinedBattleInterface
            handleAction={handleAction}
            isPlayerTurn={isPlayerTurn}
            loading={loading}
            player={player}
            onPlayerStatsUpdate={handlePlayerStatsUpdate}
            onPlayerConsumablesUpdate={handlePlayerConsumablesUpdate}
            currentEnemy={currentEnemy}
            battleRewards={gameState.battleRewards}
          />
        </div>

        <GameLog gameLog={gameLog} />
      </div>

      <VictoryModal
        isOpen={showVictoryModal}
        onContinue={handleContinueAdventure}
        onReturnToHub={handleReturnToHub}
        onOpenAttributeModal={handleOpenAttributeModal}
        rewards={victoryRewards}
        leveledUp={victoryRewards.leveledUp}
        newLevel={victoryRewards.newLevel}
        hasAttributePoints={(player.attribute_points || 0) > 0}
      />

      <GameOverModal
        isOpen={showDeathModal}
        onClose={() => setShowDeathModal(false)}
        player={{
          id: player.id,
          name: player.name,
          level: player.level,
          floor: player.floor,
          hp: player.hp,
          max_hp: player.max_hp,
          xp: player.xp,
          gold: player.gold,
        }}
        gameMessage={`${player.name} foi derrotado no Andar ${player.floor}...`}
        highestFloor={player.floor}
        isCharacterDeleted={gameState.characterDeleted}
        userId={user?.id}
        onReturnToCharacterSelect={handleReturnToCharacterSelect}
        onViewCemetery={() => {
          navigate({ to: '/game/play/hub/cemetery', search: { character: player.id } });
        }}
      />

      <AttributeDistributionModal
        isOpen={showAttributeModal}
        onClose={() => {
          setShowAttributeModal(false);
          if (gameState.battleRewards && !showVictoryModal) {
            setShowVictoryModal(true);
          }
        }}
        character={player}
      />

      {/* Overlay de Fuga */}
      {showFleeOverlay && (
        <div className="fixed inset-0 z-50">
          <FleeOverlay
            isVisible={showFleeOverlay}
            isSuccess={fleeSuccess}
            playerName={player.name}
            enemyName={currentEnemy?.name}
            onComplete={handleFleeOverlayComplete}
          />
        </div>
      )}
    </>
  );
}
