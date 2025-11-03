-- =============================================
-- MIGRATION: Corrigir tipos VARCHAR para TEXT em consumables
-- Version: 1.0
-- Description: Altera name e type de VARCHAR para TEXT para compatibilidade com funções
-- Dependencies: 00021
-- =============================================

-- ✅ SOLUÇÃO DEFINITIVA: Alterar schema da tabela para TEXT
ALTER TABLE consumables 
    ALTER COLUMN name TYPE TEXT,
    ALTER COLUMN type TYPE TEXT;

-- ✅ Recriar função get_character_potion_slots (agora sem necessidade de cast)
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID) CASCADE;

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
        ps.slot_position,
        ps.consumable_id,
        c.name,              -- Agora é TEXT nativo
        c.description,       -- Sempre foi TEXT
        c.effect_value,
        c.type,              -- Agora é TEXT nativo
        COALESCE(cc.quantity, 0),
        c.price
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

