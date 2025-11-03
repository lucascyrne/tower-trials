-- =============================================
-- MIGRATION: Correção de use_potion_from_slot
-- Version: 1.0
-- Description: Corrige referências ambíguas em use_potion_from_slot
-- Dependencies: 00008, 00007
-- =============================================

-- CORRIGIR: Função use_potion_from_slot com qualificações completas
CREATE OR REPLACE FUNCTION use_potion_from_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS TABLE(success BOOLEAN, new_hp INTEGER, new_mana INTEGER, message TEXT) AS $$
DECLARE
    v_consumable_id UUID;
    v_result RECORD;
BEGIN
    SELECT ps.consumable_id INTO v_consumable_id 
    FROM potion_slots ps
    WHERE ps.character_id = p_character_id AND ps.slot_position = p_slot_position;
    
    IF v_consumable_id IS NULL THEN 
        RETURN QUERY SELECT FALSE, 0, 0, 'Slot vazio'::TEXT; 
        RETURN; 
    END IF;
    
    SELECT * INTO v_result FROM consume_potion(p_character_id, v_consumable_id);
    
    IF NOT EXISTS (SELECT 1 FROM character_consumables cc WHERE cc.character_id = p_character_id AND cc.consumable_id = v_consumable_id AND cc.quantity > 0) THEN
        PERFORM clear_potion_slot(p_character_id, p_slot_position);
    END IF;
    
    RETURN QUERY SELECT v_result.success, v_result.new_hp, v_result.new_mana, v_result.message;
END;
$$ LANGUAGE plpgsql;
