-- Migração para corrigir as funções de slots removendo referências à coluna icon

-- Primeiro, remover as funções existentes para poder recriar com nova assinatura
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);
DROP FUNCTION IF EXISTS get_character_spell_slots(UUID);

-- Corrigir função para obter slots de poção do personagem
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name VARCHAR,
    consumable_description TEXT,
    effect_value INTEGER
) AS $$
BEGIN
    -- Retornar os 3 slots sempre, mesmo que vazios
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER as slot_position,
        cps.consumable_id,
        c.name as consumable_name,
        c.description as consumable_description,
        c.effect_value
    FROM slot_positions sp
    LEFT JOIN character_potion_slots cps ON cps.slot_position = sp.position 
        AND cps.character_id = p_character_id
    LEFT JOIN consumables c ON cps.consumable_id = c.id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql;

-- Corrigir função para obter slots de spell do personagem
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name VARCHAR,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type VARCHAR
) AS $$
BEGIN
    -- Retornar os 3 slots sempre, mesmo que vazios
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER as slot_position,
        css.spell_id,
        s.name as spell_name,
        s.description as spell_description,
        s.mana_cost,
        s.damage,
        s.type as spell_type
    FROM slot_positions sp
    LEFT JOIN character_spell_slots css ON css.slot_position = sp.position 
        AND css.character_id = p_character_id
    LEFT JOIN spells s ON css.spell_id = s.id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql; 