import { type MonsterDrop } from '@/resources/game/models/consumable.model';

export interface CharacterDrop {
  id: string;
  drop_id: string;
  quantity: number;
  drop?: MonsterDrop;
}

export type EquipmentFilter = 'all' | 'weapon' | 'armor' | 'accessory';
export type WeaponSubtypeFilter = 'all' | 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger';
export type RarityFilter = 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
