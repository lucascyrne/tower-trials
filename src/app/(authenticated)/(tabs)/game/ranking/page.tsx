'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, ArrowLeft } from 'lucide-react';
import { RankingService, RankingEntry } from '@/resources/game/ranking-service';
import { useAuth } from '@/resources/auth/auth-hook';

export default function RankingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [userRanking, setUserRanking] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'personal'>('global');

  useEffect(() => {
    // Buscar dados do ranking
    const fetchRanking = async () => {
      try {
        setIsLoading(true);
        
        // Buscar ranking global
        const { data: globalData, error: globalError } = await RankingService.getGlobalRanking(10);
        
        if (globalError) {
          console.error('Erro ao buscar ranking global:', globalError);
        } else {
          setRankingData(globalData);
        }
        
        // Buscar ranking pessoal se o usuário estiver logado
        if (user?.id) {
          const { data: userData, error: userError } = await RankingService.getUserRanking(user.id, 5);
          
          if (userError) {
            console.error('Erro ao buscar ranking do usuário:', userError);
          } else {
            setUserRanking(userData);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar ranking:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRanking();
  }, [user]);

  const getMedalColor = (position: number): string => {
    switch (position) {
      case 0: return 'text-yellow-500'; // Ouro
      case 1: return 'text-gray-400';   // Prata
      case 2: return 'text-amber-700';  // Bronze
      default: return 'text-gray-300';  // Outros
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-2xl">
        {/* Header padronizado */}
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
            
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Ranking</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Melhores desempenhos na torre
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            {/* Tabs para alternar entre ranking global e pessoal */}
            {user && (
              <div className="flex border-b">
                <button
                  className={`pb-2 px-4 text-sm font-medium ${activeTab === 'global' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('global')}
                >
                  Ranking Global
                </button>
                <button
                  className={`pb-2 px-4 text-sm font-medium ${activeTab === 'personal' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
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
              <>
                {/* Estatísticas do Jogador (se autenticado) */}
                {user && activeTab === 'personal' && userRanking.length > 0 && (
                  <div className="mb-6 bg-muted p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Suas Estatísticas</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Melhor Andar:</span>
                        <p className="font-medium">{Math.max(...userRanking.map(r => r.highest_floor))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total de Tentativas:</span>
                        <p className="font-medium">{userRanking.length}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Última Tentativa:</span>
                        <p className="font-medium">
                          {userRanking[0]?.created_at 
                            ? new Date(userRanking[0].created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Pos.</TableHead>
                      <TableHead>Jogador</TableHead>
                      <TableHead className="text-right">Andar</TableHead>
                      <TableHead className="text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeTab === 'global' ? rankingData : userRanking).map((entry, index) => (
                      <TableRow key={entry.id} className={entry.user_id === user?.id ? 'bg-primary/5' : ''}>
                        <TableCell className="text-center font-medium">
                          {index < 3 ? (
                            <Trophy className={`inline h-4 w-4 ${getMedalColor(index)}`} />
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.player_name}</span>
                            {entry.user_id === user?.id && (
                              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                Você
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.highest_floor}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {entry.created_at 
                            ? new Date(entry.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Mensagem se não houver dados */}
                    {(activeTab === 'global' ? rankingData.length === 0 : userRanking.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          {activeTab === 'global' 
                            ? 'Nenhum registro encontrado no ranking global.'
                            : 'Você ainda não tem pontuações registradas.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
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
  );
} 