'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RankingService, RankingEntry, RankingMode } from '@/resources/game/ranking.service';
import { useAuth } from '@/resources/auth/auth-hook';
import RankingFilters, { CharacterStatusFilter } from '../../../../../components/ranking/ranking-filters';
import RankingTable from '../../../../../components/ranking/ranking-table';
import UserStats from '../../../../../components/ranking/user-stats';

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

  // Função para forçar atualização do ranking
  const refreshRanking = async () => {
    console.log('[RankingPage] Forçando atualização do ranking...');
    await fetchRankingData();
  };

  // Função para testar o sistema de ranking
  const testRankingSystem = async () => {
    console.log('[RankingPage] Testando sistema de ranking...');
    try {
      const testResult = await RankingService.testRankingSystem(user?.id);
      if (testResult.error) {
        console.error('Erro no teste:', testResult.error);
      } else {
        console.log('Resultado do teste:', testResult.data);
        // Mostrar resultado no console para debug
        testResult.data.forEach((test) => {
          console.log(`${test.test_name}: ${test.result} - ${test.details}`);
        });
      }
    } catch (error) {
      console.error('Erro ao executar teste:', error);
    }
  };

  const fetchRankingData = async () => {
    try {
      setIsLoading(true);
      
      console.log(`[RankingPage] Iniciando busca de dados - modo: ${rankingMode}, filtro: ${statusFilter}`);
      
      // Buscar ranking global dinâmico
      const globalResponse = await RankingService.getGlobalRanking(rankingMode, 20, statusFilter);
      
      console.log(`[RankingPage] Resposta do ranking global:`, {
        success: !globalResponse.error,
        error: globalResponse.error,
        dataLength: globalResponse.data?.length || 0,
        data: globalResponse.data
      });
      
      if (globalResponse.error) {
        console.error('Erro ao buscar ranking global:', globalResponse.error);
        setRankingData([]);
      } else {
        setRankingData(globalResponse.data || []);
        console.log(`[RankingPage] Ranking global carregado: ${globalResponse.data?.length || 0} entradas`);
        
        // Log detalhado dos dados recebidos
        if (globalResponse.data && globalResponse.data.length > 0) {
          console.log(`[RankingPage] Primeiros 5 personagens do ranking:`, 
            globalResponse.data.slice(0, 5).map(entry => ({
              name: entry.player_name,
              floor: entry.highest_floor,
              level: entry.character_level,
              alive: entry.character_alive,
              user_id: entry.user_id
            }))
          );
        }
      }
      
      // Buscar dados do usuário se estiver logado
      if (user?.id) {
        const [userRankingResponse, userStatsResponse] = await Promise.all([
          RankingService.getUserRanking(user.id, 15),
          RankingService.getUserStats(user.id)
        ]);
        
        if (userRankingResponse.error) {
          console.error('Erro ao buscar ranking do usuário:', userRankingResponse.error);
          setUserRanking([]);
        } else {
          setUserRanking(userRankingResponse.data || []);
          console.log(`[RankingPage] Ranking do usuário carregado: ${userRankingResponse.data?.length || 0} entradas`);
        }
        
        if (userStatsResponse.error) {
          console.error('Erro ao buscar estatísticas do usuário:', userStatsResponse.error);
          setUserStats({
            bestFloor: 0,
            bestLevel: 1,
            bestGold: 0,
            totalRuns: 0,
            aliveCharacters: 0
          });
        } else {
          setUserStats(userStatsResponse.data || {
            bestFloor: 0,
            bestLevel: 1,
            bestGold: 0,
            totalRuns: 0,
            aliveCharacters: 0
          });
          console.log(`[RankingPage] Estatísticas do usuário carregadas:`, userStatsResponse.data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do ranking:', error);
      setRankingData([]);
      setUserRanking([]);
      setUserStats({
        bestFloor: 0,
        bestLevel: 1,
        bestGold: 0,
        totalRuns: 0,
        aliveCharacters: 0
      });
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
            
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {getModeTitle(rankingMode)}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {statusFilter === 'alive' ? 'Apenas personagens vivos' : 
                   statusFilter === 'dead' ? 'Apenas personagens mortos' : 
                   'Todos os personagens'} • Atualização dinâmica
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshRanking}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <svg 
                    className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
                
                {process.env.NODE_ENV === 'development' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testRankingSystem}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <svg 
                      className="h-4 w-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="hidden sm:inline">Testar</span>
                  </Button>
                )}
              </div>
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