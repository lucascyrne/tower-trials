'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/resources/game/game-hook';
import { ActionType } from '@/resources/game/game-model';
import { BattleArena } from './BattleArena';
import { CombinedBattleInterface } from './CombinedBattleInterface';
import { useRouter, useSearchParams } from 'next/navigation';
import { VictoryModal } from './VictoryModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skull, Eye } from 'lucide-react';
import { toast } from 'sonner';
import SpecialEventPanel from './SpecialEventPanel';
import AttributeDistributionModal from './AttributeDistributionModal';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';

import { BattleHeader } from './BattleHeader';
import { GameLog } from './GameLog';
import { CharacterService } from '@/resources/game/character.service';
import { QuickActionPanel } from './QuickActionPanel';

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

  // OTIMIZADO: Processamento de recompensas sem duplicação
  useEffect(() => {
    if (!gameState.battleRewards) {
      return;
    }

    // Gerar chave única baseada no estado da batalha (sem timestamp)
    const battleKey = `${player.floor}-${player.level}-${gameState.battleRewards.xp}-${gameState.battleRewards.gold}`;
    
    // Verificar se já processamos esta recompensa específica
    if (processedRewardsRef.current.has(battleKey)) {
      console.log(`[GameBattle] Recompensa já processada: ${battleKey}`);
      return;
    }

    // Verificar se mudou de batalha (andar diferente)
    const currentBattleState = {
      floor: player.floor,
      enemyName: currentEnemy?.name || 'unknown',
      rewardsProcessed: true
    };

    // Se mudou de andar, limpar recompensas processadas anteriores
    if (lastBattleStateRef.current.floor !== currentBattleState.floor) {
      console.log(`[GameBattle] Mudou de andar (${lastBattleStateRef.current.floor} -> ${currentBattleState.floor}), limpando recompensas processadas`);
      processedRewardsRef.current.clear();
    }

    // Marcar como processada ANTES do processamento para evitar condições de corrida
    processedRewardsRef.current.add(battleKey);
    lastBattleStateRef.current = currentBattleState;

    console.log(`[GameBattle] Processando recompensa: XP ${gameState.battleRewards.xp}, Gold ${gameState.battleRewards.gold}, Andar ${player.floor}`);
    
    const battleRewards = gameState.battleRewards;
    
    setVictoryRewards({
      xp: battleRewards.xp,
      gold: battleRewards.gold,
      drops: battleRewards.drops || [],
      leveledUp: battleRewards.leveledUp,
      newLevel: battleRewards.newLevel
    });
    
    setShowVictoryModal(true);
    
    const victoryMessage = `Vitória! Você derrotou o inimigo e recebeu ${battleRewards.xp} XP e ${battleRewards.gold} Gold.`;
    addGameLogMessage(victoryMessage, 'system');
    
    if (battleRewards.leveledUp && battleRewards.newLevel) {
      addGameLogMessage(`Você subiu para o nível ${battleRewards.newLevel}!`, 'system');
    }
  }, [gameState.battleRewards, player.floor, player.level, currentEnemy?.name]);

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

  // Função para executar ações do jogador
  const handleAction = async (action: ActionType, spellId?: string) => {
    // CRÍTICO: Sistema robusto de prevenção de ações duplicadas
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
    
    // 3. Bloquear todas as ações se o personagem está morto
    if (gameState.mode === 'gameover') {
      console.warn('[GameBattle] Ação bloqueada - personagem está morto');
      return;
    }
    
    // 4. Bloquear ações durante fuga
    if (gameState.mode === 'fled') {
      console.warn('[GameBattle] Ação bloqueada - processo de fuga em andamento');
      return;
    }
    
    if (!isPlayerTurn) {
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
    } finally {
      // Limpar estado de processamento após a ação
      setTimeout(() => {
        actionProcessingRef.current = false;
      }, 100);
    }
  };

  // Função para continuar a aventura após derrotar um inimigo
  const handleContinueAdventure = async () => {
    console.log("[GameBattle] === CONTINUAR AVENTURA ===");
    console.log("[GameBattle] Estado atual:", {
      floor: gameState.player.floor,
      hasRewards: !!gameState.battleRewards,
      hasEnemy: !!gameState.currentEnemy,
      enemyHp: gameState.currentEnemy?.hp
    });
    
    setShowVictoryModal(false);
    
    try {
      console.log("[GameBattle] Chamando performAction('continue')...");
      await performAction('continue');
      console.log("[GameBattle] performAction('continue') concluído com sucesso");
    } catch (error) {
      console.error("[GameBattle] Erro ao avançar:", error);
      toast.error("Erro ao avançar para o próximo andar");
      setShowVictoryModal(true);
    }
  };

  const handleReturnToHub = () => {
    router.push(`/game/play/hub?character=${gameState.player.id}`);
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

        {/* Arena de Batalha Unificada */}
        {currentEnemy && (
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
            
            <BattleArena 
              player={player}
              currentEnemy={currentEnemy}
              playerHpPercentage={playerHpPercentage}
              playerManaPercentage={playerManaPercentage}
              enemyHpPercentage={enemyHpPercentage}
              isPlayerTurn={isPlayerTurn}
            />
          </div>
        )}

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
              isFleeInProgress={gameState.mode === 'fled'}
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

      <Dialog open={showDeathModal} onOpenChange={setShowDeathModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Skull className="h-6 w-6" />
              {gameState.characterDeleted ? 'Permadeath - Personagem Perdido' : 'Seu Personagem Morreu'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg space-y-3">
              <div className="text-sm">
                <strong>{player.name}</strong> foi derrotado no Andar {player.floor}...
              </div>
              {gameState.characterDeleted ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Devido ao sistema de <strong>Permadeath</strong>, seu personagem foi perdido para sempre. 
                    Todos os itens, equipamentos e progressos foram perdidos.
                  </div>
                  <div className="text-sm text-yellow-400 font-medium">
                    Seus dados foram movidos para o cemitério onde você pode revisar sua jornada.
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Mas não desista! Crie um novo personagem e tente novamente, 
                    usando a experiência adquirida para chegar ainda mais longe.
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Ocorreu um erro ao processar a morte do personagem. 
                  Tente novamente ou entre em contato com o suporte.
                </div>
              )}
            </div>
            {gameState.characterDeleted && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                <div className="text-xs text-blue-400">
                  💀 <strong>Estatísticas da Jornada:</strong><br/>
                  • Nível alcançado: {player.level}<br/>
                  • Andar mais alto: {player.floor}<br/>
                  • Gold acumulado: {player.gold}<br/>
                  • XP total: {player.xp}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {gameState.characterDeleted && (
              <Button
                variant="outline"
                onClick={() => {
                  // Navegar para o cemitério primeiro
                  window.location.href = '/game/cemetery';
                }}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Cemitério
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleReturnToCharacterSelect}
            >
              <Skull className="h-4 w-4 mr-2" />
              {gameState.characterDeleted ? 'Criar Novo Personagem' : 'Voltar à Seleção'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AttributeDistributionModal 
        isOpen={showAttributeModal}
        onClose={() => setShowAttributeModal(false)}
        character={player}
      />


    </>
  );
} 