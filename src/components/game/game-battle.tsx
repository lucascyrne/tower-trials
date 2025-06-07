'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { ActionType } from '@/resources/game/game-model';
import { BattleArena } from './BattleArena';
import { CombinedBattleInterface } from './CombinedBattleInterface';
import { useRouter, useSearchParams } from 'next/navigation';
import { VictoryModal } from './VictoryModal';
import { GameOverModal } from './GameOverModal';
import { toast } from 'sonner';
import SpecialEventPanel from './SpecialEventPanel';
import AttributeDistributionModal from './AttributeDistributionModal';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { 
    gameState, 
    performAction, 
    loading,
    selectCharacter,
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

  const [isLoading, setIsLoading] = useState(true);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  
  // Sistema para prevenir ações duplicadas
  const actionProcessingRef = useRef(false);
  const lastActionTimeRef = useRef(0);
  const ACTION_DEBOUNCE_MS = 800; // Aumentar debounce para 800ms
  
  // OTIMIZADO: Sistema mais robusto para evitar processamento duplicado
  const processedRewardsRef = useRef<Set<string>>(new Set());
  const characterLoadedRef = useRef(false);
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

  useEffect(() => {
    console.log(`[GameBattle] Andar atual: ${player.floor}`);
  }, [player.floor]);

  // CORRIGIDO: Processamento de recompensas com controle rigoroso
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
    
    // CRÍTICO: Só mostrar modal se não estiver já visível
    if (!showVictoryModal) {
      setShowVictoryModal(true);
    }
    
    const victoryMessage = `Vitória! Você derrotou o inimigo e recebeu ${battleRewards.xp} XP e ${battleRewards.gold} Gold.`;
    addGameLogMessage(victoryMessage, 'system');
    
    if (battleRewards.leveledUp && battleRewards.newLevel) {
      addGameLogMessage(`Você subiu para o nível ${battleRewards.newLevel}!`, 'system');
    }
  }, [gameState.battleRewards, gameState.mode, player.floor, currentEnemy?.name, showVictoryModal]);

  // Verificação de game over
  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0) {
      console.log('[GameBattle] Personagem morreu - exibindo modal de morte');
      setShowDeathModal(true);
      
      // CRÍTICO: Se o personagem foi deletado, bloquear completamente a interface
      if (gameState.characterDeleted) {
        console.log('[GameBattle] Personagem foi deletado permanentemente');
        
        // Adicionar mensagem ao log sobre permadeath
        addGameLogMessage(`${player.name} foi perdido permanentemente. O sistema de Permadeath está ativo.`, 'system');
      }
    }
  }, [gameState.mode, player.hp, gameState.characterDeleted, player.name]);

  // Verificação de fuga
  useEffect(() => {
    if (gameState.mode === 'fled') {
      console.log('[GameBattle] Fuga detectada - exibindo overlay');
      setFleeSuccess(gameState.fleeSuccessful !== false); // true por padrão se não especificado
      setShowFleeOverlay(true);
    }
  }, [gameState.mode, gameState.fleeSuccessful]);



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

  // Carregamento inicial do personagem
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      if (characterLoadedRef.current) {
        console.log('[GameBattle] Personagem já carregado, ignorando carregamento duplo');
        return;
      }
      
      setIsLoading(true);
      
      const characterId = searchParams.get('character');
      if (!characterId) {
        console.warn('[GameBattle] ID do personagem não encontrado na URL');
        router.push('/game/play');
        return;
      }

      try {
        console.log(`[GameBattle] Iniciando carregamento do personagem: ${characterId}`);
        
        const response = await CharacterService.getCharacter(characterId);
        
        if (response.success && response.data) {
          console.log(`[GameBattle] Personagem carregado com sucesso: ${response.data.name} (andar: ${response.data.floor})`);
          
          characterLoadedRef.current = true;
          
          // Aguardar a seleção do personagem completar
          await selectCharacter(response.data);
          
          console.log(`[GameBattle] selectCharacter concluído para ${response.data.name}`);
          
        } else {
          console.error('[GameBattle] Erro ao carregar personagem:', response.error);
          toast.error('Erro ao carregar personagem', {
            description: response.error || 'Erro desconhecido'
          });
          router.push('/game/play');
        }
      } catch (error) {
        console.error('[GameBattle] Exceção ao carregar personagem:', error);
        toast.error('Erro ao carregar personagem');
        router.push('/game/play');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
    
    return () => {
      processedRewardsRef.current.clear();
    };
  }, [searchParams]);

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
    router.push('/game/play');
  };

  // Função para abrir o modal de atributos
  const handleOpenAttributeModal = () => {
    setShowAttributeModal(true);
    setShowVictoryModal(false);
  };

  // Componente de carregamento
  if (isLoading || loading.performAction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Carregando...</h2>
          <p className="text-muted-foreground">Preparando sua aventura</p>
        </div>
      </div>
    );
  }

  if (gameState.mode === 'special_event' || gameState.currentSpecialEvent) {
    return <SpecialEventPanel />;
  }

  // Verificação melhorada dos dados necessários
  // CRÍTICO: Permitir exibir interface quando há battleRewards mesmo sem currentEnemy
  // CRÍTICO: NÃO mostrar loading screen quando fuga foi bem-sucedida
  const shouldShowLoadingScreen = gameState.mode !== 'fled' && (!currentFloor || !player.id || (!currentEnemy && !gameState.battleRewards));
  
  if (shouldShowLoadingScreen) {
    console.log('[GameBattle] Aguardando dados:', {
      hasCurrentEnemy: !!currentEnemy,
      hasCurrentFloor: !!currentFloor,
      hasPlayerId: !!player.id,
      hasBattleRewards: !!gameState.battleRewards,
      gameMode: gameState.mode,
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

  const enemyHpPercentage = currentEnemy ? (currentEnemy.hp / currentEnemy.maxHp) * 100 : 0;
  const playerHpPercentage = (player.hp / player.max_hp) * 100;
  const playerManaPercentage = (player.mana / player.max_mana) * 100;

  // CORRIGIDO: Função para executar ações do jogador com proteção aprimorada
  const handleAction = async (action: ActionType, spellId?: string) => {
    const currentTime = Date.now();
    
    // 1. Verificar se já está processando uma ação
    if (actionProcessingRef.current) {
      console.warn(`[GameBattle] Ação '${action}' BLOQUEADA - já processando ação`);
      return;
    }
    
    // 2. Verificar debounce temporal
    if (currentTime - lastActionTimeRef.current < ACTION_DEBOUNCE_MS) {
      console.warn(`[GameBattle] Ação '${action}' BLOQUEADA - debounce (${currentTime - lastActionTimeRef.current}ms < ${ACTION_DEBOUNCE_MS}ms)`);
      return;
    }
    
    // 3. Bloquear ações se personagem está morto
    if (gameState.mode === 'gameover' || player.hp <= 0) {
      console.warn('[GameBattle] Ação bloqueada - personagem está morto');
      return;
    }
    
    // 4. Bloquear ações durante fuga
    if (gameState.mode === 'fled') {
      console.warn('[GameBattle] Ação bloqueada - processo de fuga em andamento');
      return;
    }
    
    // 5. NOVO: Bloquear ações se modal de vitória está visível (exceto continue)
    if (showVictoryModal && action !== 'continue') {
      console.warn('[GameBattle] Ação bloqueada - modal de vitória ativo');
      return;
    }
    
    // 6. Verificar se é o turno do jogador (exceto para continue)
    if (!isPlayerTurn && action !== 'continue') {
      console.warn('[GameBattle] Ação bloqueada - não é o turno do jogador');
      return;
    }
    
    // Marcar como processando
    actionProcessingRef.current = true;
    lastActionTimeRef.current = currentTime;
    
    console.log(`[GameBattle] Executando ação '${action}' (timestamp: ${currentTime})`);
    
    try {
      await performAction(action, spellId);
    } catch (error) {
      console.error('[GameBattle] Erro ao executar ação:', error);
      toast.error(`Erro ao executar ação: ${action}`);
    } finally {
      // Limpar estado de processamento após um delay
      setTimeout(() => {
        actionProcessingRef.current = false;
      }, 200);
    }
  };

  // CORRIGIDO: Função para continuar a aventura com proteção aprimorada
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
    router.push(`/game/play/hub?character=${gameState.player.id}`);
  };

  // Handler para o fim do overlay de fuga
  const handleFleeOverlayComplete = async () => {
    console.log('[GameBattle] Overlay de fuga concluído, sucesso:', fleeSuccess);
    setShowFleeOverlay(false);
    
    if (fleeSuccess) {
      // Fuga bem-sucedida: redirecionar para o hub
      try {
        if (gameState.player.id) {
          // Atualizar andar para 1 (volta ao início)
          await CharacterService.updateCharacterFloor(gameState.player.id, 1);
          console.log('[GameBattle] Andar do personagem atualizado para 1');
        }
        
        // Redirecionar para o hub
        router.push(`/game/play/hub?character=${gameState.player.id}`);
      } catch (error) {
        console.error('[GameBattle] Erro ao processar fuga:', error);
        toast.error('Erro ao processar fuga');
      }
    } else {
      // Fuga falhada: o contexto já deve ter retornado ao modo battle
      console.log('[GameBattle] Fuga falhou, retornando à batalha');
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

        {/* Arena de Batalha Unificada - SEMPRE VISÍVEL para evitar layout shift */}
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
              name: 'Preparando próximo inimigo...',
              level: 1,
              hp: 0,
              maxHp: 1,
              attack: 0,
              defense: 0,
              speed: 1,
              image: '',
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

        {/* Interface de Batalha - Apenas Mobile Portrait */}
        {isMobilePortrait && (
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
        )}

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
          gold: player.gold
        }}
        gameMessage={`${player.name} foi derrotado no Andar ${player.floor}...`}
        highestFloor={player.floor}
        isCharacterDeleted={gameState.characterDeleted}
        userId={user?.id}
        onReturnToCharacterSelect={handleReturnToCharacterSelect}
        onViewCemetery={() => {
          window.location.href = '/game/cemetery';
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