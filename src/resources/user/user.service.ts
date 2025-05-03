import { createBrowserClient } from '@supabase/ssr';
import { CriteriosPesquisaUser, IUser, UpdateUserDTO } from './user-model';

class UserService {
  private supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async getUserProfile(): Promise<{ data: IUser | null; error: string | null }> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      
      if (authError) throw authError;
      if (!user) return { data: null, error: 'Usuário não autenticado' };

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .single();

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

  async searchUsers(criterios: CriteriosPesquisaUser): Promise<{ data: IUser[] | null; error: string | null }> {
    try {
      let query = this.supabase
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
      return { data: data as IUser[], error: null };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Erro ao buscar usuários' 
      };
    }
  }

  async updateUser(uid: string, updateData: UpdateUserDTO): Promise<{ error: string | null }> {
    try {
      // Se houver arquivo de imagem, fazer upload primeiro
      if (updateData.imagemPerfil) {
        const { error: uploadError } = await this.supabase.storage
          .from('profile-images')
          .upload(`${uid}/${updateData.imagemPerfil.name}`, updateData.imagemPerfil);

        if (uploadError) throw uploadError;

        // Gerar URL pública da imagem
        const { data: { publicUrl } } = this.supabase.storage
          .from('profile-images')
          .getPublicUrl(`${uid}/${updateData.imagemPerfil.name}`);

        // Atualizar URL da imagem no perfil
        const { error: updateError } = await this.supabase
          .from('users')
          .update({ imagem_perfil_url: publicUrl })
          .eq('uid', uid);

        if (updateError) throw updateError;
      }

      // Atualizar outros campos do perfil
      const { error } = await this.supabase
        .from('users')
        .update(updateData)
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