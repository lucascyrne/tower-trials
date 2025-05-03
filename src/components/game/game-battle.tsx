'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Sword, Zap, Star, Sparkles, ShoppingBag, Backpack } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useGame } from '@/resources/game/game-hook';
import { ActionType } from '@/resources/game/game-model';
import { FloorType } from '@/resources/game/game-model';
import { PlayerSpell } from '@/resources/game/models/spell.model';
import { EquipmentPanel } from './EquipmentPanel';
import { EquipmentShop } from './EquipmentShop';

export default function GameBattle() {
  const { gameState, performAction } = useGame();
  const { player, currentEnemy, currentFloor, isPlayerTurn, gameMessage } = gameState;
  const [showEquipment, setShowEquipment] = useState<'none' | 'inventory' | 'shop'>('none');

  if (!currentEnemy || !currentFloor) return null;

  const handleAction = (action: ActionType, spellId?: string) => {
    if (isPlayerTurn) {
      performAction(action, spellId);
    }
  };

  const playerHpPercentage = (player.hp / player.max_hp) * 100;
  const enemyHpPercentage = (currentEnemy.hp / currentEnemy.maxHp) * 100;
  const playerManaPercentage = (player.mana / player.max_mana) * 100;

  // Obter a cor da barra de vida baseada na porcentagem
  const getHpColor = (percentage: number) => {
    if (percentage > 60) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Obter ícone do tipo de andar
  const getFloorIcon = (type: FloorType) => {
    switch (type) {
      case 'boss': return '👑';
      case 'elite': return '⭐';
      case 'event': return '❓';
      default: return '🗺️';
    }
  };

  // Renderizar botão de magia
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
    // Recarregar o personagem para atualizar os stats
    window.location.reload();
  };

  return (
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
        {/* Card do Inimigo */}
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
              {/* Efeitos ativos no inimigo */}
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

        {/* Card do Jogador */}
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
              {/* Efeitos ativos no jogador */}
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

        {/* Card de Equipamentos/Loja */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-card/95 pb-2">
            <CardTitle className="text-center text-lg">Equipamentos & Loja</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => setShowEquipment(showEquipment === 'inventory' ? 'none' : 'inventory')}
                className="flex items-center gap-2"
                variant={showEquipment === 'inventory' ? 'secondary' : 'outline'}
              >
                <Backpack className="h-4 w-4" />
                Inventário
              </Button>
              <Button
                onClick={() => setShowEquipment(showEquipment === 'shop' ? 'none' : 'shop')}
                className="flex items-center gap-2"
                variant={showEquipment === 'shop' ? 'secondary' : 'outline'}
              >
                <ShoppingBag className="h-4 w-4" />
                Loja
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Equipamentos ou Loja */}
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

      {/* Ações do Jogador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-center text-lg">Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Button
              onClick={() => handleAction('attack')}
              disabled={!isPlayerTurn}
              className="flex flex-col items-center justify-center h-24"
              variant="outline"
            >
              <Sword className="h-8 w-8 mb-1" />
              <span>Atacar</span>
            </Button>
            
            <Button
              onClick={() => handleAction('defend')}
              disabled={!isPlayerTurn}
              className="flex flex-col items-center justify-center h-24"
              variant="outline"
            >
              <Shield className="h-8 w-8 mb-1" />
              <span>Defender</span>
            </Button>
            
            <Button
              onClick={() => handleAction('special')}
              disabled={!isPlayerTurn || player.specialCooldown > 0}
              className="flex flex-col items-center justify-center h-24"
              variant={player.specialCooldown > 0 ? "secondary" : "outline"}
            >
              <Zap className="h-8 w-8 mb-1" />
              <span>{player.specialCooldown > 0 ? `CD: ${player.specialCooldown}` : "Especial"}</span>
            </Button>
          </div>

          {/* Magias */}
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
    </div>
  );
} 