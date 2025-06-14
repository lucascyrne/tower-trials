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
import { BattleInitializationService } from '@/resources/game/battle-initialization.service';

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

// CRITICAL: Hook estabilizado para controle de inicialização única
function useBattleInitialization(characterId: string | undefined, userId: string | undefined) {
  const initializationStateRef = useRef<{
    isInitialized: boolean;
    isInitializing: boolean;
    lastCharacterId: string | null;
    initPromise: Promise<void> | null;
    initCount: number; // NOVO: Contador para detectar loops
    lastInitTime: number; // NOVO: Timestamp da última inicialização
  }>({
    isInitialized: false,
    isInitializing: false,
    lastCharacterId: null,
    initPromise: null,
    initCount: 0,
    lastInitTime: 0,
  });

  const [initState, setInitState] = useState({
    isLoading: true,
    error: null as string | null,
    progress: { step: 'init', progress: 0, message: 'Preparando...' } as InitializationProgress,
  });

  const { initializeBattle: contextInitializeBattle, gameState, selectedCharacter } = useGame();

  // CRITICAL: Função estável de inicialização com proteção anti-loop
  const initializeBattle = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const state = initializationStateRef.current;

    // PROTEÇÃO: Detectar loops
    if (now - state.lastInitTime < 1000) {
      // Menos de 1 segundo desde última inicialização
      state.initCount++;
      console.warn(`[BattleInit] Possível loop detectado - tentativa ${state.initCount}`);

      if (state.initCount > 3) {
        console.error('[BattleInit] LOOP INFINITO DETECTADO - Abortando inicialização');
        setInitState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Loop infinito detectado na inicialização',
        }));
        return;
      }
    } else {
      state.initCount = 0; // Reset contador se passou tempo suficiente
    }

    state.lastInitTime = now;

    if (!characterId || !userId) {
      console.log('[BattleInit] Sem dados básicos para inicialização');
      setInitState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // NOVO: Verificar se já temos uma batalha inicializada para este personagem
    if (
      selectedCharacter?.id === characterId &&
      gameState.mode === 'battle' &&
      gameState.currentEnemy &&
      state.isInitialized
    ) {
      console.log(
        `[BattleInit] Batalha já inicializada para ${selectedCharacter.name} - reutilizando`
      );
      setInitState(prev => ({ ...prev, isLoading: false, error: null }));
      return;
    }

    // CRITICAL: Verificação mais rigorosa para evitar re-inicializações
    if (state.isInitializing) {
      console.log('[BattleInit] Já inicializando - aguardando promessa existente');
      if (state.initPromise) {
        await state.initPromise;
      }
      return;
    }

    if (state.isInitialized && state.lastCharacterId === characterId) {
      console.log('[BattleInit] Já inicializado para este personagem');
      setInitState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      console.log(`[BattleInit] === INICIANDO INICIALIZAÇÃO ÚNICA === (count: ${state.initCount})`);

      // Marcar como inicializando ANTES de qualquer operação async
      state.isInitializing = true;
      state.lastCharacterId = characterId;

      setInitState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      // Criar promessa de inicialização
      const initPromise = (async () => {
        // 1. Buscar dados do personagem (com cache)
        setInitState(prev => ({
          ...prev,
          progress: { step: 'character', progress: 25, message: 'Carregando personagem...' },
        }));

        const characterResponse = await CharacterService.getCharacter(characterId);
        if (!characterResponse.success || !characterResponse.data) {
          throw new Error(characterResponse.error || 'Personagem não encontrado');
        }

        // 2. OTIMIZADO: Usar dados do GamePlayer já carregados se disponíveis
        let gamePlayerData = null;
        if (selectedCharacter?.id === characterId && gameState.player?.id === characterId) {
          console.log(`[BattleInit] Reutilizando dados do GamePlayer em contexto`);
          gamePlayerData = gameState.player;
        }

        // 3. Inicializar batalha usando o serviço otimizado
        setInitState(prev => ({
          ...prev,
          progress: { step: 'battle', progress: 50, message: 'Inicializando batalha...' },
        }));

        const result = await BattleInitializationService.initializeBattle(
          characterResponse.data,
          progress => {
            setInitState(prev => ({ ...prev, progress }));
          },
          gamePlayerData // Passar dados já carregados
        );

        if (!result.success) {
          throw new Error(result.error || 'Falha na inicialização da batalha');
        }

        // 4. Aplicar no contexto apenas se necessário
        setInitState(prev => ({
          ...prev,
          progress: { step: 'context', progress: 90, message: 'Aplicando estado...' },
        }));

        // OTIMIZADO: Só chamar initializeBattle se realmente necessário
        const needsContextUpdate =
          !selectedCharacter ||
          selectedCharacter.id !== characterId ||
          gameState.mode !== 'battle' ||
          !gameState.currentEnemy;

        if (needsContextUpdate) {
          console.log(`[BattleInit] Aplicando contexto para ${characterResponse.data.name}`);
          await contextInitializeBattle(characterResponse.data, characterId);
        } else {
          console.log(`[BattleInit] Contexto já correto - pulando atualização`);
        }

        setInitState(prev => ({
          ...prev,
          progress: { step: 'complete', progress: 100, message: 'Batalha pronta!' },
        }));

        // CRITICAL: Marcar como inicializado APENAS no final
        state.isInitialized = true;
        state.isInitializing = false;

        setInitState(prev => ({ ...prev, isLoading: false, error: null }));

        console.log(`[BattleInit] === INICIALIZAÇÃO ÚNICA CONCLUÍDA ===`);
      })();

      state.initPromise = initPromise;
      await initPromise;
    } catch (error) {
      console.error('[BattleInit] Erro na inicialização:', error);

      // Reset do estado em caso de erro
      state.isInitialized = false;
      state.isInitializing = false;
      state.initPromise = null;

      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setInitState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [characterId, userId, contextInitializeBattle, selectedCharacter, gameState]);

  // IMPROVED: Reset mais conservador quando personagem muda
  const stableCharacterId = useRef(characterId);
  useEffect(() => {
    const state = initializationStateRef.current;

    // Só resetar se o characterId realmente mudou E não é apenas undefined->string
    if (characterId && stableCharacterId.current !== characterId) {
      console.log(
        `[BattleInit] Personagem mudou de "${stableCharacterId.current}" para "${characterId}" - resetando estado`
      );

      // Reset mais conservador
      state.isInitialized = false;
      state.isInitializing = false;
      state.initPromise = null;
      state.lastCharacterId = null;
      state.initCount = 0; // Reset contador de loops

      stableCharacterId.current = characterId;
    }
  }, [characterId]);

  return {
    initializeBattle,
    isLoading: initState.isLoading,
    error: initState.error,
    progress: initState.progress,
    isInitialized: initializationStateRef.current.isInitialized,
  };
}

// IMPROVED: Hook para slots com proteção mais robusta
function usePotionSlots(playerId: string | undefined) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const slotsStateRef = useRef<{
    isLoaded: boolean;
    isLoading: boolean;
    lastPlayerId: string | null;
    loadCount: number; // NOVO: Contador para detectar loops
  }>({
    isLoaded: false,
    isLoading: false,
    lastPlayerId: null,
    loadCount: 0,
  });

  const loadPotionSlots = useCallback(async (): Promise<void> => {
    const state = slotsStateRef.current;

    if (!playerId) {
      setLoadingSlots(false);
      return;
    }

    // PROTEÇÃO: Detectar loops de carregamento
    state.loadCount++;
    if (state.loadCount > 5) {
      console.error('[PotionSlots] Loop de carregamento detectado - abortando');
      setLoadingSlots(false);
      return;
    }

    // Evitar carregamentos duplicados
    if (state.isLoading || (state.isLoaded && state.lastPlayerId === playerId)) {
      console.log('[PotionSlots] Slots já carregados ou carregando');
      return;
    }

    try {
      console.log(
        `[PotionSlots] Carregando slots para player: ${playerId} (tentativa ${state.loadCount})`
      );

      state.isLoading = true;
      state.lastPlayerId = playerId;
      setLoadingSlots(true);

      const response = await SlotService.getCharacterPotionSlots(playerId);

      if (response.success && response.data) {
        setPotionSlots(response.data);
        state.isLoaded = true;
        state.loadCount = 0; // Reset contador em caso de sucesso
        console.log(`[PotionSlots] ${response.data.length} slots carregados`);
      } else {
        console.warn('[PotionSlots] Falha ao carregar - usando slots vazios');
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
        state.isLoaded = true;
      }
    } catch (error) {
      console.error('[PotionSlots] Erro ao carregar slots:', error);
      // Usar slots vazios como fallback
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
      state.isLoaded = true;
    } finally {
      state.isLoading = false;
      setLoadingSlots(false);
    }
  }, [playerId]);

  // IMPROVED: Reset mais estável quando player muda
  const stablePlayerId = useRef(playerId);
  useEffect(() => {
    const state = slotsStateRef.current;

    // Só resetar se playerId realmente mudou E é válido
    if (playerId && stablePlayerId.current !== playerId) {
      console.log(
        `[PotionSlots] Player mudou de "${stablePlayerId.current}" para "${playerId}" - resetando slots`
      );

      state.isLoaded = false;
      state.isLoading = false;
      state.lastPlayerId = null;
      state.loadCount = 0; // Reset contador
      setPotionSlots([]);
      setLoadingSlots(true);

      stablePlayerId.current = playerId;
    }
  }, [playerId]);

  return {
    potionSlots,
    loadingSlots,
    loadPotionSlots,
    reloadSlots: async () => {
      slotsStateRef.current.isLoaded = false;
      slotsStateRef.current.loadCount = 0; // Reset contador para reload manual
      await loadPotionSlots();
    },
  };
}

// NOVO: Hook para controlar quando é seguro inicializar
function useBattleInitializationGuard(
  characterId: string | undefined,
  gameState: { mode: string; currentEnemy?: { id: string } | null; player?: { id: string } }
) {
  const [canInitialize, setCanInitialize] = useState(false);
  const lastStateRef = useRef<{
    characterId: string | undefined;
    mode: string;
    enemyId: string | undefined;
    playerId: string | undefined;
  }>({
    characterId: undefined,
    mode: '',
    enemyId: undefined,
    playerId: undefined,
  });

  useEffect(() => {
    const currentState = {
      characterId,
      mode: gameState.mode,
      enemyId: gameState.currentEnemy?.id,
      playerId: gameState.player?.id,
    };

    const lastState = lastStateRef.current;

    // Permitir inicialização se:
    // 1. Temos characterId válido
    // 2. E alguma das condições mudou de forma significativa
    const shouldAllow =
      Boolean(characterId) &&
      // Primeira vez
      (!lastState.characterId ||
        // Personagem mudou
        lastState.characterId !== characterId ||
        // Estava em outro modo e agora não está em battle
        (lastState.mode !== 'battle' && currentState.mode !== 'battle') ||
        // Não tem inimigo mas deveria ter (em battle)
        (currentState.mode === 'battle' && !currentState.enemyId));

    if (shouldAllow !== canInitialize) {
      console.log(
        `[BattleGuard] Mudando permissão de inicialização: ${canInitialize} -> ${shouldAllow}`,
        {
          characterId,
          mode: currentState.mode,
          hasEnemy: Boolean(currentState.enemyId),
          reason: !lastState.characterId
            ? 'primeira vez'
            : lastState.characterId !== characterId
              ? 'personagem mudou'
              : lastState.mode !== 'battle' && currentState.mode !== 'battle'
                ? 'não estava em batalha'
                : currentState.mode === 'battle' && !currentState.enemyId
                  ? 'sem inimigo'
                  : 'outras condições',
        }
      );
      setCanInitialize(shouldAllow);
    }

    lastStateRef.current = currentState;
  }, [
    characterId,
    gameState.mode,
    gameState.currentEnemy?.id,
    gameState.player?.id,
    canInitialize,
  ]);

  return canInitialize;
}

export default function GameBattle() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gameState, performAction, loading, addGameLogMessage, updatePlayerStats, gameLog } =
    useGame();
  const { player, currentEnemy, currentFloor, isPlayerTurn } = gameState;

  const { character: characterId } = useParams({
    from: '/_authenticated/game/play/hub/battle/$character',
  });

  // DEBUGGING: Log para detectar mudanças de characterId
  const prevCharacterIdRef = useRef<string | undefined>(characterId);
  useEffect(() => {
    if (prevCharacterIdRef.current !== characterId) {
      console.log(
        `[GameBattle] CharacterId mudou: "${prevCharacterIdRef.current}" -> "${characterId}"`
      );
      prevCharacterIdRef.current = characterId;
    }
  }, [characterId]);

  // DEBUGGING: Log para detectar mudanças no player
  const prevPlayerIdRef = useRef<string>(player.id);
  useEffect(() => {
    if (prevPlayerIdRef.current !== player.id) {
      console.log(`[GameBattle] Player.id mudou: "${prevPlayerIdRef.current}" -> "${player.id}"`);
      prevPlayerIdRef.current = player.id;
    }
  }, [player.id]);

  // NOVO: Usar hooks personalizados para controle robusto
  const {
    initializeBattle,
    isLoading: initLoading,
    error: initError,
    progress: initProgress,
    isInitialized,
  } = useBattleInitialization(characterId, user?.id);

  const canInitialize = useBattleInitializationGuard(characterId, gameState);

  const { potionSlots, loadingSlots, loadPotionSlots, reloadSlots } = usePotionSlots(player.id);

  // Estados do componente - SIMPLIFICADOS
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showFleeOverlay, setShowFleeOverlay] = useState(false);
  const [fleeSuccess, setFleeSuccess] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [, setShowRetryInterface] = useState(false);
  const [victoryRewards, setVictoryRewards] = useState<BattleRewards>({
    xp: 0,
    gold: 0,
    drops: [],
    leveledUp: false,
    newLevel: 0,
  });

  // Ref para controle de montagem
  const mountedRef = useRef(true);
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Inicialização única no mount COM PROTEÇÃO ADICIONAL
  useEffect(() => {
    console.log('[GameBattle] Componente montado');
    mountedRef.current = true;

    // CRITICAL: Só inicializar se temos todos os dados necessários E permissão do guard
    if (!characterId || !user?.id || !canInitialize) {
      console.log('[GameBattle] Aguardando condições para inicialização...', {
        hasCharacterId: Boolean(characterId),
        hasUserId: Boolean(user?.id),
        canInitialize,
      });
      return;
    }

    // NOVO: Verificar se já estamos inicializados para este personagem
    if (isInitialized && player.id === characterId) {
      console.log('[GameBattle] Já inicializado para este personagem - pulando');
      return;
    }

    // IMPROVED: Delay maior e verificação mais rigorosa
    initTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !isInitialized && characterId && user?.id && canInitialize) {
        console.log('[GameBattle] Executando inicialização única após delay');
        initializeBattle().catch(error => {
          console.error('[GameBattle] Erro na inicialização única:', error);
        });
      } else {
        console.log('[GameBattle] Inicialização cancelada - condições não atendidas');
      }
    }, 200);

    return () => {
      console.log('[GameBattle] Componente desmontado');
      mountedRef.current = false;
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
        initTimerRef.current = null;
      }
    };
  }, [characterId, user?.id, isInitialized, player.id, initializeBattle, canInitialize]); // CORRIGIDO: Dependências corretas

  // CRITICAL: Carregar slots após inicialização da batalha COM DELAY MAIOR
  useEffect(() => {
    if (isInitialized && player.id && !loadingSlots) {
      const slotsTimer = setTimeout(() => {
        if (mountedRef.current) {
          console.log('[GameBattle] Carregando slots após inicialização');
          loadPotionSlots().catch(error => {
            console.error('[GameBattle] Erro ao carregar slots (não crítico):', error);
          });
        }
      }, 500); // Delay aumentado para 500ms

      return () => clearTimeout(slotsTimer);
    }
  }, [isInitialized, player.id, loadingSlots, loadPotionSlots]);

  // OTIMIZADO: Stats memorizados para evitar recálculos
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

  // ESTÁVEL: Processamento de recompensas com dependências fixas
  useEffect(() => {
    if (!gameState.battleRewards || showVictoryModal) return;

    if (!gameState.battleRewards.xp && !gameState.battleRewards.gold) {
      console.log('[GameBattle] Recompensas inválidas - ignorando');
      return;
    }

    console.log('[GameBattle] Processando recompensa de vitória');
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
  }, [gameState.battleRewards?.xp, gameState.battleRewards?.gold, showVictoryModal]); // CRITICAL: Dependências específicas

  // ESTÁVEL: Verificação de game over
  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0 && !showDeathModal) {
      console.log('[GameBattle] Personagem morreu - exibindo modal');
      setShowDeathModal(true);

      if (gameState.characterDeleted) {
        addGameLogMessage(
          `${player.name} foi perdido permanentemente. O sistema de Permadeath está ativo.`,
          'system'
        );
      }
    }
  }, [gameState.mode, player.hp, gameState.characterDeleted, showDeathModal]);

  // OTIMIZADO: Detecção de fuga
  useEffect(() => {
    const isFugaDetected = gameState.mode === 'fled' || gameState.fleeSuccessful === true;

    if (isFugaDetected && !showFleeOverlay) {
      console.log('[GameBattle] Fuga detectada');
      const isSuccess = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
      setFleeSuccess(isSuccess);
      setShowFleeOverlay(true);
    }
  }, [gameState.mode, gameState.fleeSuccessful, showFleeOverlay]);

  // OTIMIZADO: Detecção de orientação
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsMobilePortrait(isMobile && isPortrait);
    };

    checkOrientation();
    const handleResize = () => checkOrientation();
    const handleOrientationChange = () => checkOrientation();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Modal de atributos
  useEffect(() => {
    const handleOpenAttributeModal = () => setShowAttributeModal(true);
    window.addEventListener('openAttributeModal', handleOpenAttributeModal);
    return () => window.removeEventListener('openAttributeModal', handleOpenAttributeModal);
  }, []);

  // ESTÁVEL: Funções de ação com useCallback
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
      console.log(`[GameBattle] Atualizando stats: HP ${newHp}, Mana ${newMana}`);
      updatePlayerStats(newHp, newMana);

      if (gameState.player.id) {
        CharacterService.updateCharacterHpMana(gameState.player.id, newHp, newMana)
          .then(result => {
            if (!result.success) {
              console.error('[GameBattle] Erro ao atualizar stats no banco:', result.error);
              toast.error('Erro ao atualizar status do personagem');
            }
          })
          .catch((error: Error) => {
            console.error('[GameBattle] Erro ao atualizar stats:', error);
            toast.error('Erro ao atualizar status do personagem');
          });
      }
    },
    [updatePlayerStats, gameState.player.id]
  );

  const handleContinueAdventure = useCallback(async () => {
    setShowVictoryModal(false);
    try {
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

  const handleManualRetry = useCallback(async () => {
    console.log('[GameBattle] Retry manual iniciado');
    setShowRetryInterface(false);
    await initializeBattle();
  }, [initializeBattle]);

  // Interface de erro com retry
  if (initError && !isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center max-w-lg">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Falha na Inicialização da Batalha</h2>

          <div className="bg-card rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Detalhes do Erro:</h3>
            <p className="text-sm text-muted-foreground mb-4">{initError}</p>
            <div className="flex justify-between text-sm">
              <span>Última etapa:</span>
              <span>{initProgress.step}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={handleManualRetry} className="w-full" size="lg">
              🔄 Tentar Novamente
            </Button>
            <Button
              onClick={() => navigate({ to: '/game/play' })}
              variant="secondary"
              className="w-full"
            >
              🏠 Voltar ao Hub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Interface de loading
  if (initLoading || !isInitialized) {
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
          </div>

          <Button onClick={() => navigate({ to: '/game/play' })} variant="ghost" size="sm">
            Cancelar e Voltar
          </Button>
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
                loadingPotionSlots={loadingSlots}
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
                loadingPotionSlots={loadingSlots}
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
            loadingPotionSlots={loadingSlots}
            onSlotsChange={reloadSlots}
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
