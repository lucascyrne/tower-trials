'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Coins, Users, Heart, Calendar } from 'lucide-react';

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
  const lastRun = userRanking[0];
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suas Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.bestFloor}</div>
              <div className="text-xs text-muted-foreground">Melhor Andar</div>
            </div>
            
            <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <TrendingUp className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.bestLevel}</div>
              <div className="text-xs text-muted-foreground">Maior Nível</div>
            </div>
            
            <div className="text-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Coins className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.bestGold.toLocaleString('pt-BR')}</div>
              <div className="text-xs text-muted-foreground">Mais Rico</div>
            </div>
            
            <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Heart className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.aliveCharacters}</div>
              <div className="text-xs text-muted-foreground">Personagens Vivos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Última Tentativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Personagem:</span>
                <div className="font-medium flex items-center gap-2">
                  {lastRun.character_alive ? (
                    <Heart className="h-3 w-3 text-green-500" />
                  ) : (
                    <span className="h-3 w-3 text-red-500">💀</span>
                  )}
                  {lastRun.character_alive ? 'Vivo' : 'Morto'}
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Andar Alcançado:</span>
                <div className="font-medium">{lastRun.highest_floor}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Nível Final:</span>
                <div className="font-medium">{lastRun.character_level}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Ouro Final:</span>
                <div className="font-medium">{lastRun.character_gold.toLocaleString('pt-BR')}</div>
              </div>
              
              <div className="col-span-2">
                <span className="text-muted-foreground">Data:</span>
                <div className="font-medium">
                  {new Date(lastRun.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumo Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total de Tentativas:</span>
              <div className="font-medium">{stats.totalRuns}</div>
            </div>
            
            <div>
              <span className="text-muted-foreground">Taxa de Sobrevivência:</span>
              <div className="font-medium">
                {stats.totalRuns > 0 
                  ? `${Math.round((stats.aliveCharacters / stats.totalRuns) * 100)}%`
                  : '0%'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserStats; 