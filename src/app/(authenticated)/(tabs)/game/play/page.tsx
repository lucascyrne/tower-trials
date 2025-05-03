'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import GameBattle from '@/components/game/game-battle';
import GameOver from '@/components/game/game-over';
import { CharacterSelect } from '@/components/game/CharacterSelect';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function GamePlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { gameState, gameMessage, startGame } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Carregar personagem selecionado
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      const characterId = searchParams.get('character');
      if (!characterId) return;

      setIsLoading(true);
      try {
        const response = await CharacterService.getCharacter(characterId);
        if (response.success && response.data) {
          startGame(response.data.name);
        } else {
          toast.error('Erro ao carregar personagem', {
            description: response.error
          });
        }
      } catch (error) {
        console.error('Erro ao carregar personagem:', error);
        toast.error('Erro ao carregar personagem');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
  }, [searchParams]);

  const handleStartGame = () => {
    if (!playerName.trim()) {
      return;
    }
    startGame(playerName.trim());
  };

  // Renderizar componente com base no modo de jogo
  const renderGameContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    // Se não tiver characterId na URL, mostrar seleção de personagens
    if (!searchParams.get('character')) {
      return <CharacterSelect />;
    }

    switch (gameState.mode) {
      case 'menu':
        return (
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Novo Jogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gameMessage && (
                <Alert className="bg-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{gameMessage}</AlertDescription>
                </Alert>
              )}
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
        return <CharacterSelect />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      {renderGameContent()}
    </div>
  );
} 