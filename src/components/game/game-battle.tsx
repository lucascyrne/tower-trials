import { useState, useEffect, useRef } from 'react';
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
import { CharacterService } from '@/resources/game/character.service';
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
    gameLog
  } = useGame();
  const { player, currentEnemy, currentFloor, isPlayerTurn } = gameState;
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showFleeOverlay, setShowFleeOverlay] = useState(false);
  const [fleeSuccess, setFleeSuccess] = useState(false);
  const [showDebugUnlock, setShowDebugUnlock] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  
  // Sistema para prevenir ações duplicadas
  const actionProcessingRef = useRef(false);
  const lastActionTimeRef = useRef(0);  
  const stuckDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sistema de recuperação automática para turnos travados
  const stuckTurnDetectionRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sistema para evitar processamento duplicado de recompensas
  const processedRewardsRef = useRef<Set<string>>(new Set());
  const lastBattleStateRef = useRef<{
    floor: number;
    enemyName: string;
    rewardsProcessed: boolean;
  }>({
    floor: 0,
    enemyName: '',
    rewardsProcessed: false
  });
  
  const [victoryRewards, setVictoryRewards] = useState<BattleRewards>({
    xp: 0,
    gold: 0,
    drops: [],
    leveledUp: false,
    newLevel: 0
  });

  const { character: characterId } = useParams({ 
    from: '/_authenticated/game/play/hub/battle/$character' 
  });

  // NOVO: Controle para evitar múltiplas inicializações
  const battleInitializedRef = useRef(false);
  const mountedRef = useRef(false);
  const currentCharacterRef = useRef<string | null>(null);

  // Controle de montagem
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      battleInitializedRef.current = false;
      currentCharacterRef.current = null;
    };
  }, []);

  // Inicializar batalha apenas uma vez quando componente montar com personagem válido
  useEffect(() => {
    if (!mountedRef.current || !user?.id || !characterId) {
      return;
    }

    // Evitar múltiplas inicializações para o mesmo personagem
    if (battleInitializedRef.current && currentCharacterRef.current === characterId) {
      console.log(`[GameBattle] Batalha já inicializada para personagem ${characterId}`);
      return;
    }

    // Evitar inicialização se já está carregando
    if (loading.performAction || loading.loadProgress) {
      console.log(`[GameBattle] Aguardando carregamento finalizar antes de inicializar batalha`);
      return;
    }

    const initializeBattleForCharacter = async () => {
      try {
        console.log(`[GameBattle] === INICIANDO INICIALIZAÇÃO DA BATALHA ===`);
        console.log(`[GameBattle] Personagem ID: ${characterId}`);
        
        // Marcar como inicializado antes de começar
        battleInitializedRef.current = true;
        currentCharacterRef.current = characterId;
        
        // Buscar dados do personagem
        const characterResponse = await CharacterService.getCharacter(characterId);
        
        if (!characterResponse.success || !characterResponse.data) {
          throw new Error(characterResponse.error || 'Personagem não encontrado');
        }
        
        const character = characterResponse.data;
        console.log(`[GameBattle] Personagem carregado: ${character.name} (andar ${character.floor})`);
        
        // Inicializar batalha
        await initializeBattle(character);
        
        // Marcar como carregamento concluído
        setIsLoading(false);
        
        console.log(`[GameBattle] === BATALHA INICIALIZADA COM SUCESSO ===`);
        
      } catch (error) {
        console.error('[GameBattle] Erro ao inicializar batalha:', error);
        
        // Reset em caso de erro para permitir nova tentativa
        battleInitializedRef.current = false;
        currentCharacterRef.current = null;
        
        toast.error('Erro ao inicializar batalha', {
          description: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    };

    // Pequeno delay para garantir que o componente está totalmente montado
    const initTimer = setTimeout(() => {
      if (mountedRef.current && !battleInitializedRef.current) {
        initializeBattleForCharacter();
      }
    }, 100);

    return () => clearTimeout(initTimer);
  }, [user?.id, characterId, initializeBattle, loading.performAction, loading.loadProgress]);

  useEffect(() => {
    console.log(`[GameBattle] Andar atual: ${player.floor}`);
  }, [player.floor]);

  // Sistema simplificado de detecção de travamento
  useEffect(() => {
    const isBattleActive = gameState.mode === 'battle' && currentEnemy && currentEnemy.hp > 0;
    const isEnemyTurnStuck = isBattleActive && !isPlayerTurn && !loading.performAction && !gameState.battleRewards;
    
    if (isEnemyTurnStuck && !stuckTurnDetectionRef.current) {
      console.log(`[GameBattle] Iniciando detecção de turno travado`);
      
      stuckTurnDetectionRef.current = setTimeout(() => {
        console.warn(`[GameBattle] Possível travamento detectado`);
        setShowDebugUnlock(true);
        
        toast.warning('Sistema de Recuperação', {
          description: 'Possível travamento detectado. Use o botão de emergência se necessário.',
          duration: 4000
        });
        
        stuckTurnDetectionRef.current = null;
      }, 5000); // Verificar após 5 segundos
    }
    
    // Limpar timeout se não for mais necessário
    if (!isEnemyTurnStuck && stuckTurnDetectionRef.current) {
      clearTimeout(stuckTurnDetectionRef.current);
      stuckTurnDetectionRef.current = null;
    }
    
    return () => {
      if (stuckTurnDetectionRef.current) {
        clearTimeout(stuckTurnDetectionRef.current);
        stuckTurnDetectionRef.current = null;
      }
    };
  }, [isPlayerTurn, currentEnemy?.hp, loading.performAction, gameState.mode, gameState.battleRewards]);

  // Processamento de recompensas com controle de duplicação
  useEffect(() => {
    if (!gameState.battleRewards) {
      return;
    }

    // Verificar se já processamos esta batalha específica
    const battleKey = `${player.floor}-${currentEnemy?.name || 'unknown'}-${gameState.battleRewards.xp}`;
    
    if (processedRewardsRef.current.has(battleKey)) {
      console.log(`[GameBattle] Recompensa já processada: ${battleKey}`);
      return;
    }

    // Verificar se mudou de andar para limpar cache
    if (lastBattleStateRef.current.floor !== player.floor) {
      console.log(`[GameBattle] Novo andar detectado (${lastBattleStateRef.current.floor} -> ${player.floor}), limpando cache`);
      processedRewardsRef.current.clear();
    }

    // Marcar como processada
    processedRewardsRef.current.add(battleKey);
    lastBattleStateRef.current = {
      floor: player.floor,
      enemyName: currentEnemy?.name || 'unknown',
      rewardsProcessed: true
    };

    console.log(`[GameBattle] Processando recompensa de vitória: XP ${gameState.battleRewards.xp}, Gold ${gameState.battleRewards.gold}`);
    
    const battleRewards = gameState.battleRewards;
    
    setVictoryRewards({
      xp: battleRewards.xp,
      gold: battleRewards.gold,
      drops: battleRewards.drops || [],
      leveledUp: battleRewards.leveledUp,
      newLevel: battleRewards.newLevel
    });
    
    // Só mostrar modal se não estiver já visível
    if (!showVictoryModal) {
      setShowVictoryModal(true);
    }
    
    const victoryMessage = `Vitória! Você derrotou o inimigo e recebeu ${battleRewards.xp} XP e ${battleRewards.gold} Gold.`;
    addGameLogMessage(victoryMessage, 'system');
    
    if (battleRewards.leveledUp && battleRewards.newLevel) {
      addGameLogMessage(`Você subiu para o nível ${battleRewards.newLevel}!`, 'system');
    }
  }, [gameState.battleRewards, gameState.mode, player.floor, currentEnemy?.name, showVictoryModal, addGameLogMessage]);

  // Verificação de game over
  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0) {
      console.log('[GameBattle] Personagem morreu - exibindo modal de morte');
      setShowDeathModal(true);
      
      // Se o personagem foi deletado, adicionar mensagem sobre permadeath
      if (gameState.characterDeleted) {
        console.log('[GameBattle] Personagem foi deletado permanentemente');
        addGameLogMessage(`${player.name} foi perdido permanentemente. O sistema de Permadeath está ativo.`, 'system');
      }
    }
  }, [gameState.mode, player.hp, gameState.characterDeleted, player.name, addGameLogMessage]);

  // SISTEMA IMEDIATO DE DETECÇÃO DE FUGA CORRIGIDO
  useEffect(() => {
    console.log('[GameBattle] 🔍 Verificando estado de fuga:', {
      mode: gameState.mode,
      fleeSuccessful: gameState.fleeSuccessful,
      showFleeOverlay: showFleeOverlay,
      hasEnemy: !!currentEnemy,
      enemyName: currentEnemy?.name,
      playerName: player.name
    });
    
    const isFugaDetected = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
    
    if (isFugaDetected && !showFleeOverlay) {
      console.log('[GameBattle] 🏃‍♂️ FUGA DETECTADA - Ativando overlay IMEDIATAMENTE');
      
      // CORRIGIDO: A fuga é bem-sucedida se o modo for 'fled' OU fleeSuccessful for true
      const isSuccess = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
      
      console.log(`[GameBattle] ${isSuccess ? '✅ FUGA BEM-SUCEDIDA' : '❌ FUGA FALHOU'} - Preparando overlay`);
      
      setFleeSuccess(isSuccess);
      setShowFleeOverlay(true);
      
      // Bloquear outras ações durante fuga
      actionProcessingRef.current = true;
      
      console.log('[GameBattle] 🎭 Overlay de fuga ativado com sucesso:', {
        isSuccess: isSuccess,
        overlayVisible: true
      });
    }
  }, [gameState.mode, gameState.fleeSuccessful, currentEnemy, showFleeOverlay, player.name]);

  // Detectar orientação para escolher interface adequada
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

  // Listener para abrir modal de atributos
  useEffect(() => {
    const handleOpenAttributeModal = () => {
      setShowAttributeModal(true);
    };

    window.addEventListener('openAttributeModal', handleOpenAttributeModal);
    
    return () => {
      window.removeEventListener('openAttributeModal', handleOpenAttributeModal);
    };
  }, []);

  // Função para atualizar consumáveis do jogador
  const handlePlayerConsumablesUpdate = (consumables: CharacterConsumable[]) => {
    console.log(`[game-battle] Atualizando consumáveis do jogador:`, consumables.length);
    updatePlayerConsumables(consumables);
  };

  // Função para atualizar stats do jogador após usar poção
  const handlePlayerStatsUpdate = (newHp: number, newMana: number) => {
    console.log(`[game-battle] Atualizando stats do jogador: HP ${newHp}, Mana ${newMana}`);
    
    // CRÍTICO: Usar a função do contexto para atualizar stats
    // Isso força a atualização reativa em toda a aplicação
    updatePlayerStats(newHp, newMana);
    
    // Também atualizar no banco de dados de forma assíncrona
    if (gameState.player.id) {
      CharacterService.updateCharacterHpMana(gameState.player.id, newHp, newMana)
        .then((result) => {
          if (result.success) {
            console.log('[game-battle] Stats do personagem atualizados no banco com sucesso');
          } else {
            console.error('[game-battle] Erro ao atualizar stats no banco:', result.error);
            toast.error('Erro ao atualizar status do personagem');
          }
        })
        .catch((error: Error) => {
          console.error('[game-battle] Erro ao atualizar stats:', error);
          toast.error('Erro ao atualizar status do personagem');
        });
    }
  };

  // Função para retornar à seleção de personagens
  const handleReturnToCharacterSelect = () => {
    navigate({ to: '/game/play' });
  };

  // Função para abrir o modal de atributos
  const handleOpenAttributeModal = () => {
    setShowAttributeModal(true);
    setShowVictoryModal(false);
  };

  // Componente de carregamento - NUNCA mostrar durante fuga
  const isFugaState = gameState.mode === 'fled' || gameState.fleeSuccessful === true || showFleeOverlay;
  
  if (!isFugaState && (isLoading || loading.performAction || !battleInitializedRef.current)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Carregando...</h2>
          <p className="text-muted-foreground">
            {!battleInitializedRef.current ? 'Inicializando batalha...' : 'Preparando sua aventura'}
          </p>
        </div>
      </div>
    );
  }

  if (gameState.mode === 'special_event' || gameState.currentSpecialEvent) {
    return <SpecialEventPanel />;
  }

  // Verificação dos dados necessários - não mostrar loading durante fuga
  const isFugaActive = gameState.mode === 'fled' || gameState.fleeSuccessful === true;
  const shouldShowLoadingScreen = !isFugaActive && 
    !gameState.battleRewards && 
    !showFleeOverlay &&
    (!currentFloor || !player.id || (!currentEnemy && gameState.mode === 'battle'));
  
  if (shouldShowLoadingScreen) {
    console.log('[GameBattle] Aguardando dados:', {
      hasCurrentEnemy: !!currentEnemy,
      hasCurrentFloor: !!currentFloor,
      hasPlayerId: !!player.id,
      hasBattleRewards: !!gameState.battleRewards,
      gameMode: gameState.mode,
      isFugaActive,
      showFleeOverlay,
      shouldShowLoadingScreen
    });
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Preparando Batalha...</h2>
          <p className="text-muted-foreground">
            {!currentFloor && 'Carregando dados do andar...'}
            {!currentEnemy && currentFloor && !gameState.battleRewards && 'Gerando inimigo...'}
            {!player.id && 'Carregando personagem...'}
          </p>
          <div className="mt-4 text-sm text-muted-foreground">
            <div>Andar: {currentFloor ? '✓' : '❌'}</div>
            <div>Inimigo: {currentEnemy ? '✓' : gameState.battleRewards ? '⚰️' : '❌'}</div>
            <div>Personagem: {player.id ? '✓' : '❌'}</div>
          </div>
        </div>
      </div>
    );
  }

  // Calcular percentuais com proteção contra divisão por zero
  const enemyHpPercentage = currentEnemy && currentEnemy.maxHp > 0 
    ? Math.max(0, Math.min(100, (currentEnemy.hp / currentEnemy.maxHp) * 100)) 
    : 0;
  const playerHpPercentage = player.max_hp > 0 
    ? Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100)) 
    : 0;
  const playerManaPercentage = player.max_mana > 0 
    ? Math.max(0, Math.min(100, (player.mana / player.max_mana) * 100)) 
    : 0;

  // FUNÇÃO SIMPLIFICADA PARA EXECUTAR AÇÕES SEM BLOQUEIOS DUPLICADOS
  const handleAction = async (action: ActionType, spellId?: string) => {
    const currentTime = Date.now();
    
    console.log(`[GameBattle] === EXECUTANDO AÇÃO: ${action} ===`);
    console.log(`[GameBattle] Estado atual:`, {
      mode: gameState.mode,
      isPlayerTurn: isPlayerTurn,
      actionProcessing: actionProcessingRef.current,
      loadingPerformAction: loading.performAction
    });
    
    // APENAS validações essenciais - sem bloqueios duplicados
    
    // 1. Bloquear se personagem está morto
    if (gameState.mode === 'gameover' || player.hp <= 0) {
      console.warn('[GameBattle] ❌ Ação bloqueada - personagem está morto');
      return;
    }
    
    // 2. Verificação específica para fuga - pode ser feita a qualquer momento
    if (action === 'flee') {
      if (gameState.mode === 'fled' || gameState.fleeSuccessful) {
        console.warn('[GameBattle] ❌ FUGA BLOQUEADA - já há fuga bem-sucedida');
        return;
      }
      
      console.log(`[GameBattle] 🏃 FUGA APROVADA - Delegando para provider`);
    }
    
    // 3. Para outras ações, verificar turno do jogador
    if (action !== 'flee' && action !== 'continue' && !isPlayerTurn) {
      console.warn(`[GameBattle] ❌ Ação '${action}' bloqueada - não é turno do jogador`);
      return;
    }
    
    // 4. Verificar debounce básico apenas para evitar spam
    if (currentTime - lastActionTimeRef.current < 300) {
      console.warn(`[GameBattle] ⏱️ Debounce - aguardando ${300 - (currentTime - lastActionTimeRef.current)}ms`);
      return;
    }
    
    // Marcar timestamp (sem marcar como processando para evitar deadlock)
    lastActionTimeRef.current = currentTime;
    
    console.log(`[GameBattle] ✅ Delegando ação '${action}' para provider`);
    
    try {
      // DELEGAR DIRETAMENTE para o provider sem validações duplicadas
      await performAction(action, spellId);
    } catch (error) {
      console.error(`[GameBattle] ❌ Erro ao executar ação '${action}':`, error);
      toast.error(`Erro ao executar ação: ${action}`);
    }
  };

  // Função para continuar a aventura
  const handleContinueAdventure = async () => {
    // Verificar se já está processando uma ação
    if (actionProcessingRef.current || loading.performAction) {
      console.warn("[GameBattle] Continuar aventura bloqueado - já processando ação");
      return;
    }

    console.log("[GameBattle] === CONTINUAR AVENTURA ===");
    console.log("[GameBattle] Estado atual:", {
      floor: gameState.player.floor,
      hasRewards: !!gameState.battleRewards,
      hasEnemy: !!gameState.currentEnemy,
      enemyHp: gameState.currentEnemy?.hp
    });
    
    // Fechar modal ANTES de prosseguir
    setShowVictoryModal(false);
    
    // Aguardar um momento para garantir que o modal foi fechado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      console.log("[GameBattle] Chamando performAction('continue')...");
      await handleAction('continue');
      console.log("[GameBattle] performAction('continue') concluído com sucesso");
    } catch (error) {
      console.error("[GameBattle] Erro ao avançar:", error);
      toast.error("Erro ao avançar para o próximo andar");
      // Reabrir modal em caso de erro
      setShowVictoryModal(true);
    }
  };

  const handleReturnToHub = () => {
    navigate({ to: '/game/play/hub', search: { character: gameState.player.id } });
  };

  // HANDLER APRIMORADO PARA CONCLUSÃO DO OVERLAY DE FUGA
  const handleFleeOverlayComplete = async () => {
    console.log('[GameBattle] 🏁 Overlay de fuga concluído, sucesso:', fleeSuccess);
    setShowFleeOverlay(false);
    
    // Desbloquear ações
    actionProcessingRef.current = false;
    
    if (fleeSuccess) {
      console.log('[GameBattle] 🏠 Fuga bem-sucedida - iniciando redirecionamento');
      
      try {
        const playerId = gameState.player.id;
        
        // Toast de feedback imediato
        toast.success('Fuga bem-sucedida!', {
          description: 'Retornando ao hub...',
          duration: 2000
        });
        
        // IMPORTANTE: Resetar andar para 1 ANTES do redirecionamento
        console.log('[GameBattle] 🔄 Resetando andar para 1 antes do redirecionamento');
        
        try {
          await CharacterService.updateCharacterFloor(playerId, 1);
          console.log('[GameBattle] ✅ Andar resetado para 1 com sucesso');
        } catch (updateError) {
          console.error('[GameBattle] ⚠️ Erro ao resetar andar (continuando mesmo assim):', updateError);
        }
        
        // Redirecionamento após reset do andar
        console.log('[GameBattle] 🚀 Redirecionando para hub');
        navigate({ to: '/game/play/hub', search: { character: playerId } });
        
      } catch (error) {
        console.error('[GameBattle] ❌ Erro no redirecionamento:', error);
        
        // Fallback: tentar redirecionamento mesmo com erro
        toast.error('Erro no redirecionamento', {
          description: 'Tentando novamente...',
          duration: 3000
        });
        
        setTimeout(() => {
          navigate({ to: '/game/play/hub', search: { character: gameState.player.id } });
        }, 1000);
      }
    } else {
      console.log('[GameBattle] ⚔️ Fuga falhou - retornando à batalha');
      
      // Toast de feedback para fuga falhada
      toast.warning('Fuga falhou!', {
        description: 'Prepare-se para o contra-ataque...',
        duration: 3000
      });
      
             // Garantir que está de volta ao modo battle
       if (gameState.mode === 'fled') {
         console.warn('[GameBattle] ⚠️ Modo corrigido automaticamente - o sistema deve retornar ao battle mode');
         // O provider já deve estar gerenciando a transição de volta ao battle
       }
    }
  };

  return (
    <>
      <div className="w-full max-w-6xl">
        <BattleHeader 
          currentFloor={{
            floorNumber: player.floor,
            type: currentFloor?.type || 'common',
            description: currentFloor?.description || `Andar ${player.floor}`,
            isCheckpoint: currentFloor?.isCheckpoint || false,
            minLevel: currentFloor?.minLevel || 1
          }} 
          playerLevel={player.level} 
        />

        {/* Arena de Batalha - sempre visível para evitar layout shift */}
        <div className="mb-6 relative">
          {/* Quick Action Panel - Desktop (ao lado esquerdo) */}
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

          {/* Quick Action Panel - Mobile Horizontal (canto inferior esquerdo) */}
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
          
          {/* CORRIGIDO: Sempre exibir BattleArena, usando placeholder quando necessário */}
          <BattleArena 
            player={player}
            currentEnemy={currentEnemy || {
              id: 'placeholder',
              name: gameState.battleRewards ? 'Inimigo derrotado!' : 'Preparando próximo inimigo...',
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
                attribute_modifications: []
              }
            }}
            playerHpPercentage={playerHpPercentage}
            playerManaPercentage={playerManaPercentage}
            enemyHpPercentage={currentEnemy ? enemyHpPercentage : 0}
            isPlayerTurn={isPlayerTurn}
          />
        </div>

        {/* Interface de Batalha - SEMPRE VISÍVEL para garantir botão de fallback */}
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
        
        {/* Botão de Emergência Melhorado */}
        {showDebugUnlock && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-2">
                <div className="text-orange-400 font-medium text-sm">Sistema Travado</div>
                <div className="text-xs text-muted-foreground">
                  Clique para desbloquear se as ações não funcionam
                </div>
                <button
                  onClick={() => {
                    console.log('[GameBattle] Botão de emergência acionado');
                    
                    // Limpar estados de processamento
                    actionProcessingRef.current = false;
                    if (stuckDetectionTimeoutRef.current) {
                      clearTimeout(stuckDetectionTimeoutRef.current);
                      stuckDetectionTimeoutRef.current = null;
                    }
                    
                    setShowDebugUnlock(false);
                    
                    toast.success('Sistema Desbloqueado', {
                      description: 'Estados de processamento limpos. Tente sua ação novamente.',
                      duration: 3000
                    });
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-3 py-2 rounded transition-colors"
                >
                  🔧 Desbloquear Sistema
                </button>
                <button
                  onClick={() => setShowDebugUnlock(false)}
                  className="w-full text-xs text-orange-300/70 hover:text-orange-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
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
          gold: player.gold
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
          // CORRIGIDO: Quando fechar modal de atributos, garantir que VictoryModal permaneça visível se há recompensas
          if (gameState.battleRewards && !showVictoryModal) {
            console.log('[GameBattle] Reexibindo VictoryModal após fechar modal de atributos');
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