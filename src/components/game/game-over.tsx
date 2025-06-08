import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Skull, Eye, AlertTriangle } from 'lucide-react';
import { useGame } from '@/resources/game/game-hook';
import { useAuth } from '@/resources/auth/auth-hook';
import { RankingService } from '@/resources/game/ranking.service';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { formatLargeNumber } from '@/utils/number-utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useNavigate } from '@tanstack/react-router';

export default function GameOver() {
  const { gameState } = useGame();
  const navigate = useNavigate();
  const { player, highestFloor, gameMessage } = gameState;
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Usar hook para detectar mobile landscape
  const isMobileLandscape = useMediaQuery('(max-width: 768px) and (orientation: landscape) and (max-height: 600px)');

  // Função para salvar a pontuação no ranking e deletar o personagem
  const handleGameOver = async () => {
    try {
      setIsSaving(true);
      setIsDeleting(true);
      
      // Salvar pontuação no ranking com informações completas
      const rankingResponse = await RankingService.saveScore({
        player_name: player.name,
        floor: player.floor - 1, // -1 porque o jogador morreu no andar atual
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
      
      navigate({ to: '/game/play', search: { character: player.id } });
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
    <Card className={`w-full ${
      isMobileLandscape 
        ? 'max-w-[95vw] max-h-[95vh] flex flex-col' 
        : 'max-w-md'
    }`}>
      <CardHeader className={`text-center ${isMobileLandscape ? 'pb-3' : ''}`}>
        <CardTitle className={`flex items-center justify-center gap-2 ${
          isMobileLandscape ? 'text-lg' : 'text-2xl'
        }`}>
          <Skull className={`text-red-500 ${
            isMobileLandscape ? 'h-6 w-6' : 'h-8 w-8'
          }`} />
          {gameState.characterDeleted ? 'Permadeath - Personagem Perdido' : 'Fim de Jogo'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className={`${
        isMobileLandscape 
          ? 'space-y-3 overflow-y-auto flex-1 px-4' 
          : 'space-y-6'
      }`}>
        {/* Seção de Resumo */}
        <div className="text-center">
          <p className={`mb-2 ${
            isMobileLandscape ? 'text-sm' : 'text-lg'
          }`}>
            {gameMessage}
          </p>
          <div className={`flex items-center justify-center gap-2 mb-2 ${
            isMobileLandscape ? 'mb-2' : 'mb-4'
          }`}>
            <Trophy className={`text-yellow-500 ${
              isMobileLandscape ? 'h-5 w-5' : 'h-6 w-6'
            }`} />
            <span className={`font-bold ${
              isMobileLandscape ? 'text-lg' : 'text-2xl'
            }`}>
              Andar {player.floor - 1}
            </span>
          </div>
          <p className={`text-muted-foreground ${
            isMobileLandscape ? 'text-xs' : 'text-sm'
          }`}>
            Seu recorde atual: Andar {highestFloor}
          </p>
        </div>

        {/* Container Adaptativo para Layout Landscape */}
        <div className={isMobileLandscape ? 'grid grid-cols-2 gap-3' : 'space-y-4'}>
          {/* Estatísticas Finais */}
          <div className={`bg-muted rounded-lg ${
            isMobileLandscape ? 'p-3' : 'p-4'
          }`}>
            <h3 className={`font-medium mb-2 ${
              isMobileLandscape ? 'text-sm' : ''
            }`}>
              Estatísticas Finais
            </h3>
            <div className={`grid grid-cols-2 gap-1 ${
              isMobileLandscape ? 'text-xs' : 'gap-2 text-sm'
            }`}>
              <div>Personagem:</div>
              <div className="font-medium truncate">{player.name}</div>
              
              <div>Andares:</div>
              <div className="font-medium">{player.floor - 1}</div>
              
              <div>HP final:</div>
              <div className="font-medium">{player.hp}/{player.max_hp}</div>
              
              <div>Nível:</div>
              <div className="font-medium">{player.level}</div>
              
              <div>Gold:</div>
              <div className="font-medium">{formatLargeNumber(player.gold)}</div>
              
              <div>XP total:</div>
              <div className="font-medium">{formatLargeNumber(player.xp)}</div>
            </div>
          </div>

          {/* Aviso de Permadeath */}
          <div className={`bg-red-500/10 border border-red-500/20 rounded-lg ${
            isMobileLandscape ? 'p-3' : 'p-4'
          }`}>
            <div className={`flex items-center gap-2 mb-2 ${
              isMobileLandscape ? 'mb-1' : ''
            }`}>
              <AlertTriangle className={`text-red-400 ${
                isMobileLandscape ? 'h-4 w-4' : 'h-5 w-5'
              }`} />
              <span className={`font-medium text-red-400 ${
                isMobileLandscape ? 'text-xs' : 'text-sm'
              }`}>
                Aviso de Permadeath
              </span>
            </div>
            
            <p className={`text-red-400 mb-2 ${
              isMobileLandscape ? 'text-xs mb-1' : 'text-sm'
            }`}>
              Este personagem será permanentemente deletado ao continuar.
            </p>
            
            <p className={`text-red-300 ${
              isMobileLandscape ? 'text-xs' : 'text-xs'
            }`}>
              Suas estatísticas serão salvas no ranking para comparação com outros jogadores.
            </p>
          </div>
        </div>

        {/* Estatísticas da Jornada - Apenas se o personagem foi deletado */}
        {gameState.characterDeleted && (
          <div className={`bg-blue-500/10 border border-blue-500/20 rounded-lg ${
            isMobileLandscape ? 'p-3' : 'p-3'
          }`}>
            <div className={`text-blue-400 ${
              isMobileLandscape ? 'text-xs' : 'text-xs'
            }`}>
              💀 <strong>Estatísticas da Jornada:</strong><br/>
              <div className={`mt-1 ${
                isMobileLandscape ? 'grid grid-cols-2 gap-1' : ''
              }`}>
                <div>• Nível alcançado: {player.level}</div>
                <div>• Andar mais alto: {player.floor}</div>
                <div>• Gold acumulado: {player.gold}</div>
                <div>• XP total: {player.xp}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className={`flex gap-2 ${
        isMobileLandscape ? 'flex-row p-4' : 'flex-col'
      }`}>
        {gameState.characterDeleted && (
          <Button
            variant="outline"
            onClick={() => {
              // Navegar para o cemitério primeiro
              navigate({ to: '/game/cemetery', search: { character: player.id } });
            }}
            className={`border-blue-500/30 text-blue-400 hover:bg-blue-500/10 ${
              isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'
            }`}
          >
            <Eye className={`mr-2 ${
              isMobileLandscape ? 'h-3 w-3 mr-1' : 'h-4 w-4'
            }`} />
            {isMobileLandscape ? 'Cemitério' : 'Ver Cemitério'}
          </Button>
        )}
        
        <Button
          variant="destructive"
          onClick={handleGameOver}
          disabled={isSaving || isDeleting}
          className={`${
            isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'
          }`}
        >
          {isSaving || isDeleting ? (
            <span className="flex items-center gap-1">
              <div className={`animate-spin rounded-full border-t-2 border-b-2 border-white ${
                isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'
              }`}></div>
              {isMobileLandscape ? 'Finalizando...' : 'Finalizando...'}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Skull className={`${
                isMobileLandscape ? 'h-3 w-3' : 'h-4 w-4'
              }`} />
              {isMobileLandscape 
                ? 'Aceitar Derrota' 
                : (gameState.characterDeleted ? 'Criar Novo Personagem' : 'Aceitar Derrota e Salvar')
              }
            </span>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: '/game/ranking' })}
          className={`${
            isMobileLandscape ? 'flex-1 text-xs h-8' : 'w-full'
          }`}
          disabled={isSaving || isDeleting}
        >
          <Trophy className={`mr-2 ${
            isMobileLandscape ? 'h-3 w-3 mr-1' : 'h-4 w-4'
          }`} />
          {isMobileLandscape ? 'Ranking' : 'Ver Ranking'}
        </Button>
      </CardFooter>
    </Card>
  );
} 