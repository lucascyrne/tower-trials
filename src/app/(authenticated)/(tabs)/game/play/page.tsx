'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import GameBattle from '@/components/game/game-battle';
import GameOver from '@/components/game/game-over';
import { useGame } from '@/resources/game/game-hook';

export default function GamePlayPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const { gameState, startGame } = useGame();

  const handleStartGame = () => {
    if (!playerName.trim()) {
      return;
    }
    startGame(playerName.trim());
  };

  // Renderizar componente com base no modo de jogo
  const renderGameContent = () => {
    switch (gameState.mode) {
      case 'menu':
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Novo Jogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="playerName" className="text-sm font-medium">
                  Nome do Aventureiro
                </label>
                <Input
                  id="playerName"
                  placeholder="Insira seu nome"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartGame()}
                />
              </div>
              <div className="pt-4">
                <Button 
                  onClick={handleStartGame}
                  className="w-full" 
                  size="lg"
                  disabled={!playerName.trim()}
                >
                  Iniciar Aventura
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => router.push('/game')}
                variant="outline" 
                className="w-full"
              >
                Voltar ao Menu
              </Button>
            </CardFooter>
          </Card>
        );
      
      case 'battle':
        return <GameBattle />;
      
      case 'gameover':
        return <GameOver />;
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      {renderGameContent()}
    </div>
  );
} 