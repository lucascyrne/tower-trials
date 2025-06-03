// Modelo para personagem morto no cemitério
export interface DeadCharacter {
  id: string;
  user_id: string;
  original_character_id: string;
  
  // Dados básicos na morte
  name: string;
  level: number;
  xp: number;
  gold: number;
  
  // Atributos primários na morte
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
  
  // Stats derivados na morte
  max_hp: number;
  max_mana: number;
  atk: number;
  def: number;
  speed: number;
  
  // Dados da jornada
  floor_reached: number;
  highest_floor: number;
  total_monsters_killed: number;
  total_damage_dealt: number;
  total_damage_taken: number;
  total_spells_cast: number;
  total_potions_used: number;
  
  // Causa da morte
  death_cause: string;
  killed_by_monster?: string;
  
  // Timestamps
  character_created_at: string;
  died_at: string;
  survival_time_minutes: number;
  created_at: string;
  updated_at: string;
}

// Estatísticas do cemitério
export interface CemeteryStats {
  total_deaths: number;
  highest_level_reached: number;
  highest_floor_reached: number;
  total_survival_time_hours: number;
  most_common_death_cause: string;
  deadliest_monster: string;
}

// Response para busca do cemitério
export interface CemeteryResponse {
  characters: DeadCharacter[];
  total: number;
  stats: CemeteryStats;
  hasMore: boolean;
}

// Parâmetros para busca do cemitério
export interface CemeterySearchParams {
  page?: number;
  limit?: number;
  sortBy?: 'died_at' | 'level' | 'floor_reached' | 'survival_time_minutes';
  sortOrder?: 'asc' | 'desc';
} 