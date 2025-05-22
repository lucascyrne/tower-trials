'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Backpack } from 'lucide-react';
import { useGame } from '@/resources/game/game-hook';
import { ActionType } from '@/resources/game/game-model';
import { EquipmentPanel } from './EquipmentPanel';
import { EquipmentShop } from './EquipmentShop';
import { PlayerInfo } from './PlayerInfo';
import { EnemyInfo } from './EnemyInfo';
import { BattleActions } from './BattleActions';
import { useRouter, useSearchParams } from 'next/navigation';
import { VictoryModal } from './VictoryModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skull } from 'lucide-react';
import { toast } from 'sonner';

import { BattleHeader } from './BattleHeader';
import { GameLog } from './GameLog';

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
  const { gameState, performAction, loading, gameLog, addGameLogMessage, selectCharacter } = useGame();
  const { player, currentEnemy, currentFloor, isPlayerTurn, gameMessage } = gameState;
  const [showEquipment, setShowEquipment] = useState<'none' | 'inventory' | 'shop'>('none');
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messageProcessedRef = useRef<Set<string>>(new Set());
  const characterLoadedRef = useRef(false); // Para evitar carregamentos duplicados
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

  // Processamento de recompensas de batalha
  useEffect(() => {
    if (gameState.battleRewards) {
      const rewardKey = `${gameState.currentEnemy?.name}-${gameState.battleRewards.xp}-${gameState.battleRewards.gold}-${gameState.player.floor}`;
      
      if (!messageProcessedRef.current.has(rewardKey)) {
        console.log(`[GameBattle] Processando recompensa: ${rewardKey}`);
        messageProcessedRef.current.add(rewardKey);
        
        const battleRewards = gameState.battleRewards;
        
        setVictoryRewards({
          xp: battleRewards.xp,
          gold: battleRewards.gold,
          drops: battleRewards.drops || [],
          leveledUp: battleRewards.leveledUp,
          newLevel: battleRewards.newLevel
        });
        
        // Mostrar modal imediatamente após receber as recompensas
        setShowVictoryModal(true);
        
        const victoryMessage = `Vitória! Você derrotou ${gameState.currentEnemy?.name || 'o inimigo'} e recebeu ${battleRewards.xp} XP e ${battleRewards.gold} Gold.`;
        addGameLogMessage(victoryMessage, 'system');
        
        if (battleRewards.leveledUp && battleRewards.newLevel) {
          addGameLogMessage(`Você subiu para o nível ${battleRewards.newLevel}!`, 'system');
        }
      }
    }
  }, [gameState.battleRewards]);

  // Verificação de game over
  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0) {
      setShowDeathModal(true);
    }
  }, [gameState.mode, player.hp]);

  // Carregamento inicial do personagem
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      // Evitar carregamentos duplicados do mesmo personagem
      if (characterLoadedRef.current) {
        return;
      }
      
      setIsLoading(true);
      
      const characterId = searchParams.get('character');
      if (!characterId) {
        router.push('/game/play');
        return;
      }

      try {
        console.log(`[GameBattle] Carregando personagem: ${characterId}`);
        const { CharacterService } = await import('@/resources/game/character.service');
        const response = await CharacterService.getCharacter(characterId);
        
        if (response.success && response.data) {
          characterLoadedRef.current = true;
          await selectCharacter(response.data);
        } else {
          toast.error('Erro ao carregar personagem', {
            description: response.error
          });
          router.push('/game/play');
        }
      } catch (error) {
        console.error('Erro ao carregar personagem:', error);
        toast.error('Erro ao carregar personagem');
        router.push('/game/play');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
    
    // Cleanup function para garantir que não há requisições desnecessárias
    return () => {
      messageProcessedRef.current.clear();
    };
  }, [searchParams]);

  // Função para retornar à seleção de personagens
  const handleReturnToCharacterSelect = () => {
    router.push('/game/play');
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

  // Se não há inimigo ou andar, não renderizar a batalha
  if (!currentEnemy || !currentFloor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Transicionando...</h2>
          <p className="text-muted-foreground">Preparando próximo andar</p>
        </div>
      </div>
    );
  }

  const enemyHpPercentage = (currentEnemy.hp / currentEnemy.maxHp) * 100;
  const playerHpPercentage = (player.hp / player.max_hp) * 100;
  const playerManaPercentage = (player.mana / player.max_mana) * 100;

  // Função para executar ações do jogador
  const handleAction = async (action: ActionType, spellId?: string) => {
    if (!isPlayerTurn) return;
    
    await performAction(action, spellId);
  };

  // Função para continuar a aventura após derrotar um inimigo
  const handleContinueAdventure = async () => {
    console.log("[GameBattle] Iniciando transição para o próximo andar");
    console.log("[GameBattle] Chamando performAction('continue')...");
    
    setShowVictoryModal(false);
    
    try {
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

  const getHpColor = (percentage: number) => {
    if (percentage > 60) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleEquipmentChange = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="w-full max-w-6xl">
        <BattleHeader currentFloor={currentFloor} playerLevel={player.level} gameMessage={gameMessage} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <EnemyInfo currentEnemy={currentEnemy} enemyHpPercentage={enemyHpPercentage} getHpColor={getHpColor} />
          <PlayerInfo player={player} playerHpPercentage={playerHpPercentage} playerManaPercentage={playerManaPercentage} getHpColor={getHpColor} />
          <Card className="overflow-hidden">
            <CardHeader className="bg-card/95 pb-2">
              <CardTitle className="text-center text-lg">Equipamentos</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-4">
                <Button
                  onClick={() => setShowEquipment(showEquipment === 'inventory' ? 'none' : 'inventory')}
                  className="flex items-center gap-2"
                  variant={showEquipment === 'inventory' ? 'secondary' : 'outline'}
                >
                  <Backpack className="h-4 w-4" />
                  Inventário
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {showEquipment !== 'none' && (
          <Card className="mb-6">
            <CardContent className="p-4">
              {showEquipment === 'inventory' ? (
                <EquipmentPanel 
                  character={player} 
                  onEquipmentChange={handleEquipmentChange} 
                />
              ) : (
                <EquipmentShop 
                  character={player} 
                  onPurchase={handleEquipmentChange} 
                />
              )}
            </CardContent>
          </Card>
        )}

        <BattleActions handleAction={handleAction} isPlayerTurn={isPlayerTurn} loading={loading} player={player} />

        <GameLog gameLog={gameLog} />
      </div>

      <VictoryModal
        isOpen={showVictoryModal}
        onContinue={handleContinueAdventure}
        onReturnToHub={handleReturnToHub}
        rewards={victoryRewards}
        leveledUp={victoryRewards.leveledUp}
        newLevel={victoryRewards.newLevel}
      />

      <Dialog open={showDeathModal} onOpenChange={setShowDeathModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Skull className="h-6 w-6" />
              Seu Personagem Morreu
            </DialogTitle>
            <DialogDescription className="text-base space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg space-y-3">
                <p className="text-sm">
                  <strong>{player.name}</strong> foi derrotado no Andar {player.floor}...
                </p>
                <p className="text-sm text-muted-foreground">
                  Infelizmente, devido ao sistema de Permadeath, seu personagem foi perdido para sempre. 
                  Todos os itens, equipamentos e progressos foram perdidos.
                </p>
                <p className="text-sm text-muted-foreground">
                  Mas não desista! Crie um novo personagem e tente novamente, 
                  usando a experiência adquirida para chegar ainda mais longe.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleReturnToCharacterSelect}
            >
              <Skull className="h-4 w-4 mr-2" />
              Criar Novo Personagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 