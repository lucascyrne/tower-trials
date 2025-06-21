-- Migração para corrigir erro de sintaxe na função consume_potion_from_slot
-- Migração: 20241221000024_fix_consume_potion_function.sql

-- Função corrigida para consumo de poção que automaticamente limpa slot quando acaba
CREATE OR REPLACE FUNCTION consume_potion_from_slot(
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
    v_slot_consumable_id UUID;
    v_available_quantity INTEGER;
    v_consumable_name TEXT;
    v_consumable_type TEXT;
    v_effect_value INTEGER;
    v_current_hp INTEGER;
    v_current_mana INTEGER;
    v_max_hp INTEGER;
    v_max_mana INTEGER;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_actual_healing INTEGER := 0;
    v_actual_mana_recovery INTEGER := 0;
    v_message TEXT := '';  -- ✅ CORREÇÃO: Mover declaração para o topo
BEGIN
    -- Validar entrada
    IF p_character_id IS NULL OR p_slot_position IS NULL THEN
        RETURN QUERY SELECT false, 'Parâmetros inválidos'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN QUERY SELECT false, 'Posição do slot inválida (1-3)'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Obter dados do slot
    SELECT cps.consumable_id, c.name, c.type, c.effect_value
    INTO v_slot_consumable_id, v_consumable_name, v_consumable_type, v_effect_value
    FROM character_potion_slots cps
    JOIN consumables c ON cps.consumable_id = c.id
    WHERE cps.character_id = p_character_id 
    AND cps.slot_position = p_slot_position;

    -- Verificar se slot tem poção
    IF v_slot_consumable_id IS NULL THEN
        RETURN QUERY SELECT false, 'Slot está vazio'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Verificar quantidade disponível
    SELECT quantity INTO v_available_quantity
    FROM character_consumables
    WHERE character_id = p_character_id 
    AND consumable_id = v_slot_consumable_id;

    IF v_available_quantity IS NULL OR v_available_quantity <= 0 THEN
        -- CRÍTICO: Limpar slot automaticamente se não há poção disponível
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;

        RETURN QUERY SELECT false, 'Poção não está mais disponível (slot limpo automaticamente)'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Obter stats atuais do personagem
    SELECT hp, mana, max_hp, max_mana
    INTO v_current_hp, v_current_mana, v_max_hp, v_max_mana
    FROM characters
    WHERE id = p_character_id;

    -- Inicializar novos valores
    v_new_hp := v_current_hp;
    v_new_mana := v_current_mana;

    -- Aplicar efeito da poção baseado no tipo
    IF v_consumable_type = 'potion' THEN
        -- Determinar tipo de poção pela descrição ou nome
        IF v_consumable_name ILIKE '%vida%' OR v_consumable_name ILIKE '%hp%' OR v_consumable_name ILIKE '%health%' THEN
            -- Poção de HP
            v_new_hp := LEAST(v_max_hp, v_current_hp + v_effect_value);
            v_actual_healing := v_new_hp - v_current_hp;
        ELSIF v_consumable_name ILIKE '%mana%' OR v_consumable_name ILIKE '%mp%' THEN
            -- Poção de Mana
            v_new_mana := LEAST(v_max_mana, v_current_mana + v_effect_value);
            v_actual_mana_recovery := v_new_mana - v_current_mana;
        END IF;
    END IF;

    -- Consumir uma unidade da poção
    UPDATE character_consumables 
    SET quantity = quantity - 1
    WHERE character_id = p_character_id 
    AND consumable_id = v_slot_consumable_id;

    -- Atualizar HP/Mana do personagem
    UPDATE characters 
    SET hp = v_new_hp, mana = v_new_mana
    WHERE id = p_character_id;

    -- CRÍTICO: Se a quantidade chegou a 0, limpar o slot automaticamente
    IF v_available_quantity - 1 <= 0 THEN
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;
    END IF;

    -- ✅ CORREÇÃO: Construir mensagem de sucesso sem bloco DECLARE aninhado
    IF v_actual_healing > 0 THEN
        v_message := format('Recuperou %s HP!', v_actual_healing);
    ELSIF v_actual_mana_recovery > 0 THEN
        v_message := format('Recuperou %s Mana!', v_actual_mana_recovery);
    ELSE
        v_message := format('%s usado!', v_consumable_name);
    END IF;

    -- Adicionar aviso se slot foi limpo
    IF v_available_quantity - 1 <= 0 THEN
        v_message := v_message || ' (Slot limpo automaticamente)';
    END IF;

    RETURN QUERY SELECT true, v_message, v_new_hp, v_new_mana;
END;
$$; 