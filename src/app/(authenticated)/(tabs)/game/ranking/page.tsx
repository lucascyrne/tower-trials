'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RankingService, RankingEntry, RankingMode } from '@/resources/game/ranking-service';
import { useAuth } from '@/resources/auth/auth-hook';
import RankingFilters, { CharacterStatusFilter } from './components/ranking-filters';
import RankingTable from './components/ranking-table';
import UserStats from './components/user-stats';

export default function RankingPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Estados para dados
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [userRanking, setUserRanking] = useState<RankingEntry[]>([]);
  const [userStats, setUserStats] = useState({
    bestFloor: 0,
    bestLevel: 1,
    bestGold: 0,
    totalRuns: 0,
    aliveCharacters: 0
  });
  
  // Estados para filtros e UI
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'personal'>('global');
  const [rankingMode, setRankingMode] = useState<RankingMode>('highest_floor');
  const [statusFilter, setStatusFilter] = useState<CharacterStatusFilter>('all');

  useEffect(() => {
    fetchRankingData();
  }, [user, rankingMode, statusFilter]);

  const fetchRankingData = async () => {
    try {
      setIsLoading(true);
      
      // Buscar ranking global
      const globalResponse = await RankingService.getGlobalRanking(rankingMode, 10, statusFilter);
      
      if (globalResponse.error) {
        console.error('Erro ao buscar ranking global:', globalResponse.error);
      } else {
        setRankingData(globalResponse.data);
      }
      
      // Buscar dados do usuário se estiver logado
      if (user?.id) {
        const [userRankingResponse, userStatsResponse] = await Promise.all([
          RankingService.getUserRanking(user.id, 10),
          RankingService.getUserStats(user.id)
        ]);
        
        if (userRankingResponse.error) {
          console.error('Erro ao buscar ranking do usuário:', userRankingResponse.error);
        } else {
          setUserRanking(userRankingResponse.data);
        }
        
        if (userStatsResponse.error) {
          console.error('Erro ao buscar estatísticas do usuário:', userStatsResponse.error);
        } else {
          setUserStats(userStatsResponse.data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do ranking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModeTitle = (mode: RankingMode): string => {
    switch (mode) {
      case 'highest_floor':
        return 'Ranking por Andar Mais Alto';
      case 'level':
        return 'Ranking por Maior Nível';
      case 'gold':
        return 'Ranking por Mais Rico';
      default:
        return 'Ranking';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/game')}
              className="self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Voltar ao Menu</span>
              <span className="sm:hidden">Voltar</span>
            </Button>
            
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {getModeTitle(rankingMode)}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {statusFilter === 'alive' ? 'Apenas personagens vivos' : 
                 statusFilter === 'dead' ? 'Apenas personagens mortos' : 
                 'Todos os personagens'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Filtros e Estatísticas */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <h2 className="text-lg font-medium">Filtros</h2>
              </CardHeader>
              <CardContent>
                <RankingFilters
                  activeMode={rankingMode}
                  onModeChange={setRankingMode}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                />
              </CardContent>
            </Card>

            {/* Estatísticas do usuário */}
            {user && userRanking.length > 0 && (
              <UserStats stats={userStats} userRanking={userRanking} />
            )}
          </div>

          {/* Conteúdo principal */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                {/* Tabs para alternar entre ranking global e pessoal */}
                {user && (
                  <div className="flex border-b">
                    <button
                      className={`pb-2 px-4 text-sm font-medium ${
                        activeTab === 'global' 
                          ? 'border-b-2 border-primary text-primary' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab('global')}
                    >
                      Ranking Global
                    </button>
                    <button
                      className={`pb-2 px-4 text-sm font-medium ${
                        activeTab === 'personal' 
                          ? 'border-b-2 border-primary text-primary' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab('personal')}
                    >
                      Meu Histórico
                    </button>
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <RankingTable
                    entries={activeTab === 'global' ? rankingData : userRanking}
                    mode={rankingMode}
                    currentUserId={user?.id}
                  />
                )}
              </CardContent>
              
              <CardFooter className="flex flex-col space-y-3">
                <Button 
                  onClick={() => router.push('/game')}
                  variant="outline" 
                  className="w-full"
                >
                  Voltar ao Menu
                </Button>
                
                <Button 
                  onClick={() => router.push('/game/play')}
                  variant="default" 
                  className="w-full"
                >
                  Iniciar Novo Jogo
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 