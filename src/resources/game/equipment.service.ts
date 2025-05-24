import { Equipment, CharacterEquipment, EquipmentSlots } from './models/equipment.model';
import { supabase } from '@/lib/supabase';

interface EquippedSlotRow {
    slot_type: string;
    equipment_id: string;
    equipment_name: string;
    equipment_type: string;
    weapon_subtype: string | null;
    atk_bonus: number;
    def_bonus: number;
    mana_bonus: number;
    speed_bonus: number;
    hp_bonus: number;
    rarity: string;
}

interface CanEquipResponse {
    can_equip: boolean;
    reason: string;
}

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
            main_hand: null,
            off_hand: null,
            armor: null,
            accessory: null
        };

        try {
            if (!characterId) {
                console.warn('ID do personagem não fornecido');
                return defaultSlots;
            }

            const { data, error } = await supabase
                .rpc('get_equipped_slots', {
                    p_character_id: characterId
                });

            if (error) throw error;

            const slots: EquipmentSlots = { ...defaultSlots };

            (data || []).forEach((row: EquippedSlotRow) => {
                if (row && row.slot_type) {
                    const equipment = {
                        id: row.equipment_id,
                        name: row.equipment_name,
                        type: row.equipment_type,
                        weapon_subtype: row.weapon_subtype,
                        atk_bonus: row.atk_bonus,
                        def_bonus: row.def_bonus,
                        mana_bonus: row.mana_bonus,
                        speed_bonus: row.speed_bonus,
                        hp_bonus: row.hp_bonus,
                        rarity: row.rarity
                    };

                    const slotType = row.slot_type as keyof EquipmentSlots;
                    if (slotType in slots) {
                        slots[slotType] = equipment as unknown as Equipment;
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
     * Verificar se um personagem pode equipar um item
     */
    static async canEquipItem(characterId: string, equipmentId: string): Promise<{ canEquip: boolean; reason: string }> {
        try {
            const { data, error } = await supabase
                .rpc('can_equip_item', {
                    p_character_id: characterId,
                    p_equipment_id: equipmentId
                })
                .single();

            if (error) throw error;

            const response = data as CanEquipResponse;
            return {
                canEquip: response.can_equip,
                reason: response.reason
            };
        } catch (error) {
            console.error('Erro ao verificar se pode equipar item:', error);
            return {
                canEquip: false,
                reason: 'Erro ao verificar requisitos'
            };
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
     * Equipar/desequipar um item com suporte a dual-wielding
     */
    static async toggleEquipment(
        characterId: string,
        equipmentId: string,
        equip: boolean,
        slotType?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (!characterId || !equipmentId) {
                console.error('Parâmetros inválidos para equipar/desequipar');
                return { success: false, error: 'Parâmetros inválidos' };
            }

            // Se for para equipar, verificar primeiro se pode equipar
            if (equip) {
                const canEquip = await this.canEquipItem(characterId, equipmentId);
                if (!canEquip.canEquip) {
                    return { success: false, error: canEquip.reason };
                }
            }

            const { error } = await supabase.rpc('toggle_equipment', {
                p_character_id: characterId,
                p_equipment_id: equipmentId,
                p_equip: equip,
                p_slot_type: slotType || null
            });

            if (error) {
                console.error('Erro ao equipar/desequipar:', error.message);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Erro ao equipar/desequipar:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            };
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