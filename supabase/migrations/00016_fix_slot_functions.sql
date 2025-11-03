-- =============================================
-- MIGRATION: Correção Completa de Funções de Slots de Poção
-- Version: 2.0
-- Description: Corrige referências ambíguas de slot_position em todas as funções
-- Dependencies: 00008, 00007
-- =============================================

-- CORRIGIR: Função get_character_potion_slots com qualificação completa
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name TEXT,
    consumable_description TEXT,
    effect_value INTEGER,
    consumable_type TEXT,
    available_quantity INTEGER,
    consumable_price INTEGER
) AS $$
BEGIN
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (SELECT 1 FROM potion_slots ps WHERE ps.character_id = p_character_id)
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    RETURN QUERY
    SELECT 
        ps.slot_position,
        ps.consumable_id,
        c.name,
        c.description,
        c.effect_value,
        c.type,
        COALESCE(cc.quantity, 0),
        c.price
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (cc.character_id = p_character_id AND cc.consumable_id = ps.consumable_id)
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position;
END;
$$ LANGUAGE plpgsql;

-- NOVO: Função consume_potion_from_slot com qualificações apropriadas
CREATE OR REPLACE FUNCTION consume_potion_from_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS TABLE(success BOOLEAN, new_hp INTEGER, new_mana INTEGER, message TEXT) AS $$
DECLARE
    v_consumable_id UUID;
    v_result RECORD;
BEGIN
    -- Validar posição do slot
    IF p_slot_position < 1 OR p_slot_position > 3 THEN 
        RETURN QUERY SELECT FALSE, 0, 0, 'Posição de slot inválida (1-3)'::TEXT; 
        RETURN; 
    END IF;

    -- Obter consumable_id do slot com qualificação apropriada
    SELECT ps.consumable_id INTO v_consumable_id 
    FROM potion_slots ps
    WHERE ps.character_id = p_character_id AND ps.slot_position = p_slot_position;
    
    IF v_consumable_id IS NULL THEN 
        RETURN QUERY SELECT FALSE, 0, 0, 'Slot vazio'::TEXT; 
        RETURN; 
    END IF;
    
    -- Usar a poção via função consume_potion
    SELECT * INTO v_result FROM consume_potion(p_character_id, v_consumable_id);
    
    -- Se não há mais consumível, limpar o slot
    IF NOT EXISTS (SELECT 1 FROM character_consumables cc WHERE cc.character_id = p_character_id AND cc.consumable_id = v_consumable_id AND cc.quantity > 0) THEN
        PERFORM clear_potion_slot(p_character_id, p_slot_position);
    END IF;
    
    RETURN QUERY SELECT v_result.success, v_result.new_hp, v_result.new_mana, v_result.message;
END;
$$ LANGUAGE plpgsql;

-- CORRIGIR: Função set_potion_slot com tratamento de retorno apropriado
-- ⚠️ DROP para permitir mudança de tipo de retorno
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID) CASCADE;

CREATE FUNCTION set_potion_slot(p_character_id UUID, p_slot_position INTEGER, p_consumable_id UUID)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT) AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN 
        RETURN QUERY SELECT FALSE, 'Posição de slot inválida. Deve ser entre 1 e 3.'::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    IF p_consumable_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM character_consumables cc WHERE cc.character_id = p_character_id AND cc.consumable_id = p_consumable_id AND cc.quantity > 0) THEN
            RETURN QUERY SELECT FALSE, 'Personagem não possui este consumível no inventário'::TEXT, NULL::TEXT;
            RETURN;
        END IF;
    END IF;
    
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET consumable_id = EXCLUDED.consumable_id, updated_at = NOW();

    RETURN QUERY SELECT TRUE, NULL::TEXT, 'Slot configurado com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- CORRIGIR: Função clear_potion_slot com tratamento de retorno apropriado
-- ⚠️ DROP para permitir mudança de tipo de retorno
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER) CASCADE;

CREATE FUNCTION clear_potion_slot(p_character_id UUID, p_slot_position INTEGER)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT) AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN 
        RETURN QUERY SELECT FALSE, 'Posição de slot inválida. Deve ser entre 1 e 3.'::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    UPDATE potion_slots ps
    SET consumable_id = NULL, updated_at = NOW()
    WHERE ps.character_id = p_character_id AND ps.slot_position = p_slot_position;

    RETURN QUERY SELECT TRUE, NULL::TEXT, 'Slot limpo com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;
