-- =============================================
-- MIGRATION: Correção de Ambiguidade em Spell Slots
-- Version: 1.0
-- Description: Corrige referências ambíguas em get_character_spell_slots e set_spell_slot
-- Dependencies: 00009
-- =============================================

-- CORRIGIR: Função get_character_spell_slots com qualificações apropriadas
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER, spell_id UUID, spell_name TEXT, spell_description TEXT,
    effect_type spell_effect_type, mana_cost INTEGER, cooldown INTEGER, effect_value INTEGER
) AS $$
BEGIN
    -- ✅ Qualificado com alias ss
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (SELECT 1 FROM spell_slots ss WHERE ss.character_id = p_character_id)
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    RETURN QUERY
    SELECT ss.slot_position, ss.spell_id, s.name, s.description, s.effect_type, s.mana_cost, s.cooldown, s.effect_value
    FROM spell_slots ss
    LEFT JOIN spells s ON ss.spell_id = s.id
    WHERE ss.character_id = p_character_id
    ORDER BY ss.slot_position;
END;
$$ LANGUAGE plpgsql;

-- CORRIGIR: Função set_spell_slot com melhor tratamento de retorno
-- ⚠️ DROP para permitir mudança de tipo de retorno (era VOID, agora TABLE)
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID) CASCADE;

CREATE FUNCTION set_spell_slot(p_character_id UUID, p_slot_position INTEGER, p_spell_id UUID)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT) AS $$
BEGIN
    IF p_slot_position < 1 OR p_slot_position > 3 THEN 
        RETURN QUERY SELECT FALSE, 'Posição de slot inválida. Deve ser entre 1 e 3.'::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, p_slot_position, p_spell_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET spell_id = EXCLUDED.spell_id, updated_at = NOW();

    RETURN QUERY SELECT TRUE, NULL::TEXT, 'Spell slot configurado com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;
