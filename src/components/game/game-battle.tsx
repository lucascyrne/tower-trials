'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Sword, Star, Sparkles, Backpack } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGame } from '@/resources/game/game-hook';
import { ActionType } from '@/resources/game/game-model';
import { FloorType } from '@/resources/game/game-model';
import { PlayerSpell } from '@/resources/game/models/spell.model';
import { EquipmentPanel } from './EquipmentPanel';
import { EquipmentShop } from './EquipmentShop';
import { ConsumablesPanel } from './ConsumablesPanel';
import { useRouter, useSearchParams } from 'next/navigation';
import { VictoryModal } from './VictoryModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skull } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";

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
  const [victoryRewards, setVictoryRewards] = useState<BattleRewards>({
    xp: 0,
    gold: 0,
    drops: [],
    leveledUp: false,
    newLevel: 0
  });

  useEffect(() => {
    if (gameState.battleRewards) {
      const rewardKey = `${gameState.currentEnemy?.name}-${gameState.battleRewards.xp}-${gameState.battleRewards.gold}`;
      
      if (!messageProcessedRef.current.has(rewardKey)) {
        messageProcessedRef.current.add(rewardKey);
        
        console.log(`Processando recompensa: ${rewardKey}`);
        
        setVictoryRewards({
          xp: gameState.battleRewards.xp,
          gold: gameState.battleRewards.gold,
          drops: gameState.battleRewards.drops || [],
          leveledUp: gameState.battleRewards.leveledUp,
          newLevel: gameState.battleRewards.newLevel
        });
        setShowVictoryModal(true);
        
        const victoryMessage = `Vitória! Você derrotou ${gameState.currentEnemy?.name || 'o inimigo'} e recebeu ${gameState.battleRewards.xp} XP e ${gameState.battleRewards.gold} Gold.`;
        addGameLogMessage(victoryMessage, 'system');
        
        if (gameState.battleRewards.leveledUp && gameState.battleRewards.newLevel) {
          addGameLogMessage(`Você subiu para o nível ${gameState.battleRewards.newLevel}!`, 'system');
        }
      }
    }
  }, [gameState.battleRewards, gameState.currentEnemy]);

  useEffect(() => {
    if (gameState.mode === 'gameover' && player.hp <= 0) {
      setShowDeathModal(true);
    }
  }, [gameState.mode, player.hp]);

  useEffect(() => {
    const loadSelectedCharacter = async () => {
      setIsLoading(true);
      
      const characterId = searchParams.get('character');
      if (!characterId) {
        router.push('/game/play');
        return;
      }

      try {
        const { CharacterService } = await import('@/resources/game/character.service');
        const response = await CharacterService.getCharacter(characterId);
        
        if (response.success && response.data) {
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
  }, [searchParams]);

  const handleReturnToCharacterSelect = () => {
    router.push('/game/play');
  };

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

  if (!currentEnemy || !currentFloor) return null;

  const enemyHpPercentage = (currentEnemy.hp / currentEnemy.maxHp) * 100;
  const playerHpPercentage = (player.hp / player.max_hp) * 100;
  const playerManaPercentage = (player.mana / player.max_mana) * 100;

  const handleAction = async (action: ActionType, spellId?: string) => {
    if (!isPlayerTurn) return;
    
    await performAction(action, spellId);
  };

  const handleContinueAdventure = async () => {
    console.log("Iniciando transição para o próximo andar");
    
    setShowVictoryModal(false);
    
    setTimeout(async () => {
      if (gameState.battleRewards) {
        try {
          await performAction('continue');
          
          const currentRewardKey = `${gameState.currentEnemy?.name}-${gameState.battleRewards.xp}-${gameState.battleRewards.gold}`;
          messageProcessedRef.current.delete(currentRewardKey);
          
          if (currentFloor) {
            toast.success(`Avançando para o Andar ${player.floor}`, {
              description: currentFloor.description
            });
          }
        } catch (error) {
          console.error("Erro ao avançar para o próximo andar:", error);
          toast.error("Erro ao avançar para o próximo andar");
        }
      }
    }, 100);
  };

  const handleReturnToHub = () => {
    router.push(`/game/play/hub?character=${gameState.player.id}`);
  };

  const getHpColor = (percentage: number) => {
    if (percentage > 60) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getFloorIcon = (type: FloorType) => {
    switch (type) {
      case 'boss': return '👑';
      case 'elite': return '⭐';
      case 'event': return '❓';
      default: return '🗺️';
    }
  };

  const renderSpellButton = (spell: PlayerSpell) => (
    <Button
      key={spell.id}
      onClick={() => handleAction('spell', spell.id)}
      disabled={!isPlayerTurn || spell.current_cooldown > 0 || player.mana < spell.mana_cost}
      className="flex flex-col items-center justify-center h-24 relative"
      variant="outline"
    >
      <Sparkles className="h-8 w-8 mb-1" />
      <span>{spell.name}</span>
      {spell.current_cooldown > 0 && (
        <span className="absolute bottom-1 text-xs">
          CD: {spell.current_cooldown}
        </span>
      )}
      <span className="absolute top-1 right-1 text-xs text-blue-500">
        {spell.mana_cost}
      </span>
    </Button>
  );

  const handleEquipmentChange = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="w-full max-w-6xl">
        <div className="mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-primary">
                {getFloorIcon(currentFloor.type)} {currentFloor.description}
              </h2>
              {currentFloor.isCheckpoint && (
                <span className="bg-primary/20 text-primary text-sm px-2 py-1 rounded">
                  Checkpoint
                </span>
              )}
            </div>
            {player.level < currentFloor.minLevel && (
              <div className="text-yellow-500 text-sm mb-2">
                ⚠️ Nível recomendado: {currentFloor.minLevel}
              </div>
            )}
            <p className="text-foreground/80">{gameMessage}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-card/95 pb-2">
              <CardTitle className="text-center text-lg">{currentEnemy.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
                <div className="text-6xl font-bold text-muted-foreground">👾</div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>HP: {currentEnemy.hp}/{currentEnemy.maxHp}</span>
                    <span>{Math.round(enemyHpPercentage)}%</span>
                  </div>
                  <Progress 
                    value={enemyHpPercentage} 
                    className={`h-2 ${getHpColor(enemyHpPercentage)}`} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-2 rounded flex items-center gap-1">
                    <Sword className="h-4 w-4" />
                    <span>Ataque: {currentEnemy.attack}</span>
                  </div>
                  <div className="bg-muted p-2 rounded flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    <span>Defesa: {currentEnemy.defense}</span>
                  </div>
                </div>
                {Object.entries(currentEnemy.active_effects).map(([type, effects]) => 
                  effects.length > 0 && (
                    <div key={type} className="text-sm">
                      <span className="font-medium">{type}: </span>
                      {effects.map((e: { value: number; duration: number }) => 
                        `${e.value} (${e.duration})`
                      ).join(', ')}
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-card/95 pb-2">
              <CardTitle className="text-center text-lg">{player.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
                <div className="text-6xl font-bold text-muted-foreground">🧙</div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>HP: {player.hp}/{player.max_hp}</span>
                    <span>{Math.round(playerHpPercentage)}%</span>
                  </div>
                  <Progress 
                    value={playerHpPercentage} 
                    className={`h-2 ${getHpColor(playerHpPercentage)}`} 
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Mana: {player.mana}/{player.max_mana}</span>
                    <span>{Math.round(playerManaPercentage)}%</span>
                  </div>
                  <Progress 
                    value={playerManaPercentage} 
                    className="h-2 bg-blue-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-2 rounded flex items-center gap-1">
                    <Sword className="h-4 w-4" />
                    <span>Ataque: {player.atk}</span>
                  </div>
                  <div className="bg-muted p-2 rounded flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    <span>Defesa: {player.def}</span>
                  </div>
                  <div className="bg-muted p-2 rounded flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>Nível: {player.level}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between mb-1 text-sm">
                    <span>XP: {player.xp}/{player.xp_next_level}</span>
                    <span>{Math.round((player.xp / player.xp_next_level) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(player.xp / player.xp_next_level) * 100} 
                    className="h-2 bg-primary/20" 
                  />
                </div>
                {Object.entries(player.active_effects).map(([type, effects]) => 
                  effects.length > 0 && (
                    <div key={type} className="text-sm">
                      <span className="font-medium">{type}: </span>
                      {effects.map((e: { value: number; duration: number }) => 
                        `${e.value} (${e.duration})`
                      ).join(', ')}
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-lg">Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                onClick={() => handleAction('attack')} 
                className="flex-1"
                disabled={!gameState.player.isPlayerTurn || loading.performAction}
              >
                Atacar
              </Button>
              <Button 
                onClick={() => handleAction('defend')} 
                variant="outline" 
                className="flex-1"
                disabled={!gameState.player.isPlayerTurn || loading.performAction}
              >
                Defender
              </Button>
              <Button 
                onClick={() => handleAction('flee')} 
                variant="outline" 
                className="flex-1"
                disabled={!gameState.player.isPlayerTurn || loading.performAction}
              >
                Fugir
              </Button>
              <ConsumablesPanel />
            </div>

            {player.spells.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Magias</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {player.spells.map(renderSpellButton)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Log de Eventos</CardTitle>
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 rounded border p-2">
              {gameLog.map((log, index) => (
                <div 
                  key={index} 
                  className={`mb-2 text-sm ${
                    log.type === 'system' 
                      ? 'text-blue-500' 
                      : log.type === 'lore' 
                        ? 'text-purple-500 italic' 
                        : 'text-foreground'
                  }`}
                >
                  {log.text}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
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