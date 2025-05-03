export type UserRole = 'ADMIN' | 'PLAYER';

export interface IUser {
  id: number;
  uid: string;
  nome: string;
  email: string;
  role: UserRole;
  highest_floor: number;
  total_games: number;
  total_victories: number;
  telefone?: string;
  documento?: string;
  tipo_pessoa: 'PF' | 'PJ';
  data_nascimento?: string;
  imagem_perfil_url?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserDTO {
  nome?: string;
  telefone?: string;
  documento?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  data_nascimento?: Date;
  imagemPerfil?: File;
}

export interface CriteriosPesquisaUser {
  page: number;
  limit: number;
  nome?: string;
  email?: string;
  role?: UserRole;
  ativo?: boolean;
} 