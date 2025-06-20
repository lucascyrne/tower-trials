import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Skull,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  Zap,
  Sword,
  Shield,
  Star,
  Target,
  Calendar,
  AlertTriangle,
  Trophy,
  Timer,
  Coins,
} from 'lucide-react';
import { type DeadCharacter, type CemeteryStats } from '@/models/cemetery.model';
import { CemeteryService } from '@/services/cemetery.service';
import { useAuth } from '@/resources/auth/auth-hook';
import { formatLargeNumber } from '@/utils/number-utils';
import { toast } from 'sonner';

interface CemeteryProps {
  className?: string;
  showHeader?: boolean;
  collapsible?: boolean;
}

export function Cemetery({
  className = '',
  showHeader = true,
  collapsible = false,
}: CemeteryProps) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<DeadCharacter[]>([]);
  const [stats, setStats] = useState<CemeteryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<DeadCharacter | null>(null);

  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    if (user?.id) {
      loadCemetery();
    }
  }, [user?.id, page]);

  const loadCemetery = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const response = await CemeteryService.getUserCemetery(user.id, {
        page,
        limit: ITEMS_PER_PAGE,
      });

      if (response.success && response.data) {
        setCharacters(response.data.characters);
        setStats(response.data.stats);
        setTotal(response.data.total);
        setHasMore(response.data.hasMore);
      } else {
        toast.error('Erro ao carregar cemitério', {
          description: response.error || 'Erro desconhecido',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cemitério:', error);
      toast.error('Erro ao carregar cemitério');
    } finally {
      setLoading(false);
    }
  };

  const formatSurvivalTime = (minutes: number): string => {
    return CemeteryService.formatSurvivalTime(minutes);
  };

  const formatDeathCause = (cause: string, killedBy?: string): string => {
    return CemeteryService.formatDeathCause(cause, killedBy);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && characters.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-500" />
              Cemitério
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total_deaths === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-500" />
              Cemitério
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <div className="text-6xl opacity-50">⚰️</div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-muted-foreground">Cemitério Vazio</h3>
              <p className="text-sm text-muted-foreground">
                Nenhum personagem foi perdido ainda. Que a sorte continue com você!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-500" />
              Cemitério
              <Badge variant="destructive" className="ml-2">
                {stats.total_deaths} mort{stats.total_deaths === 1 ? 'e' : 'es'}
              </Badge>
            </CardTitle>
            {collapsible && (
              <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <Eye className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      {(!collapsible || !isCollapsed) && (
        <CardContent className="space-y-6">
          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
              <Trophy className="h-6 w-6 mx-auto mb-2 text-red-400" />
              <div className="text-sm text-muted-foreground">Maior Nível</div>
              <div className="text-xl font-bold text-red-400">{stats.highest_level_reached}</div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-orange-400" />
              <div className="text-sm text-muted-foreground">Maior Andar</div>
              <div className="text-xl font-bold text-orange-400">{stats.highest_floor_reached}</div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
              <Timer className="h-6 w-6 mx-auto mb-2 text-blue-400" />
              <div className="text-sm text-muted-foreground">Tempo Total</div>
              <div className="text-xl font-bold text-blue-400">
                {stats.total_survival_time_hours}h
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-purple-400" />
              <div className="text-sm text-muted-foreground">Maior Ameaça</div>
              <div
                className="text-xs font-bold text-purple-400 truncate"
                title={stats.deadliest_monster}
              >
                {stats.deadliest_monster}
              </div>
            </div>
          </div>

          {/* Lista de Personagens Mortos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Personagens Perdidos</h3>
              <div className="text-sm text-muted-foreground">
                {characters.length} de {total}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-muted/20 rounded-lg p-4 animate-pulse">
                    <div className="h-6 bg-muted/40 rounded w-24 mb-3"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted/30 rounded w-full"></div>
                      <div className="h-4 bg-muted/30 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map(character => (
                  <Card
                    key={character.id}
                    className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 bg-red-500/5 border-red-500/20"
                    onClick={() => setSelectedCharacter(character)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Nome e Nível */}
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-lg truncate">{character.name}</h4>
                          <Badge variant="outline" className="bg-background/50">
                            Nv {character.level}
                          </Badge>
                        </div>

                        {/* Stats Principais */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <Sword className="h-3 w-3 mx-auto mb-1 text-red-400" />
                            <div className="text-red-400 font-medium">{character.atk}</div>
                          </div>
                          <div className="text-center">
                            <Shield className="h-3 w-3 mx-auto mb-1 text-blue-400" />
                            <div className="text-blue-400 font-medium">{character.def}</div>
                          </div>
                          <div className="text-center">
                            <Zap className="h-3 w-3 mx-auto mb-1 text-yellow-400" />
                            <div className="text-yellow-400 font-medium">{character.speed}</div>
                          </div>
                        </div>

                        {/* Dados da Jornada */}
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Andar alcançado:</span>
                            <span className="font-medium text-orange-400">
                              {character.floor_reached}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tempo de vida:</span>
                            <span className="font-medium text-blue-400">
                              {formatSurvivalTime(character.survival_time_minutes)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Gold acumulado:</span>
                            <span className="font-medium text-yellow-400">
                              {formatLargeNumber(character.gold)}
                            </span>
                          </div>
                        </div>

                        {/* Causa da Morte */}
                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                          <div className="text-xs text-red-400 font-medium">
                            {formatDeathCause(character.death_cause, character.killed_by_monster)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(character.died_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Paginação */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Página {page} de {Math.ceil(total / ITEMS_PER_PAGE)}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore || loading}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      )}

      {/* Modal de Detalhes do Personagem */}
      {selectedCharacter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Skull className="h-5 w-5 text-red-500" />
                {selectedCharacter.name}
                <Badge variant="outline" className="ml-2">
                  Nível {selectedCharacter.level}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Detalhados */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-center">
                  <Sword className="h-5 w-5 mx-auto mb-2 text-red-400" />
                  <div className="text-sm text-muted-foreground">Ataque</div>
                  <div className="text-xl font-bold text-red-400">{selectedCharacter.atk}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-center">
                  <Shield className="h-5 w-5 mx-auto mb-2 text-blue-400" />
                  <div className="text-sm text-muted-foreground">Defesa</div>
                  <div className="text-xl font-bold text-blue-400">{selectedCharacter.def}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-center">
                  <Zap className="h-5 w-5 mx-auto mb-2 text-yellow-400" />
                  <div className="text-sm text-muted-foreground">Velocidade</div>
                  <div className="text-xl font-bold text-yellow-400">{selectedCharacter.speed}</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3 text-center">
                  <Star className="h-5 w-5 mx-auto mb-2 text-green-400" />
                  <div className="text-sm text-muted-foreground">HP Máximo</div>
                  <div className="text-xl font-bold text-green-400">{selectedCharacter.max_hp}</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3 text-center">
                  <Star className="h-5 w-5 mx-auto mb-2 text-purple-400" />
                  <div className="text-sm text-muted-foreground">Mana Máxima</div>
                  <div className="text-xl font-bold text-purple-400">
                    {selectedCharacter.max_mana}
                  </div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3 text-center">
                  <Target className="h-5 w-5 mx-auto mb-2 text-orange-400" />
                  <div className="text-sm text-muted-foreground">Andar Alcançado</div>
                  <div className="text-xl font-bold text-orange-400">
                    {selectedCharacter.floor_reached}
                  </div>
                </div>
              </div>

              {/* Atributos Primários */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Atributos Primários</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Força</div>
                    <div className="text-lg font-bold">{selectedCharacter.strength}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Destreza</div>
                    <div className="text-lg font-bold">{selectedCharacter.dexterity}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Inteligência</div>
                    <div className="text-lg font-bold">{selectedCharacter.intelligence}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Sabedoria</div>
                    <div className="text-lg font-bold">{selectedCharacter.wisdom}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Vitalidade</div>
                    <div className="text-lg font-bold">{selectedCharacter.vitality}</div>
                  </div>
                  <div className="bg-background/50 rounded p-2 text-center">
                    <div className="text-sm text-muted-foreground">Sorte</div>
                    <div className="text-lg font-bold">{selectedCharacter.luck}</div>
                  </div>
                </div>
              </div>

              {/* Informações da Jornada */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Resumo da Jornada</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-400" />
                      Tempo de sobrevivência
                    </span>
                    <span className="font-medium text-blue-400">
                      {formatSurvivalTime(selectedCharacter.survival_time_minutes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded">
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400" />
                      XP acumulado
                    </span>
                    <span className="font-medium text-yellow-400">
                      {formatLargeNumber(selectedCharacter.xp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded">
                    <span className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-yellow-400" />
                      Gold acumulado
                    </span>
                    <span className="font-medium text-yellow-400">
                      {formatLargeNumber(selectedCharacter.gold)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Causa da Morte */}
              <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                <h3 className="text-lg font-semibold mb-2 text-red-400">Fim da Jornada</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skull className="h-4 w-4 text-red-400" />
                    <span className="font-medium">
                      {formatDeathCause(
                        selectedCharacter.death_cause,
                        selectedCharacter.killed_by_monster
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(selectedCharacter.died_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setSelectedCharacter(null)}>Fechar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
