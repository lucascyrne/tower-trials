import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useGame } from '@/resources/game/game-hook';
import { type ActionType } from '@/resources/game/game-model';
import { BattleArena } from './BattleArena';
import { CombinedBattleInterface } from './CombinedBattleInterface';
import { VictoryModal } from './VictoryModal';
import { GameOverModal } from './GameOverModal';
import { toast } from 'sonner';
import AttributeDistributionModal from './AttributeDistributionModal';
import { useAuth } from '@/resources/auth/auth-hook';

import { BattleHeader } from './BattleHeader';
import { GameLog } from './GameLog';
import { CharacterService } from '@/resources/game/character.service';
import { QuickActionPanel } from './QuickActionPanel';
import { FleeOverlay } from './FleeOverlay';
import { SlotService, type PotionSlot } from '@/resources/game/slot.service';
import { Button } from '@/components/ui/button';

interface BattleRewards {
  xp: number;
  gold: number;
  drops: { name: string; quantity: number }[];
  leveledUp: boolean;
  newLevel?: number;
}

interface InitializationProgress {
  step: string;
  progress: number;
  message: string;
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

  // NOVO: Estados para sistema de inicialização robusto
  const [initProgress, setInitProgress] = useState<InitializationProgress>({
    step: 'init',
    progress: 0,
    message: 'Preparando...',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(5);
  const [showRetryInterface, setShowRetryInterface] = useState(false);

  // Estados para slots de poção
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingPotionSlots, setLoadingPotionSlots] = useState(true);
  const slotsLoadedRef = useRef(false);

  // Sistema de controle de inicialização
  const battleInitializedRef = useRef(false);
  const mountedRef = useRef(false);
  const currentCharacterRef = useRef<string | null>(null);
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastInitTimestamp = useRef<number>(0);
  const INIT_COOLDOWN = 5000; // 5 segundos entre inicializações

  const { character: characterId } = useParams({
    from: '/_authenticated/game/play/hub/battle/$character',
  });

  // CORRIGIDO: Função para carregar slots de poção SEM useCallback problemático
  const loadPotionSlots = useCallback(async () => {
    if (!player.id) {
      console.log('[GameBattle] Sem player.id para carregar slots');
      return;
    }

    // CRÍTICO: Verificar se já está carregando para evitar múltiplas requisições
    if (slotsLoadedRef.current || loadingPotionSlots) {
      console.log('[GameBattle] Slots já carregados ou carregando, pulando...');
      return;
    }

    try {
      console.log('[GameBattle] Carregando slots de poção para player:', player.id);
      setLoadingPotionSlots(true);

      const response = await SlotService.getCharacterPotionSlots(player.id);

      if (response.success && response.data) {
        console.log('[GameBattle] Slots carregados com sucesso:', {
          slotsCount: response.data.length,
          hasError: !!response.error,
          errorMessage: response.error,
          slots: response.data.map(s => ({
            position: s.slot_position,
            consumableId: s.consumable_id,
            name: s.consumable_name,
            isEmpty: !s.consumable_id,
          })),
        });

        setPotionSlots(response.data);
        slotsLoadedRef.current = true;

        if (response.error && response.error.includes('fallback')) {
          toast.warning('Slots de poção carregados em modo simplificado', {
            description: 'Algumas funcionalidades podem estar limitadas',
            duration: 3000,
          });
        }
      } else {
        console.error('[GameBattle] Falha ao carregar slots:', response.error);
        const emptySlots = Array.from({ length: 3 }, (_, i) => ({
          slot_position: i + 1,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        }));
        setPotionSlots(emptySlots);
        slotsLoadedRef.current = true;
      }
    } catch (error) {
      console.error('[GameBattle] Erro crítico ao carregar slots de poção:', error);
      const emptySlots = Array.from({ length: 3 }, (_, i) => ({
        slot_position: i + 1,
        consumable_id: null,
        consumable_name: null,
        consumable_description: null,
        effect_value: null,
        consumable_type: null,
        available_quantity: 0,
        consumable_price: null,
      }));
      setPotionSlots(emptySlots);
      slotsLoadedRef.current = true;
    } finally {
      setLoadingPotionSlots(false);
    }
  }, [player.id]); // CRÍTICO: Adicionar player.id como dependência

  // CORRIGIDO: Sistema de inicialização robusto com proteção contra loop
  const initializeBattleRobust = useCallback(async () => {
    const now = Date.now();

    // Proteção temporal contra re-inicializações
    if (now - lastInitTimestamp.current < INIT_COOLDOWN) {
      console.log('[GameBattle] Aguardando cooldown de inicialização...');
      return;
    }

    if (!user?.id || !characterId || !mountedRef.current) {
      console.log('[GameBattle] Condições básicas não atendidas para inicialização robusta');
      return;
    }

    if (battleInitializedRef.current && currentCharacterRef.current === characterId) {
      console.log('[GameBattle] Batalha já inicializada para este personagem');
      return;
    }

    lastInitTimestamp.current = now;

    try {
      console.log(`[GameBattle] === INICIALIZAÇÃO ROBUSTA INICIADA ===`);
      setIsLoading(true);
      setInitializationError(null);
      setShowRetryInterface(false);
      setRetryCount(0);
      battleInitializedRef.current = true;
      currentCharacterRef.current = characterId;

      // Buscar dados básicos do personagem primeiro
      const characterResponse = await CharacterService.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Personagem não encontrado');
      }

      // Usar o serviço robusto de inicialização
      const { BattleInitializationService } = await import(
        '@/resources/game/battle-initialization.service'
      );

      const result = await BattleInitializationService.initializeBattle(
        characterResponse.data,
        progress => {
          setInitProgress(progress);
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Falha na inicialização robusta');
      }

      if (!result.gameState) {
        throw new Error('Estado de jogo não foi gerado');
      }

      // Usar initializeBattle do provider para aplicar o estado
      await initializeBattle(characterResponse.data, characterId);

      setIsLoading(false);
      setInitializationError(null);
      console.log(`[GameBattle] === INICIALIZAÇÃO ROBUSTA CONCLUÍDA COM SUCESSO ===`);
    } catch (error) {
      console.error('[GameBattle] Erro na inicialização robusta:', error);

      battleInitializedRef.current = false;
      currentCharacterRef.current = null;
      lastInitTimestamp.current = 0; // Reset cooldown em caso de erro

      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setInitializationError(errorMessage);
      setShowRetryInterface(true);
    }
  }, [user?.id, characterId, initializeBattle]); // CRÍTICO: Readicionar initializeBattle mas memoizar corretamente

  // NOVO: Função para retry manual
  const handleManualRetry = useCallback(async () => {
    console.log('[GameBattle] Iniciando retry manual...');
    battleInitializedRef.current = false;
    currentCharacterRef.current = null;
    lastInitTimestamp.current = 0; // Reset cooldown para retry manual
    setShowRetryInterface(false);
    await initializeBattleRobust();
  }, []);

  // NOVO: Função para health check
  const performHealthCheck = useCallback(async () => {
    try {
      const { BattleInitializationService } = await import(
        '@/resources/game/battle-initialization.service'
      );
      const health = await BattleInitializationService.healthCheck();

      console.log('[GameBattle] Health check resultado:', health);

      if (!health.healthy) {
        toast.warning('Alguns serviços estão indisponíveis', {
          description: health.issues.join(', '),
          duration: 5000,
        });
      }

      return health.healthy;
    } catch (error) {
      console.error('[GameBattle] Erro no health check:', error);
      return false;
    }
  }, []);

  // Memorizar percentuais para evitar recálculos desnecessários
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

  // Controle de montagem
  useEffect(() => {
    mountedRef.current = true;
    console.log('[GameBattle] Componente montado');

    return () => {
      console.log('[GameBattle] Componente desmontado - limpando recursos');
      mountedRef.current = false;
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
        initializationTimeout.current = null;
      }
    };
  }, []);

  // CRÍTICO: Inicialização principal - SIMPLIFICADA E ESTÁVEL
  useEffect(() => {
    if (!mountedRef.current || !user?.id || !characterId || loading.loadProgress) {
      return;
    }

    // Evitar múltiplas inicializações
    if (battleInitializedRef.current) {
      return;
    }

    // CRÍTICO: Delay maior para estabilização
    const initTimer = setTimeout(() => {
      if (mountedRef.current && !battleInitializedRef.current) {
        initializeBattleRobust().catch(error => {
          console.error('[GameBattle] Erro na inicialização:', error);
        });
      }
    }, 500); // Aumentar delay para 500ms

    return () => clearTimeout(initTimer);
  }, [user?.id, characterId]); // CRÍTICO: Remover loading.loadProgress

  // CORRIGIDO: Processamento de recompensas - DEPENDÊNCIAS ESTÁVEIS
  useEffect(() => {
    if (!gameState.battleRewards || showVictoryModal) return;

    // CRÍTICO: Verificar se realmente há recompensas válidas
    if (!gameState.battleRewards.xp && !gameState.battleRewards.gold) {
      console.log(`[GameBattle] Recompensas inválidas ou vazias - ignorando`);
      return;
    }

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
  }, [gameState.battleRewards, showVictoryModal, addGameLogMessage]); // CRÍTICO: Remover dependências instáveis

  // CORRIGIDO: Verificação de game over - DEPENDÊNCIAS ESTÁVEIS
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
  }, [gameState.mode, player.hp, gameState.characterDeleted, showDeathModal, addGameLogMessage]); // CRÍTICO: Remover player.name

  // OTIMIZADO: Sistema de detecção de fuga mais eficiente
  useEffect(() => {
    const isFugaDetected = gameState.mode === 'fled' || gameState.fleeSuccessful === true;

    if (isFugaDetected && !showFleeOverlay) {
      console.log('[GameBattle] Fuga detectada - ativando overlay');

      const isSuccess = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
      setFleeSuccess(isSuccess);
      setShowFleeOverlay(true);
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

  // Função para executar ações
  const handleAction = useCallback(
    async (action: ActionType, spellId?: string, consumableId?: string) => {
      try {
        await performAction(action, spellId, consumableId);
      } catch (error) {
        console.error(`[GameBattle] Erro ao executar ação '${action}':`, error);
        toast.error(`Erro ao executar ação: ${action}`);
      }
    },
    [performAction]
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
    setShowVictoryModal(false);
    try {
      console.log("[GameBattle] Chamando performAction('continue')...");
      await handleAction('continue');
    } catch (error) {
      console.error('[GameBattle] Erro ao avançar:', error);
      toast.error('Erro ao avançar para o próximo andar');
      setShowVictoryModal(true);
    }
  }, [handleAction]);

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

  // Carregar slots de poção de forma mais controlada
  useEffect(() => {
    if (player.id && !slotsLoadedRef.current) {
      // Delay maior para evitar conflito com inicialização
      const slotsTimer = setTimeout(() => {
        if (mountedRef.current && !slotsLoadedRef.current) {
          loadPotionSlots().catch(error => {
            console.error('[GameBattle] Erro ao carregar slots (não crítico):', error);
            setLoadingPotionSlots(false);
          });
        }
      }, 1000);

      return () => clearTimeout(slotsTimer);
    }
  }, [player.id]);

  // NOVO: Interface de retry com informações detalhadas
  if (showRetryInterface && initializationError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center max-w-lg">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Falha na Inicialização da Batalha</h2>

          <div className="bg-card rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Detalhes do Erro:</h3>
            <p className="text-sm text-muted-foreground mb-4">{initializationError}</p>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tentativas realizadas:</span>
                <span>
                  {retryCount}/{maxRetries}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Última etapa:</span>
                <span>{initProgress.step}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={handleManualRetry} className="w-full" size="lg">
              🔄 Tentar Novamente
            </Button>

            <Button onClick={performHealthCheck} variant="outline" className="w-full">
              🏥 Verificar Sistema
            </Button>

            <Button
              onClick={() => navigate({ to: '/game/play' })}
              variant="secondary"
              className="w-full"
            >
              🏠 Voltar ao Hub
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Se o problema persistir, verifique sua conexão com a internet
          </p>
        </div>
      </div>
    );
  }

  // Interface de loading aprimorada
  if (isLoading || !battleInitializedRef.current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center max-w-md">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>

          <h2 className="text-2xl font-bold mb-2">Inicializando Batalha</h2>

          <div className="bg-card rounded-lg p-4 mb-4">
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{initProgress.message}</span>
                <span>{initProgress.progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${initProgress.progress}%` }}
                />
              </div>
            </div>

            {retryCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Tentativa {retryCount}/{maxRetries}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => setShowRetryInterface(true)}
              variant="outline"
              size="sm"
              disabled={retryCount === 0}
            >
              Mostrar Detalhes
            </Button>

            <Button onClick={() => navigate({ to: '/game/play' })} variant="ghost" size="sm">
              Cancelar e Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
                potionSlots={potionSlots}
                loadingPotionSlots={loadingPotionSlots}
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
                potionSlots={potionSlots}
                loadingPotionSlots={loadingPotionSlots}
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
            currentEnemy={currentEnemy}
            battleRewards={gameState.battleRewards}
            potionSlots={potionSlots}
            loadingPotionSlots={loadingPotionSlots}
            onSlotsChange={loadPotionSlots}
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
