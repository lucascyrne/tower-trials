'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Home } from 'lucide-react';
import { useGame } from '@/resources/game/game-hook';
import { useAuth } from '@/resources/auth/auth-hook';
import { RankingService } from '@/resources/game/ranking-service';
import { toast } from 'sonner';

export default function GameOver() {
  const router = useRouter();
  const { gameState, returnToMenu } = useGame();
  const { player, highestFloor, gameMessage } = gameState;
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Função para salvar a pontuação no ranking
  const saveScore = async () => {
    try {
      setIsSaving(true);
      
      const { success, error } = await RankingService.saveScore({
        player_name: player.name,
        highest_floor: player.floor - 1, // O andar em que o jogador foi derrotado
        user_id: user?.id,
      });

      if (!success) {
        throw new Error(error || 'Erro ao salvar pontuação');
      }
      
      toast.success('Pontuação salva com sucesso!');
      router.push('/game/ranking');
    } catch (error: unknown) {
      toast.error('Erro ao salvar pontuação', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      console.error('Erro ao salvar pontuação:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Fim de Jogo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-lg mb-2">{gameMessage}</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <span className="text-2xl font-bold">Andar {player.floor - 1}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Seu recorde atual: Andar {highestFloor}
          </p>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Estatísticas</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Personagem:</div>
            <div className="font-medium">{player.name}</div>
            
            <div>Andares concluídos:</div>
            <div className="font-medium">{player.floor - 1}</div>
            
            <div>HP final:</div>
            <div className="font-medium">{player.hp}/{player.max_hp}</div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        {user ? (
          <Button 
            onClick={saveScore} 
            className="w-full"
            variant="default"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center">
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                Salvando...
              </span>
            ) : (
              <>
                <Trophy className="h-4 w-4 mr-2" />
                Salvar Pontuação
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={() => router.push('/auth')} 
            className="w-full"
            variant="outline"
          >
            Entrar para Salvar Pontuação
          </Button>
        )}
        
        <Button 
          onClick={returnToMenu}
          className="w-full"
          variant="ghost"
        >
          <Home className="h-4 w-4 mr-2" />
          Voltar ao Menu
        </Button>
      </CardFooter>
    </Card>
  );
} 