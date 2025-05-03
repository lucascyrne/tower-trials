import { createBrowserClient } from '@supabase/ssr';
import { Equipment, CharacterEquipment, EquipmentSlots } from './models/equipment.model';

export class EquipmentService {
    private static supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    /**
     * Obter todos os equipamentos disponíveis para um nível
     */
    static async getAvailableEquipment(level: number): Promise<Equipment[]> {
        const { data, error } = await this.supabase
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
        const { data, error } = await this.supabase
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
        const { data, error } = await this.supabase
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
        const { error } = await this.supabase.rpc('buy_equipment', {
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
        const { error } = await this.supabase.rpc('toggle_equipment', {
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
        const { error } = await this.supabase.rpc('sell_equipment', {
            p_character_id: characterId,
            p_equipment_id: equipmentId
        });

        return !error;
    }
} 