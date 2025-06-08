import { supabase } from '@/lib/supabase';
import { type CriteriosPesquisaUser, type IUser, type UpdateUserDTO } from './user-model';

class UserService {
  async getUserProfile(): Promise<{ data: IUser | null; error: string | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      if (!user) return { data: null, error: 'Usuário não autenticado' };

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .maybeSingle();

      if (error) throw error;
      return { data: data as IUser, error: null };
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar perfil' 
      };
    }
  }

  async searchUsers(criterios: CriteriosPesquisaUser): Promise<{ data: IUser[] | null; count: number; error: string | null }> {
    try {
      // Primeiro, obter o total de registros para paginação
      let countQuery = supabase
        .from('users')
        .select('id', { count: 'exact' });

      if (criterios.nome) {
        countQuery = countQuery.ilike('nome', `%${criterios.nome}%`);
      }

      if (criterios.email) {
        countQuery = countQuery.ilike('email', `%${criterios.email}%`);
      }

      if (criterios.role) {
        countQuery = countQuery.eq('role', criterios.role);
      }

      if (criterios.ativo !== undefined) {
        countQuery = countQuery.eq('ativo', criterios.ativo);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;

      // Agora buscar os dados com paginação
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (criterios.nome) {
        query = query.ilike('nome', `%${criterios.nome}%`);
      }

      if (criterios.email) {
        query = query.ilike('email', `%${criterios.email}%`);
      }

      if (criterios.role) {
        query = query.eq('role', criterios.role);
      }

      if (criterios.ativo !== undefined) {
        query = query.eq('ativo', criterios.ativo);
      }

      const { data, error } = await query
        .range((criterios.page - 1) * criterios.limit, criterios.page * criterios.limit - 1);

      if (error) throw error;
      return { data: data as IUser[], count: count || 0, error: null };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return { 
        data: null,
        count: 0, 
        error: error instanceof Error ? error.message : 'Erro ao buscar usuários' 
      };
    }
  }

  async updateUser(uid: string, updateData: UpdateUserDTO): Promise<{ error: string | null }> {
    try {
      // Se houver arquivo de imagem, fazer upload primeiro
      let imagemPerfil_url = undefined;
      
      if (updateData.imagemPerfil) {
        const fileExt = updateData.imagemPerfil.name.split('.').pop();
        const fileName = `${uid}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, updateData.imagemPerfil, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Gerar URL pública da imagem
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName);

        imagemPerfil_url = publicUrl;
        
        // Remover o campo de arquivo antes de atualizar o perfil
        delete updateData.imagemPerfil;
      }

      // Atualizar perfil com os campos restantes e a URL da imagem, se houver
      const { error } = await supabase
        .from('users')
        .update({ 
          ...updateData,
          ...(imagemPerfil_url && { imagem_perfil_url: imagemPerfil_url }),
          updated_at: new Date().toISOString()
        })
        .eq('uid', uid);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return { 
        error: error instanceof Error ? error.message : 'Erro ao atualizar usuário' 
      };
    }
  }
}

export const userService = new UserService();
export default userService; 