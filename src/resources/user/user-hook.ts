import { useState, useCallback } from 'react';
import { type CriteriosPesquisaUser, type IUser } from './user-model';
import { userService } from './user.service';

export function useUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<IUser | null>(null);
  const [users, setUsers] = useState<IUser[]>([]);

  const getUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await userService.getUserProfile();

      if (error) throw new Error(error);
      if (data) setUser(data);

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar perfil';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchUsers = useCallback(async (criterios: CriteriosPesquisaUser) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await userService.searchUsers(criterios);

      if (error) throw new Error(error);
      if (data) setUsers(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar usuários';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    users,
    loading,
    error,
    getUserProfile,
    searchUsers,
  };
}
