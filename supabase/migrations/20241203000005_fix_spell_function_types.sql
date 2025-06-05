-- Migração para corrigir tipos de retorno das funções de spell
-- Corrige incompatibilidade entre VARCHAR(50) da tabela e TEXT da função

-- PRIMEIRO: Remover as funções existentes para poder recriar com tipos corretos
DROP FUNCTION IF EXISTS get_character_available_spells(UUID);
DROP FUNCTION IF EXISTS get_available_spells(INTEGER);

-- SEGUNDO: Recriar função get_character_available_spells com tipos corretos
CREATE OR REPLACE FUNCTION get_character_available_spells(p_character_id UUID)
RETURNS TABLE (
    spell_id UUID,
    name VARCHAR(50),  -- Corrigido: era TEXT, agora VARCHAR(50) como na tabela
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

-- TERCEIRO: Recriar função get_available_spells com tipos corretos
CREATE OR REPLACE FUNCTION get_available_spells(p_level INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR(50),  -- Corrigido: era VARCHAR sem tamanho, agora VARCHAR(50)
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER
) AS $$
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
        s.duration
    FROM spells s
    WHERE s.unlocked_at_level <= p_level
    ORDER BY s.unlocked_at_level ASC;
END;
$$ LANGUAGE plpgsql; 