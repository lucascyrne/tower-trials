-- =============================================
-- MIGRATION: Correção Definitiva de get_character_potion_slots
-- Version: 1.0
-- Description: Função STABLE simples com CAST EXPLÍCITO em TODAS as colunas
-- Dependencies: 00020
-- =============================================

-- ✅ DROP completo para remover TODAS as versões anteriores
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID) CASCADE;

-- ✅ FUNÇÃO FINAL: Simples, STABLE, com cast ::TEXT explícito
CREATE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name TEXT,
    consumable_description TEXT,
    effect_value INTEGER,
    consumable_type TEXT,
    available_quantity INTEGER,
    consumable_price INTEGER
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.slot_position::INTEGER,
        ps.consumable_id::UUID,
        c.name::TEXT,
        c.description::TEXT,
        c.effect_value::INTEGER,
        c.type::TEXT,
        COALESCE(cc.quantity, 0)::INTEGER,
        c.price::INTEGER
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (
        cc.character_id = p_character_id 
        AND cc.consumable_id = ps.consumable_id
    )
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position ASC;
END;
$$;
