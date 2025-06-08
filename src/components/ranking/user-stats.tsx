import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Coins, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLargeNumber } from '@/utils/number-utils';

interface UserStatsProps {
  stats: {
    bestFloor: number;
    bestLevel: number;
    bestGold: number;
    totalRuns: number;
    aliveCharacters: number;
  };
  userRanking: Array<{
    highest_floor: number;
    character_level: number;
    character_gold: number;
    character_alive: boolean;
    created_at: string;
  }>;
}

const UserStats: React.FC<UserStatsProps> = ({ stats, userRanking }) => {
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const [isLastRunExpanded, setIsLastRunExpanded] = useState(false);
  
  const lastRun = userRanking[0];
  
  return (
    <div className="space-y-4">
      {/* Estatísticas Principais - Minimalista */}
      <Card>
        <CardHeader className="pb-3">
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
          >
            <CardTitle className="text-lg font-medium">Suas Conquistas</CardTitle>
            {isStatsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CardHeader>
        
        {isStatsExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Melhor Andar */}
              <div className="text-center p-4 bg-muted/30 rounded-lg border">
                <Trophy className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <div className="text-2xl font-bold mb-1">
                  {stats.bestFloor}
                </div>
                <div className="text-xs text-muted-foreground">
                  Melhor Andar
                </div>
              </div>
              
              {/* Maior Nível */}
              <div className="text-center p-4 bg-muted/30 rounded-lg border">
                <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <div className="text-2xl font-bold mb-1">
                  {stats.bestLevel}
                </div>
                <div className="text-xs text-muted-foreground">
                  Maior Nível
                </div>
              </div>
              
              {/* Mais Rico */}
              <div className="text-center p-4 bg-muted/30 rounded-lg border">
                <Coins className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                 <div className="text-xl font-bold mb-1" title={`${stats.bestGold.toLocaleString('pt-BR')} Gold`}>
                   {formatLargeNumber(stats.bestGold)}
                 </div>
                <div className="text-xs text-muted-foreground">
                  Mais Rico
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Última Tentativa - Colapsável */}
      {lastRun && (
        <Card>
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
              onClick={() => setIsLastRunExpanded(!isLastRunExpanded)}
            >
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Última Tentativa
              </CardTitle>
              {isLastRunExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CardHeader>
          
          {isLastRunExpanded && (
            <CardContent className="pt-0">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {lastRun.character_alive ? (
                    <span className="text-sm">❤️</span>
                  ) : (
                    <span className="text-sm">💀</span>
                  )}
                  <div>
                    <div className="font-medium text-sm">
                      {lastRun.character_alive ? 'Vivo' : 'Morto'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(lastRun.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">Andar {lastRun.highest_floor}</div>
                  <div className="text-xs text-muted-foreground">
                    Nível {lastRun.character_level}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Resumo Compacto */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total de Tentativas:</span>
            <span className="font-medium">{stats.totalRuns}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserStats; 