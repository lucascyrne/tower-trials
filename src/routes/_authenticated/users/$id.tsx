import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { type IUser } from '@/resources/user/user-model';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AdministratorOnlyFeature from '@/components/hocs/administrator-only-feature';
import { userService } from '@/resources/user/user.service';
import { RankingService, type RankingEntry } from '@/resources/game/ranking.service';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  PLAYER: 'Jogador',
};

export const Route = createFileRoute('/_authenticated/users/$id')({
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const [usuario, setUsuario] = useState<IUser | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        setCarregando(true);
        setErro(null);

        // Buscar dados do usuário
        const { data: userData, error: userError } = await userService.searchUsers({
          page: 1,
          limit: 1,
          email: id,
        });

        if (userError) {
          setErro(`Erro ao buscar usuário: ${userError}`);
          return;
        }

        if (!userData || userData.length === 0) {
          setErro('Usuário não encontrado');
          return;
        }

        const user = userData[0];
        setUsuario(user);

        // Buscar rankings do usuário
        const { data: rankingData } = await RankingService.getUserRanking(user.uid);
        setRankings(rankingData || []);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setErro('Erro ao carregar dados do usuário');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [id]);

  if (carregando) {
    return <div>Carregando...</div>;
  }

  if (erro) {
    return <div className="text-red-500">{erro}</div>;
  }

  if (!usuario) {
    return <div>Usuário não encontrado</div>;
  }

  return (
    <AdministratorOnlyFeature>
      <div className="container mx-auto py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detalhes do Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Nome</p>
                <p className="text-lg">{usuario.nome}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-lg">{usuario.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tipo</p>
                <Badge className={usuario.role === 'ADMIN' ? 'bg-red-500' : 'bg-blue-500'}>
                  {roleLabels[usuario.role]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant={usuario.ativo ? 'default' : 'destructive'}>
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Maior Andar Alcançado</p>
                <p className="text-lg">{usuario.highest_floor}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total de Jogos</p>
                <p className="text-lg">{usuario.total_games}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Vitórias</p>
                <p className="text-lg">{usuario.total_victories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Andar Alcançado</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center">
                        Nenhum ranking encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    rankings.map(ranking => (
                      <TableRow key={ranking.id}>
                        <TableCell>{ranking.floor}</TableCell>
                        <TableCell>
                          {ranking.created_at
                            ? new Date(ranking.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdministratorOnlyFeature>
  );
}
