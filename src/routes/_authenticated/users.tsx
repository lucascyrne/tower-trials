import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useUser } from '@/resources/user/user-hook'
import { type CriteriosPesquisaUser, type UserRole } from '@/resources/user/user-model'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AdministratorOnlyFeature from '@/components/hocs/administrator-only-feature'
import { Badge } from '@/components/ui/badge'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PLAYER: 'Jogador',
}

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

function UsersPage() {
  const navigate = useNavigate()
  const { users, loading, searchUsers } = useUser()
  const [filtros, setFiltros] = useState<CriteriosPesquisaUser>({
    page: 1,
    limit: 10,
  })

  useEffect(() => {
    searchUsers(filtros)
  }, [filtros, searchUsers])

  const getBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-500'
      case 'PLAYER':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <AdministratorOnlyFeature>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Usuários</CardTitle>
              {/* <Button onClick={() => navigate({ to: '/users/new' })}>
                Novo Usuário
              </Button> */}
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input
                placeholder="Nome"
                value={filtros.nome || ''}
                onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={filtros.email || ''}
                onChange={(e) => setFiltros({ ...filtros, email: e.target.value })}
              />
              <Select
                value={filtros.role}
                onValueChange={(value) => setFiltros({ ...filtros, role: value as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="PLAYER">Jogador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela de Usuários */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Maior Andar</TableHead>
                    <TableHead>Total de Jogos</TableHead>
                    <TableHead>Vitórias</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.nome}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getBadgeColor(user.role)}>
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.highest_floor}</TableCell>
                        <TableCell>{user.total_games}</TableCell>
                        <TableCell>{user.total_victories}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            onClick={() => navigate({ to: `/users/${user.id}` })}
                          >
                            Visualizar
                          </Button>
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
  )
} 