-- Corrigir ambiguidade de colunas nas funções de slots
-- Migração: 20241220000012_fix_column_ambiguity.sql

-- Recriar função get_character_potion_slots com qualificação explícita de colunas
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);
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
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Garantir que o personagem tem slots (inicializar se necessário)
    INSERT INTO potion_slots (character_id, slot_position, consumable_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM potion_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Retornar dados dos slots com qualificação explícita de colunas
    RETURN QUERY
    SELECT 
        ps.slot_position::INTEGER,
        ps.consumable_id::UUID,
        c.name::TEXT as consumable_name,
        c.description::TEXT as consumable_description,
        c.effect_value::INTEGER,
        c.type::TEXT as consumable_type,
        COALESCE(cc.quantity, 0)::INTEGER as available_quantity,
        c.price::INTEGER as consumable_price
    FROM potion_slots ps
    LEFT JOIN consumables c ON ps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (
        cc.character_id = p_character_id 
        AND cc.consumable_id = ps.consumable_id
    )
    WHERE ps.character_id = p_character_id
    ORDER BY ps.slot_position;
END;
$$;

-- Recriar função get_character_spell_slots com qualificação explícita de colunas
DROP FUNCTION IF EXISTS get_character_spell_slots(UUID);
CREATE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name TEXT,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Garantir que o personagem tem spell slots (inicializar se necessário)
    INSERT INTO spell_slots (character_id, slot_position, spell_id)
    SELECT p_character_id, generate_series(1, 3), NULL
    WHERE NOT EXISTS (
        SELECT 1 FROM spell_slots WHERE character_id = p_character_id
    )
    ON CONFLICT (character_id, slot_position) DO NOTHING;

    -- Retornar dados dos spell slots com qualificação explícita de colunas
    RETURN QUERY
    SELECT 
        ss.slot_position::INTEGER,
        ss.spell_id::UUID,
        s.name::TEXT as spell_name,
        s.description::TEXT as spell_description,
        s.mana_cost::INTEGER,
        s.damage::INTEGER,
        s.type::TEXT as spell_type
    FROM spell_slots ss
    LEFT JOIN spells s ON ss.spell_id = s.id
    WHERE ss.character_id = p_character_id
    ORDER BY ss.slot_position;
END;
$$; 