import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { type ActionType, type GamePlayer } from '@/models/game.model';
import { BattleArena } from './BattleArena';
import { CombinedBattleInterface } from './CombinedBattleInterface';
import { VictoryModal } from './VictoryModal';
import { GameOverModal } from './GameOverModal';
import { toast } from 'sonner';
import { useAuth } from '@/resources/auth/auth-hook';
import { useBattleStore } from '@/stores/useBattleStore';
import { useGameStateStore } from '@/stores/useGameStateStore';
import { useLogStore } from '@/stores/useLogStore';

import { BattleHeader } from './BattleHeader';
import { GameLog } from './GameLog';
import { CharacterService } from '@/services/character.service';
import { FleeOverlay } from './FleeOverlay';
import { type PotionSlot } from '@/services/slot.service';
import { Button } from '@/components/ui/button';
import { BattleInitializationService } from '@/services/battle-initialization.service';
import { QuickActionPanel } from '../character/QuickActionPanel';
import AttributeDistributionModal from '../character/AttributeDistributionModal';
import { useBattleLandscape } from '@/hooks/useMediaQuery';
import { GameLogModal } from './GameLogModal';

interface BattleRewards {
  xp: number;
  gold: number;
  drops: { name: string; quantity: number }[];
  leveledUp: boolean;
  newLevel?: number;
}

// CRITICAL: Hook estabilizado para controle de inicialização única - VERSÃO SIMPLIFICADA
function useBattleInitialization(
  characterId: string | undefined,
  userId: string | undefined,
  markAsInitialized?: () => void
) {
  // ✅ CORREÇÃO: Usar apenas refs para estado interno - SEM useState
  const stateRef = useRef<{
    isInitialized: boolean;
    isInitializing: boolean;
    lastCharacterId: string | null;
    hasError: boolean;
    errorMessage: string | null;
  }>({
    isInitialized: false,
    isInitializing: false,
    lastCharacterId: null,
    hasError: false,
    errorMessage: null,
  });

  // ✅ CORREÇÃO: Usar ref para markAsInitialized para evitar dependência instável
  const markAsInitializedRef = useRef(markAsInitialized);
  markAsInitializedRef.current = markAsInitialized;

  // ✅ CORREÇÃO: Usar ref para store action para evitar dependência instável
  const setGameStateRef = useRef(useGameStateStore.getState().setGameState);

  // Atualizar a ref sempre que o hook roda (mas não causa re-render)
  setGameStateRef.current = useGameStateStore.getState().setGameState;

  // ✅ CORREÇÃO: Estado mínimo - APENAS para loading e error da UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ CORREÇÃO: Função estável sem dependências do useGame
  const initializeBattle = useCallback(async (): Promise<void> => {
    const state = stateRef.current;

    // Verificações básicas
    if (!characterId || !userId) {
      setIsLoading(false);
      return;
    }

    // Evitar re-inicialização
    if (state.isInitialized && state.lastCharacterId === characterId) {
      setIsLoading(false);
      return;
    }

    if (state.isInitializing) {
      return;
    }

    try {
      state.isInitializing = true;
      state.lastCharacterId = characterId;
      setIsLoading(true);
      setError(null);

      // Buscar personagem
      const characterResponse = await CharacterService.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error(characterResponse.error || 'Personagem não encontrado');
      }

      // ✅ CRÍTICO: Limpar logs antes de inicializar nova batalha
      const { LoggingUtils } = await import('@/utils/logging-utils');
      LoggingUtils.clearAllLogs();

      // Inicializar batalha
      const result = await BattleInitializationService.initializeBattle(characterResponse.data);

      if (!result.success) {
        throw new Error(result.error || 'Falha na inicialização da batalha');
      }

      // ✅ CORREÇÃO CRÍTICA: Aplicar o gameState retornado na store
      if (result.gameState) {
        setGameStateRef.current(result.gameState);
      } else {
        throw new Error('gameState não foi retornado pelo BattleInitializationService');
      }

      // Sucesso
      state.isInitialized = true;
      state.hasError = false;
      state.errorMessage = null;

      // ✅ CORREÇÃO: Usar ref para evitar dependência
      if (markAsInitializedRef.current) {
        markAsInitializedRef.current();
      }
    } catch (error) {
      state.hasError = true;
      state.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(state.errorMessage);
    } finally {
      state.isInitializing = false;
      setIsLoading(false);
    }
  }, [characterId, userId]); // ✅ CORREÇÃO CRÍTICA: Apenas valores primitivos estáveis

  return {
    initializeBattle,
    isLoading,
    error,
    isInitialized: stateRef.current.isInitialized,
    progress: { step: 'ready', progress: 100, message: 'Pronto' }, // ✅ CORREÇÃO: Progresso fixo
  };
}

// ✅ CORREÇÃO: Hook simplificado para guard - SEM useMemo problemático
function useBattleInitializationGuard(characterId: string | undefined) {
  const guardRef = useRef<{
    initialized: Set<string>;
    lastCharacterId: string | null;
    canInitialize: boolean;
  }>({
    initialized: new Set(),
    lastCharacterId: null,
    canInitialize: true,
  });

  // ✅ CORREÇÃO: Calcular canInitialize sem useMemo para evitar loops
  if (characterId && guardRef.current.lastCharacterId !== characterId) {
    guardRef.current.lastCharacterId = characterId;
    guardRef.current.canInitialize = !guardRef.current.initialized.has(characterId);
  }

  const markAsInitialized = useCallback(() => {
    if (characterId) {
      guardRef.current.initialized.add(characterId);
      guardRef.current.canInitialize = false;
    }
  }, [characterId]);

  return {
    canInitialize: characterId ? guardRef.current.canInitialize : false,
    markAsInitialized,
  };
}

// ✅ CORREÇÃO: Hook simplificado para evitar re-renders constantes
function usePotionSlots(playerId: string | undefined) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ✅ CORREÇÃO: Usar ref para valores estáveis
  const loadingSlotsRef = useRef(false);
  const playerIdRef = useRef<string | undefined>(undefined);

  // ✅ CORREÇÃO: Sincronizar refs
  loadingSlotsRef.current = loadingSlots;
  playerIdRef.current = playerId;

  // ✅ CORREÇÃO: Função estável que não causa re-renders
  const loadPotionSlots = useCallback(async (): Promise<void> => {
    const currentPlayerId = playerIdRef.current;
    const currentLoading = loadingSlotsRef.current;

    if (!currentPlayerId || currentLoading) {
      return;
    }

    try {
      setLoadingSlots(true);
      const { SlotService } = await import('@/services/slot.service');
      const result = await SlotService.getCharacterPotionSlots(currentPlayerId);

      if (result.success && result.data) {
        setPotionSlots(result.data);
      } else {
        setPotionSlots([
          {
            slot_position: 1,
            consumable_id: null,
            consumable_name: null,
            consumable_description: null,
            effect_value: null,
            consumable_type: null,
            available_quantity: 0,
            consumable_price: null,
          },
          {
            slot_position: 2,
            consumable_id: null,
            consumable_name: null,
            consumable_description: null,
            effect_value: null,
            consumable_type: null,
            available_quantity: 0,
            consumable_price: null,
          },
          {
            slot_position: 3,
            consumable_id: null,
            consumable_name: null,
            consumable_description: null,
            effect_value: null,
            consumable_type: null,
            available_quantity: 0,
            consumable_price: null,
          },
        ]);
      }
    } catch {
      setPotionSlots([
        {
          slot_position: 1,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
        {
          slot_position: 2,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
        {
          slot_position: 3,
          consumable_id: null,
          consumable_name: null,
          consumable_description: null,
          effect_value: null,
          consumable_type: null,
          available_quantity: 0,
          consumable_price: null,
        },
      ]);
    } finally {
      setLoadingSlots(false);
    }
  }, []); // ✅ CORREÇÃO CRÍTICA: Sem dependências para evitar recriação

  // ✅ CORREÇÃO: reloadSlots com invalidação de cache
  const reloadSlots = useCallback(async () => {
    const currentPlayerId = playerIdRef.current;
    if (currentPlayerId) {
      const { SlotService } = await import('@/services/slot.service');
      SlotService.invalidateCache(currentPlayerId);

      await loadPotionSlots();
    }
  }, [loadPotionSlots]); // ✅ CORREÇÃO: loadPotionSlots agora é estável

  return {
    potionSlots,
    loadingSlots,
    loadPotionSlots,
    reloadSlots,
  };
}

export default function GameBattle() {
  // 🚨 DEBUG: Contador de renders
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ CORREÇÃO: Seletores específicos sem dependências circulares
  const player = useGameStateStore(state => state.gameState.player);
  const currentEnemy = useGameStateStore(state => state.gameState.currentEnemy);
  const currentFloor = useGameStateStore(state => state.gameState.currentFloor);
  const isPlayerTurn = useGameStateStore(state => state.gameState.isPlayerTurn);
  const mode = useGameStateStore(state => state.gameState.mode);
  const battleRewards = useGameStateStore(state => state.gameState.battleRewards);
  const characterDeleted = useGameStateStore(state => state.gameState.characterDeleted);
  const fleeSuccessful = useGameStateStore(state => state.gameState.fleeSuccessful);
  const loading = useGameStateStore(state => state.loading);
  const gameLogs = useLogStore(state => state.gameLogs);
  const addGameLogMessage = useLogStore(state => state.addGameLogMessage);

  // ✅ CORREÇÃO: Usar actions específicas sem expor o store inteiro
  const performAction = useBattleStore(state => state.performAction);
  const updatePlayerStats = useGameStateStore(state => state.updatePlayerStats);

  // Variáveis já declaradas acima via seletores específicos

  const { character: characterId } = useParams({
    from: '/_authenticated/game/play/hub/battle/$character',
  });

  // REMOVIDO: Efeitos de debug desnecessários que causavam re-renders

  // CORRIGIDO: Hook guard primeiro para ter markAsInitialized disponível
  const { canInitialize, markAsInitialized } = useBattleInitializationGuard(characterId);

  // NOVO: Usar hooks personalizados para controle robusto
  const {
    initializeBattle,
    isLoading: initLoading,
    error: initError,
    progress: initProgress,
    isInitialized,
  } = useBattleInitialization(characterId, user?.id, markAsInitialized);

  // ✅ CORREÇÃO: Usar ref para função de inicialização
  const initializeBattleRef = useRef(initializeBattle);
  initializeBattleRef.current = initializeBattle;

  const { potionSlots, loadingSlots, loadPotionSlots, reloadSlots } = usePotionSlots(player?.id);

  // ✅ NOVO: Tratamento de erro de inicialização - redirecionar ao hub
  useEffect(() => {
    if (initError && initError.includes('Dados do banco inválidos')) {
      console.error('[GameBattle] ❌ Erro crítico de carregamento de monstro:', initError);
      toast.error('Erro ao carregar inimigo', {
        description: 'Retornando ao hub. Por favor, tente novamente.',
      });
      navigate({ to: '/game/play/hub', search: { character: characterId } });
    } else if (initError && initError.includes('Falha ao')) {
      console.error('[GameBattle] ❌ Erro ao inicializar batalha:', initError);
      toast.error('Erro ao inicializar batalha', {
        description: 'Retornando ao hub.',
      });
      navigate({ to: '/game/play/hub', search: { character: characterId } });
    }
  }, [initError, navigate, characterId]);

  // ✅ CORREÇÃO: Ref para controlar se componente está montado
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ CORREÇÃO: Efeito para carregar slots quando player muda
  useEffect(() => {
    if (player?.id) {
      loadPotionSlots().catch(error => {
        console.error('[GameBattle] Erro ao carregar slots:', error);
      });
    }
  }, [player?.id, loadPotionSlots]);

  // Estados do componente - SIMPLIFICADOS
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showFleeOverlay, setShowFleeOverlay] = useState(false);
  const [fleeSuccess, setFleeSuccess] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [, setShowRetryInterface] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Hook para detectar landscape mobile/tablet
  const isBattleLandscape = useBattleLandscape();
  const [victoryRewards, setVictoryRewards] = useState<BattleRewards>({
    xp: 0,
    gold: 0,
    drops: [],
    leveledUp: false,
    newLevel: 0,
  });

  // Ref para controle de montagem
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL: Inicialização única no mount COM PROTEÇÃO ADICIONAL - CORRIGIDA
  useEffect(() => {
    mountedRef.current = true;

    // ✅ CORREÇÃO: Verificações básicas sem dependência de isInitialized
    if (!characterId || !user?.id) {
      return;
    }

    // ✅ CORREÇÃO CRÍTICA: Evitar re-inicialização se já está processando
    if (initTimerRef.current) {
      return;
    }

    // ✅ CORREÇÃO: Usar canInitialize apenas como verificação inicial, não como dependência
    if (!canInitialize) {
      return;
    }

    // ✅ CORREÇÃO: Timer simples sem verificações complexas
    initTimerRef.current = setTimeout(() => {
      if (mountedRef.current && characterId && user?.id && initializeBattleRef.current) {
        initializeBattleRef.current().catch(error => {
          console.error('[GameBattle] Erro na inicialização:', error);
        });
      }
      // ✅ CORREÇÃO: Limpar timer após execução
      initTimerRef.current = null;
    }, 200);

    return () => {
      mountedRef.current = false;
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
        initTimerRef.current = null;
      }
    };
  }, [characterId, user?.id, canInitialize]); // ✅ CORREÇÃO: Dependências mínimas - removido initializeBattle

  // OTIMIZADO: Stats memorizados para evitar recálculos
  const battleStats = useMemo(() => {
    const enemyHpPercentage =
      currentEnemy && currentEnemy.maxHp > 0
        ? Math.max(0, Math.min(100, (currentEnemy.hp / currentEnemy.maxHp) * 100))
        : 0;
    const playerHpPercentage =
      player?.max_hp && player.max_hp > 0
        ? Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100))
        : 0;
    const playerManaPercentage =
      player?.max_mana && player.max_mana > 0
        ? Math.max(0, Math.min(100, (player.mana / player.max_mana) * 100))
        : 0;

    return { enemyHpPercentage, playerHpPercentage, playerManaPercentage };
  }, [
    currentEnemy?.hp,
    currentEnemy?.maxHp,
    player?.hp,
    player?.max_hp,
    player?.mana,
    player?.max_mana,
  ]);

  // 🔧 CORREÇÃO: Memoizar objetos criados inline para evitar re-renders
  const currentFloorData = useMemo(
    () => ({
      floorNumber: player?.floor || 1,
      type: currentFloor?.type || 'common',
      description: currentFloor?.description || `Andar ${player?.floor || 1}`,
      isCheckpoint: currentFloor?.isCheckpoint || false,
      minLevel: currentFloor?.minLevel || 1,
    }),
    [
      player?.floor,
      currentFloor?.type,
      currentFloor?.description,
      currentFloor?.isCheckpoint,
      currentFloor?.minLevel,
    ]
  );

  const fallbackEnemy = useMemo(
    () => ({
      id: 'placeholder',
      name: battleRewards ? 'Inimigo derrotado!' : 'Preparando próximo inimigo...',
      level: 1,
      hp: 0,
      maxHp: 1,
      attack: 0,
      defense: 0,
      speed: 1,
      image: battleRewards ? '💀' : '⏳',
      behavior: 'balanced' as const,
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
    }),
    [battleRewards]
  );

  const gameOverPlayerData = useMemo(
    () => ({
      id: player?.id || '',
      name: player?.name || '',
      level: player?.level || 1,
      floor: player?.floor || 1,
      hp: player?.hp || 0,
      max_hp: player?.max_hp || 1,
      xp: player?.xp || 0,
      gold: player?.gold || 0,
    }),
    [
      player?.id,
      player?.name,
      player?.level,
      player?.floor,
      player?.hp,
      player?.max_hp,
      player?.xp,
      player?.gold,
    ]
  );

  // ESTÁVEL: Processamento de recompensas com dependências fixas - CORRIGIDO
  useEffect(() => {
    // ✅ CORREÇÃO: Usar valores primitivos como dependências em vez de objetos
    const battleRewardsXp = battleRewards?.xp || 0;
    const battleRewardsGold = battleRewards?.gold || 0;
    const battleRewardsLeveledUp = battleRewards?.leveledUp || false;
    const battleRewardsNewLevel = battleRewards?.newLevel || 0;
    const battleRewardsDrops = battleRewards?.drops || [];

    if (!battleRewardsXp && !battleRewardsGold) {
      return;
    }

    if (showVictoryModal) {
      return;
    }

    console.log('[GameBattle] Processando recompensa de vitória');

    setVictoryRewards({
      xp: battleRewardsXp,
      gold: battleRewardsGold,
      drops: battleRewardsDrops,
      leveledUp: battleRewardsLeveledUp,
      newLevel: battleRewardsNewLevel,
    });

    setShowVictoryModal(true);
    addGameLogMessage(
      `Vitória! Você derrotou o inimigo e recebeu ${battleRewardsXp} XP e ${battleRewardsGold} Gold.`,
      'system'
    );

    if (battleRewardsLeveledUp && battleRewardsNewLevel) {
      addGameLogMessage(`Você subiu para o nível ${battleRewardsNewLevel}!`, 'system');
    }
  }, [
    battleRewards?.xp,
    battleRewards?.gold,
    battleRewards?.leveledUp,
    battleRewards?.newLevel,
    // ✅ CRITICAL: Remover addGameLogMessage das dependências para evitar loops
  ]);

  // ESTÁVEL: Verificação de game over - CORRIGIDO
  useEffect(() => {
    if (mode === 'gameover' && player?.hp !== undefined && player.hp <= 0 && !showDeathModal) {
      setShowDeathModal(true);

      if (characterDeleted && player?.name) {
        addGameLogMessage(
          `${player.name} foi perdido permanentemente. O sistema de Permadeath está ativo.`,
          'system'
        );
      }
    }
  }, [
    mode,
    player?.hp,
    player?.name,
    characterDeleted,
    // ✅ CRITICAL: Remover addGameLogMessage das dependências para evitar loops
  ]);

  // OTIMIZADO: Detecção de fuga - CORRIGIDO
  useEffect(() => {
    const isFugaDetected = mode === 'fled' || fleeSuccessful === true;

    if (isFugaDetected && !showFleeOverlay) {
      console.log('[GameBattle] Fuga detectada');
      const isSuccess = mode === 'fled' || fleeSuccessful === true;
      setFleeSuccess(isSuccess);
      setShowFleeOverlay(true);
    }
  }, [
    mode,
    fleeSuccessful,
    // ✅ CRITICAL: NÃO incluir showFleeOverlay para evitar loops
  ]);

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
    []
  );

  const handlePlayerStatsUpdate = useCallback(
    (newHp: number, newMana: number) => {
      console.log(`[GameBattle] Atualizando stats: HP ${newHp}, Mana ${newMana}`);
      updatePlayerStats(newHp, newMana);

      // ✅ CORREÇÃO: Capturar player ID no momento da execução para evitar dependência instável
      const currentPlayer = useGameStateStore.getState().gameState.player;
      if (currentPlayer?.id) {
        CharacterService.updateCharacterHpMana(currentPlayer.id, newHp, newMana)
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
    [updatePlayerStats] // ✅ CORREÇÃO: Remover player?.id das dependências para evitar loops
  );

  // ✅ NOVA FUNÇÃO: Callback para atualizar personagem após distribuição de atributos
  const handleAttributesUpdated = useCallback(
    (updatedCharacter: GamePlayer) => {
      console.log('[GameBattle] === ATUALIZANDO PERSONAGEM APÓS DISTRIBUIÇÃO ===', {
        characterId: updatedCharacter.id,
        oldAttributePoints: player?.attribute_points,
        newAttributePoints: updatedCharacter.attribute_points,
        playerName: updatedCharacter.name,
      });

      // ✅ CRÍTICO: Atualizar o gameState com o personagem atualizado
      const currentGameState = useGameStateStore.getState().gameState;
      const updatedGameState = {
        ...currentGameState,
        player: updatedCharacter,
      };

      useGameStateStore.getState().setGameState(updatedGameState);

      console.log('[GameBattle] ✅ GameState atualizado com novos atributos do personagem');
    },
    [player?.attribute_points] // ✅ CORREÇÃO: Dependência para debug do valor anterior
  );

  const handleContinueAdventure = useCallback(async () => {
    setShowVictoryModal(false);
    try {
      // ✅ CORREÇÃO CRÍTICA: Invalidar cache após vitória para garantir dados atualizados
      const currentPlayer = useGameStateStore.getState().gameState.player;
      if (currentPlayer?.id && battleRewards) {
        console.log('[GameBattle] 🔄 Invalidando cache após vitória com recompensas');
        CharacterService.invalidateCharacterCache(currentPlayer.id);
      }

      await handleAction('continue');
    } catch (error) {
      console.error('[GameBattle] Erro ao avançar:', error);
      toast.error('Erro ao avançar para o próximo andar');
      setShowVictoryModal(true);
    }
  }, [handleAction, battleRewards]);

  const handleReturnToHub = useCallback(async () => {
    const currentPlayer = useGameStateStore.getState().gameState.player;
    if (currentPlayer?.id) {
      // ✅ CRÍTICO: Finalizar logs da batalha ao voltar ao hub
      const { BattleLoggerService } = await import('@/services/battle-logger.service');
      BattleLoggerService.endBattle('victory', {
        reason: 'Retorno ao hub',
        playerName: currentPlayer.name,
      });

      // ✅ CORREÇÃO CRÍTICA: Invalidar cache para garantir dados atualizados no hub
      CharacterService.invalidateCharacterCache(currentPlayer.id);

      // ✅ CORREÇÃO: Limpar store Zustand para forçar recarregamento no hub
      const { useCharacterStore } = await import('@/stores/useCharacterStore');
      const characterStore = useCharacterStore.getState();
      if (characterStore.selectedCharacterId === currentPlayer.id) {
        characterStore.setSelectedCharacter(null);
      }

      navigate({ to: '/game/play/hub', search: { character: currentPlayer.id } });
    }
  }, [navigate]);

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

    const currentPlayer = useGameStateStore.getState().gameState.player;
    if (fleeSuccess && currentPlayer?.id) {
      // ✅ CRÍTICO: Finalizar logs da batalha em caso de fuga bem-sucedida
      console.log('[GameBattle] Finalizando logs da batalha - fuga bem-sucedida');
      const { BattleLoggerService } = await import('@/services/battle-logger.service');
      BattleLoggerService.endBattle('flee', {
        reason: 'Fuga bem-sucedida',
        playerName: currentPlayer.name,
      });

      toast.success('Fuga bem-sucedida!', {
        description: 'Retornando ao hub...',
        duration: 2000,
      });

      try {
        await CharacterService.updateCharacterFloor(currentPlayer.id, 1);
        console.log('[GameBattle] Andar resetado para 1');
      } catch (updateError) {
        console.error('[GameBattle] Erro ao resetar andar:', updateError);
      }

      navigate({ to: '/game/play/hub', search: { character: currentPlayer.id } });
    } else {
      // ✅ LOG: Fuga falhou
      toast.warning('Fuga falhou!', {
        description: 'Prepare-se para o contra-ataque...',
        duration: 3000,
      });
    }
  }, [fleeSuccess, navigate]);

  const handleManualRetry = useCallback(async () => {
    console.log('[GameBattle] Retry manual iniciado');
    setShowRetryInterface(false);
    await initializeBattle();
  }, []); // REMOVIDO initializeBattle da dependência - ele é estável via ref

  const handleViewCemetery = useCallback(() => {
    const currentPlayer = useGameStateStore.getState().gameState.player;
    if (currentPlayer?.id) {
      navigate({ to: '/game/play/hub/cemetery', search: { character: currentPlayer.id } });
    }
  }, [navigate]);

  // Interface de erro com retry
  if (initError && !isInitialized) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className={`text-center ${isBattleLandscape ? 'max-w-md' : 'max-w-lg'}`}>
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

  // 🔧 CORREÇÃO: Interface de loading mais específica - só mostrar se realmente carregando
  if (initLoading || (!isInitialized && canInitialize)) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className={`text-center ${isBattleLandscape ? 'max-w-sm' : 'max-w-md'}`}>
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

  // 🔧 NOVA VALIDAÇÃO: Se não tem inimigo mas deveria ter, mostrar erro
  if (isInitialized && mode === 'battle' && !currentEnemy) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className={`text-center ${isBattleLandscape ? 'max-w-md' : 'max-w-lg'}`}>
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Erro na Inicialização</h2>

          <div className="bg-card rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Problema:</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A batalha foi inicializada mas nenhum inimigo foi gerado.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Modo:</span>
                <span>{mode}</span>
              </div>
              <div className="flex justify-between">
                <span>Andar:</span>
                <span>{player?.floor || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tem inimigo:</span>
                <span className="text-destructive">{currentEnemy ? 'Sim' : 'Não'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={handleManualRetry} className="w-full" size="lg">
              🔄 Reinicializar Batalha
            </Button>
            <Button
              onClick={() => {
                const currentPlayer = useGameStateStore.getState().gameState.player;
                if (currentPlayer?.id) {
                  navigate({ to: '/game/play/hub', search: { character: currentPlayer.id } });
                }
              }}
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

  return (
    <>
      <div
        className={`w-full ${isBattleLandscape ? 'max-w-4xl mr-16 overflow-y-auto' : 'max-w-6xl'}`}
      >
        <BattleHeader currentFloor={currentFloorData} playerLevel={player?.level || 1} />

        {/* Arena de Batalha */}
        <div className={`mb-6 relative ${isBattleLandscape ? 'h-full flex flex-col' : ''}`}>
          {/* Quick Action Panel - Desktop - CORRIGIDO: Só renderizar se player existe */}
          {!isMobilePortrait && !isBattleLandscape && player && (
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

          {/* Quick Action Panel - Mobile - CORRIGIDO: Só renderizar se player existe */}
          {!isMobilePortrait && !isBattleLandscape && player && (
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

          {/* Quick Action Panel - Battle Landscape Mode - Ocupa altura disponível */}
          {isBattleLandscape && player && (
            <div className="fixed right-2 top-1/2 transform -translate-y-1/2 z-20 flex flex-col justify-center max-h-screen py-4">
              <div className="bg-slate-900/95 rounded-xl border border-slate-700/50 shadow-2xl backdrop-blur-sm">
                <QuickActionPanel
                  handleAction={handleAction}
                  isPlayerTurn={isPlayerTurn}
                  loading={loading}
                  player={player}
                  potionSlots={potionSlots}
                  loadingPotionSlots={loadingSlots}
                />
              </div>
            </div>
          )}

          <BattleArena
            player={player}
            currentEnemy={currentEnemy || fallbackEnemy}
            playerHpPercentage={battleStats.playerHpPercentage}
            playerManaPercentage={battleStats.playerManaPercentage}
            enemyHpPercentage={battleStats.enemyHpPercentage}
            isPlayerTurn={isPlayerTurn}
            gameLogs={gameLogs}
            onOpenLogModal={() => setShowLogModal(true)}
          />
        </div>

        {/* Interface de Batalha - Completamente oculta em landscape mobile/tablet */}
        {!isBattleLandscape && (
          <div className="mb-6">
            <CombinedBattleInterface
              handleAction={handleAction}
              isPlayerTurn={isPlayerTurn}
              loading={loading}
              player={player}
              onPlayerStatsUpdate={handlePlayerStatsUpdate}
              currentEnemy={currentEnemy}
              battleRewards={battleRewards}
              potionSlots={potionSlots}
              loadingPotionSlots={loadingSlots}
              onSlotsChange={reloadSlots}
            />
          </div>
        )}

        {/* Game Log - Invisível em landscape mobile/tablet mas mantém scroll */}
        <div className={`${isBattleLandscape ? 'invisible h-0 overflow-hidden' : ''}`}>
          <GameLog gameLog={gameLogs} />
        </div>
      </div>

      <VictoryModal
        isOpen={showVictoryModal}
        onContinue={handleContinueAdventure}
        onReturnToHub={handleReturnToHub}
        onOpenAttributeModal={handleOpenAttributeModal}
        rewards={victoryRewards}
        leveledUp={victoryRewards.leveledUp}
        newLevel={victoryRewards.newLevel}
        hasAttributePoints={(player?.attribute_points || 0) > 0}
      />

      <GameOverModal
        isOpen={showDeathModal}
        onClose={() => setShowDeathModal(false)}
        player={gameOverPlayerData}
        gameMessage={`${player?.name || 'Personagem'} foi derrotado no Andar ${player?.floor || 1}...`}
        highestFloor={player?.floor || 1}
        isCharacterDeleted={characterDeleted}
        onReturnToCharacterSelect={handleReturnToCharacterSelect}
        onViewCemetery={handleViewCemetery}
      />

      <AttributeDistributionModal
        isOpen={showAttributeModal}
        onClose={() => {
          setShowAttributeModal(false);

          // ✅ CORREÇÃO: Só reabrir VictoryModal se ainda há pontos disponíveis
          const currentPlayer = useGameStateStore.getState().gameState.player;
          const stillHasAttributePoints = (currentPlayer?.attribute_points || 0) > 0;

          console.log('[GameBattle] === FECHANDO MODAL DE ATRIBUTOS ===', {
            battleRewardsExists: Boolean(battleRewards),
            showVictoryModalCurrent: showVictoryModal,
            stillHasAttributePoints,
            currentAttributePoints: currentPlayer?.attribute_points,
          });

          if (battleRewards && !showVictoryModal && stillHasAttributePoints) {
            console.log('[GameBattle] ✅ Reabrindo VictoryModal - ainda há pontos para distribuir');
            setShowVictoryModal(true);
          } else if (!stillHasAttributePoints) {
            console.log(
              '[GameBattle] ✅ Não reabrindo VictoryModal - todos os pontos foram distribuídos'
            );
          }
        }}
        character={player}
        onAttributesUpdated={handleAttributesUpdated}
      />

      {/* Overlay de Fuga */}
      {showFleeOverlay && (
        <div className="fixed inset-0 z-50">
          <FleeOverlay
            isVisible={showFleeOverlay}
            isSuccess={fleeSuccess}
            playerName={player?.name || 'Personagem'}
            enemyName={currentEnemy?.name}
            onComplete={handleFleeOverlayComplete}
          />
        </div>
      )}

      {/* Modal de Log - Apenas em Battle Landscape Mode */}
      {isBattleLandscape && (
        <GameLogModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          gameLogs={gameLogs}
        />
      )}
    </>
  );
}
