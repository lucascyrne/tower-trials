import { Equipment, CharacterEquipment, EquipmentSlots } from './models/equipment.model';
import { supabase } from '@/lib/supabase';

export class EquipmentService {
    /**
     * Obter todos os equipamentos disponíveis para um nível
     */
    static async getAvailableEquipment(level: number): Promise<Equipment[]> {
        const { data, error } = await supabase
            .from('equipment')
            .select('*')
            .lte('level_requirement', level)
            .order('level_requirement', { ascending: true });

        if (error) throw error;
        return data;
    }

    /**
     * Obter equipamentos de um personagem
     */
    static async getCharacterEquipment(characterId: string): Promise<CharacterEquipment[]> {
        const { data, error } = await supabase
            .from('character_equipment')
            .select(`
                *,
                equipment:equipment_id (*)
            `)
            .eq('character_id', characterId);

        if (error) throw error;
        return data;
    }

    /**
     * Obter slots de equipamento equipados do personagem
     */
    static async getEquippedSlots(characterId: string): Promise<EquipmentSlots> {
        const { data, error } = await supabase
            .from('character_equipment')
            .select(`
                *,
                equipment:equipment_id (*)
            `)
            .eq('character_id', characterId)
            .eq('is_equipped', true);

        if (error) throw error;

        const slots: EquipmentSlots = {
            weapon: null,
            armor: null,
            accessory: null
        };

        data.forEach(item => {
            if (item.equipment) {
                slots[item.equipment.type as keyof EquipmentSlots] = item.equipment;
            }
        });

        return slots;
    }

    /**
     * Comprar um equipamento para um personagem
     */
    static async buyEquipment(
        characterId: string,
        equipmentId: string,
        price: number
    ): Promise<boolean> {
        const { error } = await supabase.rpc('buy_equipment', {
            p_character_id: characterId,
            p_equipment_id: equipmentId,
            p_price: price
        });

        return !error;
    }

    /**
     * Equipar/desequipar um item
     */
    static async toggleEquipment(
        characterId: string,
        equipmentId: string,
        equip: boolean
    ): Promise<boolean> {
        const { error } = await supabase.rpc('toggle_equipment', {
            p_character_id: characterId,
            p_equipment_id: equipmentId,
            p_equip: equip
        });

        return !error;
    }

    /**
     * Vender um equipamento
     */
    static async sellEquipment(
        characterId: string,
        equipmentId: string
    ): Promise<boolean> {
        // Primeiro desequipar se estiver equipado
        await this.toggleEquipment(characterId, equipmentId, false);

        // Então remover o item e dar o gold ao personagem
        const { error } = await supabase.rpc('sell_equipment', {
            p_character_id: characterId,
            p_equipment_id: equipmentId
        });

        return !error;
    }
} 