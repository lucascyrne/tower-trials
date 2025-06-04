-- Atualizar sistema de slots de magias para suportar melhor gerenciamento

-- Função para obter todas as magias disponíveis para um personagem
CREATE OR REPLACE FUNCTION get_character_available_spells(p_character_id UUID)
RETURNS TABLE (
    spell_id UUID,
    name TEXT,
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER,
    unlocked_at_level INTEGER,
    is_equipped BOOLEAN,
    slot_position INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration,
        s.unlocked_at_level,
        (css.spell_id IS NOT NULL) as is_equipped,
        css.slot_position
    FROM spells s
    LEFT JOIN character_spell_slots css ON css.spell_id = s.id AND css.character_id = p_character_id
    LEFT JOIN characters c ON c.id = p_character_id
    WHERE s.unlocked_at_level <= c.level
    ORDER BY s.unlocked_at_level ASC, s.name ASC;
END;
$$;

-- Função para equipar múltiplas magias de uma vez
CREATE OR REPLACE FUNCTION set_character_spells(
    p_character_id UUID,
    p_spell_1_id UUID DEFAULT NULL,
    p_spell_2_id UUID DEFAULT NULL,
    p_spell_3_id UUID DEFAULT NULL
) RETURNS VOID 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Limpar todos os slots atuais
    DELETE FROM character_spell_slots 
    WHERE character_id = p_character_id;
    
    -- Equipar spell 1 se fornecido
    IF p_spell_1_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 1, p_spell_1_id);
    END IF;
    
    -- Equipar spell 2 se fornecido
    IF p_spell_2_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 2, p_spell_2_id);
    END IF;
    
    -- Equipar spell 3 se fornecido
    IF p_spell_3_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 3, p_spell_3_id);
    END IF;
END;
$$;

-- Função para obter estatísticas de magias do personagem
CREATE OR REPLACE FUNCTION get_character_spell_stats(p_character_id UUID)
RETURNS TABLE (
    total_available INTEGER,
    total_equipped INTEGER,
    highest_level_unlocked INTEGER,
    spells_by_type JSON
) 
LANGUAGE plpgsql
AS $$
DECLARE
    character_level INTEGER;
BEGIN
    -- Obter nível do personagem
    SELECT level INTO character_level 
    FROM characters 
    WHERE id = p_character_id;
    
    RETURN QUERY
    SELECT 
        COUNT(s.id)::INTEGER as total_available,
        (SELECT COUNT(*)::INTEGER FROM character_spell_slots WHERE character_id = p_character_id) as total_equipped,
        character_level as highest_level_unlocked,
        (
            SELECT json_object_agg(
                effect_type,
                count
            )
            FROM (
                SELECT 
                    s.effect_type,
                    COUNT(*)::INTEGER as count
                FROM spells s
                WHERE s.unlocked_at_level <= character_level
                GROUP BY s.effect_type
            ) type_counts
        ) as spells_by_type
    FROM spells s
    WHERE s.unlocked_at_level <= character_level;
END;
$$; 