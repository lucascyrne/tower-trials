-- Melhorar função get_character_potion_slots para incluir dados do inventário
-- Migração: 20241220000010_improve_potion_slots_function.sql

-- Dropar a função existente para permitir alteração do tipo de retorno
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);

-- Criar a função get_character_potion_slots atualizada (sem consumable_image)
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
    RETURN QUERY
    SELECT 
        ps.slot_position,
        ps.consumable_id,
        c.name as consumable_name,
        c.description as consumable_description,
        c.effect_value,
        c.type as consumable_type,
        COALESCE(cc.quantity, 0) as available_quantity,
        c.price as consumable_price
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

-- Dropar a função consume_potion_from_slot existente para permitir alteração
DROP FUNCTION IF EXISTS consume_potion_from_slot(UUID, INTEGER);

-- Criar a função consume_potion_from_slot atualizada
CREATE FUNCTION consume_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_hp INTEGER,
    new_mana INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_consumable_id UUID;
    v_effect_value INTEGER;
    v_consumable_type TEXT;
    v_consumable_name TEXT;
    v_available_quantity INTEGER;
    v_character_record RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_actual_healing INTEGER;
    v_actual_mana_recovery INTEGER;
BEGIN
    -- Buscar informações do slot
    SELECT ps.consumable_id, c.effect_value, c.type, c.name
    INTO v_consumable_id, v_effect_value, v_consumable_type, v_consumable_name
    FROM potion_slots ps
    JOIN consumables c ON ps.consumable_id = c.id
    WHERE ps.character_id = p_character_id 
    AND ps.slot_position = p_slot_position;

    -- Verificar se o slot tem uma poção válida
    IF v_consumable_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Slot vazio'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Verificar quantidade disponível no inventário
    SELECT quantity INTO v_available_quantity
    FROM character_consumables
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id;

    IF v_available_quantity IS NULL OR v_available_quantity <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Você não possui esta poção no inventário'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Buscar dados atuais do personagem
    SELECT hp, max_hp, mana, max_mana
    INTO v_character_record
    FROM characters
    WHERE id = p_character_id;

    -- Calcular novos valores baseados no tipo da poção
    v_new_hp := v_character_record.hp;
    v_new_mana := v_character_record.mana;

    IF v_consumable_type = 'potion' THEN
        -- Poção de HP
        IF v_consumable_name ILIKE '%vida%' OR v_consumable_name ILIKE '%hp%' OR v_consumable_name ILIKE '%health%' THEN
            v_new_hp := LEAST(v_character_record.max_hp, v_character_record.hp + v_effect_value);
            v_actual_healing := v_new_hp - v_character_record.hp;
        -- Poção de Mana
        ELSIF v_consumable_name ILIKE '%mana%' OR v_consumable_name ILIKE '%mp%' THEN
            v_new_mana := LEAST(v_character_record.max_mana, v_character_record.mana + v_effect_value);
            v_actual_mana_recovery := v_new_mana - v_character_record.mana;
        END IF;
    END IF;

    -- Atualizar stats do personagem
    UPDATE characters 
    SET 
        hp = v_new_hp,
        mana = v_new_mana,
        updated_at = NOW()
    WHERE id = p_character_id;

    -- Reduzir quantidade no inventário
    UPDATE character_consumables 
    SET quantity = quantity - 1
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id;

    -- Remover do inventário se quantidade chegou a 0
    DELETE FROM character_consumables 
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id 
    AND quantity <= 0;

    -- Retornar resultado
    IF v_actual_healing > 0 THEN
        RETURN QUERY SELECT TRUE, format('%s usado! Recuperou %s HP', v_consumable_name, v_actual_healing), v_new_hp, v_new_mana;
    ELSIF v_actual_mana_recovery > 0 THEN
        RETURN QUERY SELECT TRUE, format('%s usado! Recuperou %s Mana', v_consumable_name, v_actual_mana_recovery), v_new_hp, v_new_mana;
    ELSE
        RETURN QUERY SELECT TRUE, format('%s usado!', v_consumable_name), v_new_hp, v_new_mana;
    END IF;
END;
$$; 