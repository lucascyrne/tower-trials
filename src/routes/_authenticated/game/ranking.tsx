import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RankingService, type RankingEntry, type RankingMode } from '@/services/ranking.service';
import { useAuth } from '@/resources/auth/auth-hook';
import RankingFilters, { type CharacterStatusFilter } from '@/components/ranking/ranking-filters';
import RankingTable from '@/components/ranking/ranking-table';
import UserStats from '@/components/ranking/user-stats';

const ITEMS_PER_PAGE = 20;

export const Route = createFileRoute('/_authenticated/game/ranking')({
  component: RankingPage,
});

function RankingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados para dados
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [userRanking, setUserRanking] = useState<RankingEntry[]>([]);
  const [userStats, setUserStats] = useState({
    bestFloor: 0,
    bestLevel: 1,
    bestGold: 0,
    totalRuns: 0,
    aliveCharacters: 0,
  });

  // Estados para filtros e UI
  const [isLoading, setIsLoading] = useState(true);

  const [rankingMode, setRankingMode] = useState<RankingMode>('floor');
  const [statusFilter, setStatusFilter] = useState<CharacterStatusFilter>('all');
  const [nameFilter, setNameFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce para o filtro de nome
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameFilter(nameFilter);
    }, 500);

    return () => clearTimeout(timer);
  }, [nameFilter]);

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [rankingMode, statusFilter, debouncedNameFilter]);

  useEffect(() => {
    fetchRankingData();
  }, [user?.id, rankingMode, statusFilter, debouncedNameFilter, currentPage]);

  // Função para buscar total de entradas e calcular páginas
  const fetchTotalCount = useCallback(async () => {
    try {
      const countResponse = await RankingService.countRankingEntries(
        statusFilter,
        debouncedNameFilter
      );
      if (countResponse.data !== null) {
        const totalEntries = countResponse.data;
        const calculatedTotalPages = Math.max(1, Math.ceil(totalEntries / ITEMS_PER_PAGE));
        setTotalPages(calculatedTotalPages);

        console.log(
          `[RankingPage] Total de entradas: ${totalEntries}, páginas: ${calculatedTotalPages}`
        );
      }
    } catch (error) {
      console.error('Erro ao contar entradas:', error);
      setTotalPages(1);
    }
  }, [statusFilter, debouncedNameFilter]);

  // Função para forçar atualização do ranking
  const refreshRanking = async () => {
    console.log('[RankingPage] Forçando atualização do ranking...');
    await fetchRankingData();
  };

  const fetchRankingData = async () => {
    try {
      setIsLoading(true);

      console.log(
        `[RankingPage] Iniciando busca de dados - modo: ${rankingMode}, filtro: ${statusFilter}, nome: ${debouncedNameFilter}, página: ${currentPage}`
      );

      // Buscar contagem total primeiro
      await fetchTotalCount();

      // Buscar ranking global dinâmico
      const globalResponse = await RankingService.getGlobalRanking(
        rankingMode,
        ITEMS_PER_PAGE,
        statusFilter,
        debouncedNameFilter,
        currentPage
      );

      console.log(`[RankingPage] Resposta do ranking global:`, {
        success: !globalResponse.error,
        error: globalResponse.error,
        dataLength: globalResponse.data?.length || 0,
        data: globalResponse.data,
      });

      if (globalResponse.error) {
        console.error('Erro ao buscar ranking global:', globalResponse.error);
        setRankingData([]);
      } else {
        setRankingData(globalResponse.data || []);
        console.log(
          `[RankingPage] Ranking global carregado: ${globalResponse.data?.length || 0} entradas`
        );

        // Log detalhado dos dados recebidos
        if (globalResponse.data && globalResponse.data.length > 0) {
          console.log(
            `[RankingPage] Primeiros 5 personagens do ranking:`,
            globalResponse.data.slice(0, 5).map(entry => ({
              name: entry.player_name,
              highest_floor: entry.highest_floor, // CORRIGIDO: usar highest_floor
              level: entry.character_level,
              alive: entry.character_alive,
              user_id: entry.user_id,
            }))
          );
        }
      }

      // Buscar dados do usuário se estiver logado
      if (user?.id) {
        const [userRankingResponse, userStatsResponse] = await Promise.all([
          RankingService.getUserRanking(user.id, 15),
          RankingService.getUserStats(user.id),
        ]);

        if (userRankingResponse.error) {
          console.error('Erro ao buscar ranking do usuário:', userRankingResponse.error);
          setUserRanking([]);
        } else {
          setUserRanking(userRankingResponse.data || []);
          console.log(
            `[RankingPage] Ranking do usuário carregado: ${userRankingResponse.data?.length || 0} entradas`
          );
        }

        if (userStatsResponse.error) {
          console.error('Erro ao buscar estatísticas do usuário:', userStatsResponse.error);
          setUserStats({
            bestFloor: 0,
            bestLevel: 1,
            bestGold: 0,
            totalRuns: 0,
            aliveCharacters: 0,
          });
        } else {
          setUserStats(
            userStatsResponse.data || {
              bestFloor: 0,
              bestLevel: 1,
              bestGold: 0,
              totalRuns: 0,
              aliveCharacters: 0,
            }
          );
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
        aliveCharacters: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getModeTitle = (mode: RankingMode): string => {
    switch (mode) {
      case 'floor':
        return 'Ranking por Andar Mais Alto';
      case 'level':
        return 'Ranking por Nível Mais Alto';
      case 'gold':
        return 'Ranking por Mais Ouro';
      default:
        return 'Ranking';
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getFilterDescription = (): string => {
    const parts = [];
    if (statusFilter !== 'all') {
      parts.push(statusFilter === 'alive' ? 'vivos' : 'mortos');
    }
    if (debouncedNameFilter) {
      parts.push(`nome: "${debouncedNameFilter}"`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/game' })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{getModeTitle(rankingMode)}</h1>
            <p className="text-muted-foreground">
              Veja os melhores jogadores{getFilterDescription()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshRanking} disabled={isLoading}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 md:mb-6">
        <CardHeader>
          <RankingFilters
            activeMode={rankingMode}
            onModeChange={setRankingMode}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            nameFilter={nameFilter}
            onNameFilterChange={setNameFilter}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        </CardHeader>
      </Card>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Estatísticas do Usuário */}
        {user && (
          <div className="lg:col-span-1">
            <UserStats
              stats={userStats}
              userRanking={userRanking.map(entry => ({
                highest_floor: entry.highest_floor, // CORRIGIDO: usar highest_floor
                character_level: entry.character_level,
                character_gold: entry.character_gold,
                character_alive: entry.character_alive,
                created_at: entry.created_at,
              }))}
            />
          </div>
        )}

        {/* Tabela de Ranking */}
        <div className={user ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <Card>
            <CardContent className="p-0">
              <RankingTable entries={rankingData} mode={rankingMode} currentUserId={user?.id} />
            </CardContent>

            {/* Paginação */}
            {totalPages > 1 && (
              <CardFooter className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading}
                >
                  Anterior
                </Button>

                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isLoading}
                >
                  Próxima
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
