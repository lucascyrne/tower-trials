-- Corrigir referências de tabelas e ambiguidade de colunas
-- Migração: 20241220000013_fix_slots_table_references.sql

-- Dropar funções conflitantes
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);
DROP FUNCTION IF EXISTS get_character_spell_slots(UUID);
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER);
DROP FUNCTION IF EXISTS set_spell_slot(UUID, INTEGER, UUID);

-- Recriar função get_character_potion_slots usando tabela correta
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
    -- Retornar dados dos slots com qualificação explícita de colunas
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER,
        cps.consumable_id::UUID,
        c.name::TEXT as consumable_name,
        c.description::TEXT as consumable_description,
        c.effect_value::INTEGER,
        c.type::TEXT as consumable_type,
        COALESCE(cc.quantity, 0)::INTEGER as available_quantity,
        c.price::INTEGER as consumable_price
    FROM slot_positions sp
    LEFT JOIN character_potion_slots cps ON cps.slot_position = sp.position 
        AND cps.character_id = p_character_id
    LEFT JOIN consumables c ON cps.consumable_id = c.id
    LEFT JOIN character_consumables cc ON (
        cc.character_id = p_character_id 
        AND cc.consumable_id = cps.consumable_id
    )
    ORDER BY sp.position;
END;
$$;

-- Recriar função get_character_spell_slots usando tabela correta
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
    -- Retornar dados dos spell slots com qualificação explícita de colunas
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER,
        css.spell_id::UUID,
        s.name::TEXT as spell_name,
        s.description::TEXT as spell_description,
        s.mana_cost::INTEGER,
        s.damage::INTEGER,
        s.type::TEXT as spell_type
    FROM slot_positions sp
    LEFT JOIN character_spell_slots css ON css.slot_position = sp.position 
        AND css.character_id = p_character_id
    LEFT JOIN spells s ON css.spell_id = s.id
    ORDER BY sp.position;
END;
$$;

-- Recriar função set_potion_slot usando tabela correta
CREATE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Verificar se o consumível existe
    IF p_consumable_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM consumables WHERE id = p_consumable_id
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Consumível não encontrado');
    END IF;

    -- Verificar se o personagem possui o consumível
    IF p_consumable_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND quantity > 0
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Você não possui este consumível');
    END IF;

    -- Verificar se o consumível já está em outro slot (evitar duplicatas)
    IF p_consumable_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM character_potion_slots 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND slot_position != p_slot_position
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Este consumível já está em outro slot');
    END IF;

    -- Inserir ou atualizar o slot
    INSERT INTO character_potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        consumable_id = p_consumable_id,
        updated_at = NOW();

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Slot configurado com sucesso');
END;
$$;

-- Recriar função clear_potion_slot usando tabela correta
CREATE FUNCTION clear_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Limpar o slot
    DELETE FROM character_potion_slots 
    WHERE character_id = p_character_id 
    AND slot_position = p_slot_position;

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Slot limpo com sucesso');
END;
$$;

-- Recriar função set_spell_slot usando tabela correta
CREATE FUNCTION set_spell_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_spell_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Posição do slot inválida (1-3)');
    END IF;

    -- Verificar se a spell existe
    IF p_spell_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM spells WHERE id = p_spell_id
    ) THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Spell não encontrada');
    END IF;

    -- Inserir ou atualizar o slot
    INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, p_slot_position, p_spell_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        spell_id = p_spell_id,
        updated_at = NOW();

    RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Spell slot configurado com sucesso');
END;
$$; 