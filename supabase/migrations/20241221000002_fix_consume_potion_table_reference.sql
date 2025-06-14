-- Corrigir referência de tabela na função consume_potion_from_slot
-- Migração: 20241221000002_fix_consume_potion_table_reference.sql

-- Dropar a função existente
DROP FUNCTION IF EXISTS consume_potion_from_slot(UUID, INTEGER);

-- Recriar a função usando a tabela correta: character_potion_slots
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
    v_consumable_id UUID;
    v_effect_value INTEGER;
    v_consumable_type TEXT;
    v_consumable_name TEXT;
    v_available_quantity INTEGER;
    v_character_record RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_actual_healing INTEGER := 0;
    v_actual_mana_recovery INTEGER := 0;
BEGIN
    -- Log de entrada
    RAISE NOTICE 'consume_potion_from_slot - character: %, slot: %', p_character_id, p_slot_position;

    -- Validar parâmetros de entrada
    IF p_character_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'ID do personagem é obrigatório'::TEXT, 0, 0;
        RETURN;
    END IF;

    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN QUERY SELECT FALSE, 'Posição do slot inválida (deve ser 1-3)'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- CORRIGIDO: Buscar informações do slot usando a tabela correta
    SELECT cps.consumable_id, c.effect_value, c.type, c.name
    INTO v_consumable_id, v_effect_value, v_consumable_type, v_consumable_name
    FROM character_potion_slots cps
    JOIN consumables c ON cps.consumable_id = c.id
    WHERE cps.character_id = p_character_id 
    AND cps.slot_position = p_slot_position;

    -- Verificar se o slot tem uma poção válida
    IF v_consumable_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Slot vazio ou poção não encontrada'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Log da poção encontrada
    RAISE NOTICE 'Poção encontrada: % (ID: %, Tipo: %, Efeito: %)', v_consumable_name, v_consumable_id, v_consumable_type, v_effect_value;

    -- Verificar quantidade disponível no inventário
    SELECT COALESCE(quantity, 0) INTO v_available_quantity
    FROM character_consumables
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id;

    IF v_available_quantity IS NULL OR v_available_quantity <= 0 THEN
        RETURN QUERY SELECT FALSE, format('Você não possui %s no inventário', v_consumable_name), 0, 0;
        RETURN;
    END IF;

    -- Buscar dados atuais do personagem com validação
    SELECT 
        COALESCE(hp, 1) as hp,
        COALESCE(max_hp, 1) as max_hp,
        COALESCE(mana, 0) as mana,
        COALESCE(max_mana, 1) as max_mana
    INTO v_character_record
    FROM characters
    WHERE id = p_character_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, 0, 0;
        RETURN;
    END IF;

    -- Log dos stats atuais
    RAISE NOTICE 'Stats atuais - HP: %/%, Mana: %/%', v_character_record.hp, v_character_record.max_hp, v_character_record.mana, v_character_record.max_mana;

    -- Inicializar com valores atuais (garantindo que sejam válidos)
    v_new_hp := COALESCE(v_character_record.hp, 1);
    v_new_mana := COALESCE(v_character_record.mana, 0);

    -- Validar e limpar valores do efeito
    v_effect_value := COALESCE(v_effect_value, 0);
    
    -- Aplicar efeito baseado no tipo da poção
    IF v_consumable_type = 'potion' THEN
        -- Poção de HP (verificar pelo nome)
        IF v_consumable_name ILIKE '%vida%' OR v_consumable_name ILIKE '%hp%' OR v_consumable_name ILIKE '%health%' OR v_consumable_name ILIKE '%cura%' THEN
            v_new_hp := LEAST(v_character_record.max_hp, v_character_record.hp + v_effect_value);
            v_actual_healing := v_new_hp - v_character_record.hp;
            RAISE NOTICE 'Aplicando cura: % + % = % (max: %)', v_character_record.hp, v_effect_value, v_new_hp, v_character_record.max_hp;
        -- Poção de Mana
        ELSIF v_consumable_name ILIKE '%mana%' OR v_consumable_name ILIKE '%mp%' THEN
            v_new_mana := LEAST(v_character_record.max_mana, v_character_record.mana + v_effect_value);
            v_actual_mana_recovery := v_new_mana - v_character_record.mana;
            RAISE NOTICE 'Aplicando mana: % + % = % (max: %)', v_character_record.mana, v_effect_value, v_new_mana, v_character_record.max_mana;
        END IF;
    END IF;

    -- Validação final dos valores (evitar NaN/NULL)
    v_new_hp := COALESCE(v_new_hp, 1);
    v_new_mana := COALESCE(v_new_mana, 0);

    -- Garantir que os valores estão dentro dos limites válidos
    v_new_hp := GREATEST(0, LEAST(v_new_hp, v_character_record.max_hp));
    v_new_mana := GREATEST(0, LEAST(v_new_mana, v_character_record.max_mana));

    -- Log dos valores finais
    RAISE NOTICE 'Valores finais - HP: %, Mana: %', v_new_hp, v_new_mana;

    -- Atualizar stats do personagem
    UPDATE characters 
    SET 
        hp = v_new_hp,
        mana = v_new_mana,
        updated_at = NOW()
    WHERE id = p_character_id;

    -- Verificar se a atualização foi bem-sucedida
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Erro ao atualizar stats do personagem'::TEXT, v_new_hp, v_new_mana;
        RETURN;
    END IF;

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

    -- Retornar resultado baseado no que foi aplicado
    IF v_actual_healing > 0 THEN
        RETURN QUERY SELECT TRUE, format('%s usado! Recuperou %s HP', v_consumable_name, v_actual_healing), v_new_hp, v_new_mana;
    ELSIF v_actual_mana_recovery > 0 THEN
        RETURN QUERY SELECT TRUE, format('%s usado! Recuperou %s Mana', v_consumable_name, v_actual_mana_recovery), v_new_hp, v_new_mana;
    ELSE
        RETURN QUERY SELECT TRUE, format('%s usado!', v_consumable_name), v_new_hp, v_new_mana;
    END IF;

    RAISE NOTICE 'consume_potion_from_slot concluído com sucesso';
END;
$$; 

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION consume_potion_from_slot TO authenticated;
GRANT EXECUTE ON FUNCTION consume_potion_from_slot TO anon; 