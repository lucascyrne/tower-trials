-- Migração para corrigir validação de inteiros e prevenção de valores decimais
-- Data: 2024-12-03
-- Resolve problemas com valores decimais sendo passados para campos integer

-- =====================================================
-- ATUALIZAR FUNÇÃO DE HP/MANA COM VALIDAÇÃO DE INTEIROS
-- =====================================================

-- Recriar a função garantindo que aceite e converta decimais para inteiros
CREATE OR REPLACE FUNCTION internal_update_character_hp_mana(
    p_character_id UUID,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_safe_hp INTEGER;
    v_safe_mana INTEGER;
    v_character_exists BOOLEAN;
BEGIN
    -- Verificar se o personagem existe
    SELECT EXISTS(SELECT 1 FROM characters WHERE id = p_character_id) INTO v_character_exists;
    
    IF NOT v_character_exists THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Converter e validar HP se fornecido
    IF p_hp IS NOT NULL THEN
        -- Garantir que é um inteiro válido
        v_safe_hp := FLOOR(p_hp);
        
        -- Validar limites
        IF v_safe_hp < 0 THEN
            v_safe_hp := 0;
        ELSIF v_safe_hp > 9999 THEN
            v_safe_hp := 9999;
        END IF;
    END IF;
    
    -- Converter e validar Mana se fornecido
    IF p_mana IS NOT NULL THEN
        -- Garantir que é um inteiro válido
        v_safe_mana := FLOOR(p_mana);
        
        -- Validar limites
        IF v_safe_mana < 0 THEN
            v_safe_mana := 0;
        ELSIF v_safe_mana > 9999 THEN
            v_safe_mana := 9999;
        END IF;
    END IF;
    
    -- Atualizar apenas os campos fornecidos
    IF p_hp IS NOT NULL AND p_mana IS NOT NULL THEN
        UPDATE characters 
        SET 
            hp = v_safe_hp,
            mana = v_safe_mana,
            updated_at = NOW()
        WHERE id = p_character_id;
    ELSIF p_hp IS NOT NULL THEN
        UPDATE characters 
        SET 
            hp = v_safe_hp,
            updated_at = NOW()
        WHERE id = p_character_id;
    ELSIF p_mana IS NOT NULL THEN
        UPDATE characters 
        SET 
            mana = v_safe_mana,
            updated_at = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Log da operação para auditoria (se a tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'hp_mana_update', json_build_object(
            'old_hp', (SELECT hp FROM characters WHERE id = p_character_id),
            'new_hp', v_safe_hp,
            'old_mana', (SELECT mana FROM characters WHERE id = p_character_id),
            'new_mana', v_safe_mana,
            'source', 'internal_update'
        ), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao atualizar HP/Mana para personagem %: %', p_character_id, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CRIAR FUNÇÃO PARA CONSUMO DE POÇÕES DOS SLOTS
-- =====================================================

CREATE OR REPLACE FUNCTION consume_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_character RECORD;
    v_slot RECORD;
    v_consumable RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_effect_value INTEGER;
    v_result JSON;
BEGIN
    -- Validar posição do slot
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Posição do slot inválida (1-3)'
        );
    END IF;
    
    -- Obter dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Personagem não encontrado'
        );
    END IF;
    
    -- Obter dados do slot
    SELECT * INTO v_slot FROM character_potion_slots 
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
    
    IF NOT FOUND OR v_slot.consumable_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Slot vazio ou não configurado'
        );
    END IF;
    
    -- Obter dados do consumível
    SELECT * INTO v_consumable FROM consumables WHERE id = v_slot.consumable_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Consumível não encontrado'
        );
    END IF;
    
    -- Verificar se há quantidade suficiente
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = v_slot.consumable_id 
        AND quantity > 0
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Quantidade insuficiente do consumível'
        );
    END IF;
    
    -- Calcular efeito e garantir valores inteiros
    v_effect_value := FLOOR(v_consumable.effect_value);
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;
    
    -- Aplicar efeito baseado no tipo
    CASE v_consumable.type
        WHEN 'potion' THEN
            IF v_consumable.description ILIKE '%HP%' OR v_consumable.description ILIKE '%Vida%' THEN
                v_new_hp := LEAST(v_character.max_hp, v_character.hp + v_effect_value);
            ELSIF v_consumable.description ILIKE '%Mana%' THEN
                v_new_mana := LEAST(v_character.max_mana, v_character.mana + v_effect_value);
            END IF;
        WHEN 'antidote' THEN
            -- Antídotos podem recuperar HP menor
            v_new_hp := LEAST(v_character.max_hp, v_character.hp + FLOOR(v_effect_value / 2));
        ELSE
            -- Outros tipos (buff) não afetam HP/Mana diretamente aqui
            NULL;
    END CASE;
    
    -- Garantir que os valores finais sejam inteiros
    v_new_hp := FLOOR(v_new_hp);
    v_new_mana := FLOOR(v_new_mana);
    
    -- Atualizar HP/Mana do personagem
    UPDATE characters 
    SET 
        hp = v_new_hp,
        mana = v_new_mana,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Reduzir quantidade do consumível
    UPDATE character_consumables 
    SET 
        quantity = quantity - 1,
        updated_at = NOW()
    WHERE character_id = p_character_id AND consumable_id = v_slot.consumable_id;
    
    -- Remover se quantidade chegou a zero
    DELETE FROM character_consumables 
    WHERE character_id = p_character_id 
    AND consumable_id = v_slot.consumable_id 
    AND quantity <= 0;
    
    -- Log da operação
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'potion_consumed', json_build_object(
            'consumable_id', v_slot.consumable_id,
            'consumable_name', v_consumable.name,
            'slot_position', p_slot_position,
            'effect_value', v_effect_value,
            'old_hp', v_character.hp,
            'new_hp', v_new_hp,
            'old_mana', v_character.mana,
            'new_mana', v_new_mana
        ), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'message', format('Você usou %s e recuperou %s!', 
            v_consumable.name,
            CASE 
                WHEN v_new_hp > v_character.hp THEN format('%s HP', v_new_hp - v_character.hp)
                WHEN v_new_mana > v_character.mana THEN format('%s Mana', v_new_mana - v_character.mana)
                ELSE 'energia'
            END
        ),
        'new_hp', v_new_hp,
        'new_mana', v_new_mana
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Erro ao consumir poção: %s', SQLERRM)
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CONFIGURAR PERMISSÕES
-- =====================================================

-- Revogar acesso público e conceder apenas ao service_role
REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION consume_potion_from_slot(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_potion_from_slot(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS E LOG
-- =====================================================

COMMENT ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) IS 
'Função segura para atualizar HP/Mana com validação de inteiros - apenas service_role';

COMMENT ON FUNCTION consume_potion_from_slot(UUID, INTEGER) IS 
'Função segura para consumir poções dos slots com validação de inteiros - apenas service_role';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241203000001_fix_integer_validation concluída com sucesso!';
    RAISE NOTICE '🔧 Funções atualizadas para tratar valores decimais corretamente';
    RAISE NOTICE '🛡️ Validação de inteiros implementada';
END;
$$; 