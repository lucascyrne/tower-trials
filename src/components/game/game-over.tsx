'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Skull } from 'lucide-react';
import { useGame } from '@/resources/game/game-hook';
import { useAuth } from '@/resources/auth/auth-hook';
import { RankingService } from '@/resources/game/ranking-service';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { formatLargeNumber } from '@/lib/utils';

export default function GameOver() {
  const router = useRouter();
  const { gameState } = useGame();
  const { player, highestFloor, gameMessage } = gameState;
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Função para salvar a pontuação no ranking e deletar o personagem
  const handleGameOver = async () => {
    try {
      setIsSaving(true);
      setIsDeleting(true);
      
      // Salvar pontuação no ranking com informações completas
      const rankingResponse = await RankingService.saveScore({
        player_name: player.name,
        highest_floor: player.floor - 1, // -1 porque o jogador morreu no andar atual
        user_id: user?.id || '',
        character_level: player.level,
        character_gold: player.gold,
        character_alive: false // Personagem morreu
      });

      if (rankingResponse.error) {
        throw new Error(rankingResponse.error);
      }

      // Deletar personagem (permadeath)
      const { error: deleteError } = await CharacterService.deleteCharacter(player.id);
      if (deleteError) {
        throw new Error(deleteError);
      }

      toast.success('Fim de jogo', {
        description: 'Pontuação salva e personagem deletado permanentemente.',
      });
      
      router.push('/game/play');
    } catch (error: unknown) {
      toast.error('Erro ao finalizar jogo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      console.error('Erro ao finalizar jogo:', error);
    } finally {
      setIsSaving(false);
      setIsDeleting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Skull className="h-8 w-8 text-red-500" />
          Fim de Jogo
        </CardTitle>
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
          <h3 className="font-medium mb-2">Estatísticas Finais</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Personagem:</div>
            <div className="font-medium">{player.name}</div>
            
            <div>Andares concluídos:</div>
            <div className="font-medium">{player.floor - 1}</div>
            
            <div>HP final:</div>
            <div className="font-medium">{player.hp}/{player.max_hp}</div>
            
            <div>Nível alcançado:</div>
            <div className="font-medium">{player.level}</div>
            
            <div>Gold acumulado:</div>
            <div className="font-medium">{formatLargeNumber(player.gold)}</div>
            
            <div>XP total:</div>
            <div className="font-medium">{formatLargeNumber(player.xp)}</div>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
          <p className="text-sm text-red-400 mb-2">
            <strong>Aviso de Permadeath:</strong> Este personagem será permanentemente deletado ao continuar.
          </p>
          <p className="text-xs text-red-300">
            Suas estatísticas serão salvas no ranking para comparação com outros jogadores.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full"
          variant="destructive"
          onClick={handleGameOver}
          disabled={isSaving || isDeleting}
        >
          {isSaving || isDeleting ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              Finalizando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Skull className="h-4 w-4" />
              Aceitar Derrota e Salvar Pontuação
            </span>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/game/ranking')}
          className="w-full"
          disabled={isSaving || isDeleting}
        >
          <Trophy className="h-4 w-4 mr-2" />
          Ver Ranking
        </Button>
      </CardFooter>
    </Card>
  );
} 