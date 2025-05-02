'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
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
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Ranking de Jogadores
          </CardTitle>
          
          {/* Tabs para alternar entre ranking global e pessoal */}
          {user && (
            <div className="flex border-b mt-4">
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
                  <TableRow key={entry.id}>
                    <TableCell className="text-center font-medium">
                      <Trophy className={`inline h-4 w-4 ${getMedalColor(index)}`} />
                      <span className="ml-1">{index + 1}</span>
                    </TableCell>
                    <TableCell>{entry.player_name}</TableCell>
                    <TableCell className="text-right">{entry.highest_floor}</TableCell>
                    <TableCell className="text-right">
                      {entry.created_at ? new Date(entry.created_at).toLocaleDateString('pt-BR') : '-'}
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
  );
} 