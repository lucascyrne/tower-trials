import { Equipment, CharacterEquipment, EquipmentSlots } from './models/equipment.model';
import { supabase } from '@/lib/supabase';

export class EquipmentService {
    /**
     * Obter todos os equipamentos disponíveis para um nível
     */
    static async getAvailableEquipment(level: number): Promise<Equipment[]> {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .lte('level_requirement', level)
                .order('level_requirement', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar equipamentos disponíveis:', error);
            return [];
        }
    }

    /**
     * Obter equipamentos de um personagem
     */
    static async getCharacterEquipment(characterId: string): Promise<CharacterEquipment[]> {
        try {
            if (!characterId) {
                console.warn('ID do personagem não fornecido');
                return [];
            }

            const { data, error } = await supabase
                .from('character_equipment')
                .select(`
                    *,
                    equipment:equipment_id (*)
                `)
                .eq('character_id', characterId);

            if (error) throw error;
            
            // Filtrar itens que têm equipamento válido
            return (data || []).filter(item => item && item.equipment);
        } catch (error) {
            console.error('Erro ao buscar equipamentos do personagem:', error);
            return [];
        }
    }

    /**
     * Obter slots de equipamento equipados do personagem
     */
    static async getEquippedSlots(characterId: string): Promise<EquipmentSlots> {
        const defaultSlots: EquipmentSlots = {
            weapon: null,
            armor: null,
            accessory: null
        };

        try {
            if (!characterId) {
                console.warn('ID do personagem não fornecido');
                return defaultSlots;
            }

            const { data, error } = await supabase
                .from('character_equipment')
                .select(`
                    *,
                    equipment:equipment_id (*)
                `)
                .eq('character_id', characterId)
                .eq('is_equipped', true);

            if (error) throw error;

            const slots: EquipmentSlots = { ...defaultSlots };

            (data || []).forEach(item => {
                if (item && item.equipment && item.equipment.type) {
                    const slotType = item.equipment.type as keyof EquipmentSlots;
                    if (slotType in slots) {
                        slots[slotType] = item.equipment;
                    }
                }
            });

            return slots;
        } catch (error) {
            console.error('Erro ao buscar equipamentos equipados:', error);
            return defaultSlots;
        }
    }

    /**
     * Comprar um equipamento para um personagem
     */
    static async buyEquipment(
        characterId: string,
        equipmentId: string,
        price: number
    ): Promise<boolean> {
        try {
            if (!characterId || !equipmentId) {
                console.error('Parâmetros inválidos para comprar equipamento');
                return false;
            }

            const { error } = await supabase.rpc('buy_equipment', {
                p_character_id: characterId,
                p_equipment_id: equipmentId,
                p_price: price
            });

            if (error) {
                console.error('Erro ao comprar equipamento:', error.message);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao comprar equipamento:', error);
            return false;
        }
    }

    /**
     * Equipar/desequipar um item
     */
    static async toggleEquipment(
        characterId: string,
        equipmentId: string,
        equip: boolean
    ): Promise<boolean> {
        try {
            if (!characterId || !equipmentId) {
                console.error('Parâmetros inválidos para equipar/desequipar');
                return false;
            }

            const { error } = await supabase.rpc('toggle_equipment', {
                p_character_id: characterId,
                p_equipment_id: equipmentId,
                p_equip: equip
            });

            if (error) {
                console.error('Erro ao equipar/desequipar:', error.message);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao equipar/desequipar:', error);
            return false;
        }
    }

    /**
     * Vender um equipamento
     */
    static async sellEquipment(
        characterId: string,
        equipmentId: string
    ): Promise<boolean> {
        try {
            if (!characterId || !equipmentId) {
                console.error('Parâmetros inválidos para vender equipamento');
                return false;
            }

            // Primeiro desequipar se estiver equipado
            await this.toggleEquipment(characterId, equipmentId, false);

            // Então remover o item e dar o gold ao personagem
            const { error } = await supabase.rpc('sell_equipment', {
                p_character_id: characterId,
                p_equipment_id: equipmentId
            });

            if (error) {
                console.error('Erro ao vender equipamento:', error.message);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao vender equipamento:', error);
            return false;
        }
    }
} 