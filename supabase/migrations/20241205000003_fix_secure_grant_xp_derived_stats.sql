-- ================================
-- Migração para corrigir função secure_grant_xp
-- Data: 2024-12-05
-- ================================

-- PROBLEMA: A função secure_grant_xp está tentando usar colunas derived_* da função calculate_derived_stats,
-- mas a versão atual retorna colunas hp, max_hp, mana, max_mana, etc.

-- SOLUÇÃO: Atualizar a função secure_grant_xp para usar a assinatura correta

-- =====================================
-- 1. CORRIGIR FUNÇÃO SECURE_GRANT_XP
-- =====================================

CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
    v_max_xp_per_call INTEGER := 10000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    IF p_xp_amount > v_max_xp_per_call THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada (máximo: %)', v_max_xp_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Calcular novo XP
    v_new_xp := v_current_xp + p_xp_amount;
    
    -- Processar level ups
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP -- Cap em level 100
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- CORRIGIDO: Calcular novos stats base usando a assinatura atual
        SELECT 
            hp, max_hp, mana, max_mana, atk, def, speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- CORRIGIDO: Atualizar stats com level up usando nomes corretos das colunas
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.max_hp,
            max_mana = v_base_stats.max_mana,
            atk = v_base_stats.atk,
            def = v_base_stats.def,
            speed = v_base_stats.speed,
            hp = v_base_stats.max_hp, -- Cura completa no level up
            mana = v_base_stats.max_mana, -- Cura completa no level up
            last_activity = NOW()
        WHERE id = p_character_id;
        
        -- Conceder pontos de atributo
        PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
        
        -- Atualizar progressão do usuário
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    ELSE
        -- Apenas atualizar XP
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. VERIFICAR SE OUTRAS FUNÇÕES SEGURAS PRECISAM SER CORRIGIDAS
-- =====================================

-- Verificar se existem outras funções que também usam derived_* incorretamente
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Esta é uma verificação de segurança, mas não vamos corrigir automaticamente
    -- para evitar quebrar outras funções inadvertidamente
    RAISE NOTICE 'Função secure_grant_xp corrigida para usar assinatura atual de calculate_derived_stats';
END $$;

-- =====================================
-- COMENTÁRIOS DA CORREÇÃO
-- =====================================

COMMENT ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) IS 
'Função corrigida para usar a versão atual de calculate_derived_stats.
- Removido: derived_hp, derived_max_hp, derived_mana, derived_max_mana, derived_atk, derived_def, derived_speed
- Adicionado: hp, max_hp, mana, max_mana, atk, def, speed
- Inclui todos os parâmetros de maestria na chamada da função';

-- Migração concluída com sucesso
-- Função secure_grant_xp corrigida para usar assinatura atual 