-- =============================================
-- MIGRATION: Correção Final de Ambiguidade em get_character_potion_slots
-- Version: 1.0
-- Description: DROP completo e recria a função com qualificação explícita
-- Dependencies: 00016
-- =============================================

-- ⚠️ DROP COMPLETO da função com cascade
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID) CASCADE;

-- RECRIAÇÃO com qualificação EXPLÍCITA e SEM ambiguidade
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
    -- Garantir que slots existem
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM potion_slots ps_check 
        WHERE ps_check.character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Retornar slots com qualificação EXPLÍCITA em TODAS as colunas
    RETURN QUERY
    SELECT 
        ps.slot_position::INTEGER AS slot_position,
        ps.consumable_id::UUID AS consumable_id,
        c.name::TEXT AS consumable_name,
        c.description::TEXT AS consumable_description,
        c.effect_value::INTEGER AS effect_value,
        c.type::TEXT AS consumable_type,
        COALESCE(cc.quantity, 0)::INTEGER AS available_quantity,
        c.price::INTEGER AS consumable_price
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (
        cc.character_id = p_character_id 
        AND cc.consumable_id = ps.consumable_id
    )
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position ASC;
END;
$$ LANGUAGE plpgsql STABLE;

