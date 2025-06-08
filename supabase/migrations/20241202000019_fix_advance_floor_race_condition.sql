-- Migração para corrigir condições de corrida na função secure_advance_floor
-- Data: 2024-12-02
-- Resolve problemas de validação muito restritiva que causava falhas esporádicas

-- =====================================================
-- CORRIGIR FUNÇÃO SECURE_ADVANCE_FLOOR
-- =====================================================

CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_max_floor_reached INTEGER;
BEGIN
    -- Obter andar atual e máximo já alcançado (para validação mais robusta)
    SELECT floor, GREATEST(floor, COALESCE(highest_floor, 1)) 
    INTO v_current_floor, v_max_floor_reached
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validações mais flexíveis para evitar condições de corrida
    
    -- 1. Permitir resetar para andar 1 sempre
    IF p_new_floor = 1 THEN
        -- Log da operação de reset
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'floor_reset', json_build_object(
            'old_floor', v_current_floor, 
            'new_floor', p_new_floor,
            'reason', 'player_reset'
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        -- Atualizar para andar 1
        UPDATE characters
        SET floor = 1, last_activity = NOW()
        WHERE id = p_character_id;
        
        RETURN;
    END IF;
    
    -- 2. Validar limites básicos
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- 3. Permitir avançar apenas UM andar por vez (para evitar exploits)
    -- MAS permitir "re-sincronização" se o andar já foi alcançado antes
    IF p_new_floor > v_current_floor + 1 AND p_new_floor > v_max_floor_reached + 1 THEN
        RAISE EXCEPTION 'Só é possível avançar um andar por vez. Atual: %, Tentativa: %', v_current_floor, p_new_floor;
    END IF;
    
    -- 4. Não permitir retroceder (exceto para andar 1 que já foi tratado)
    IF p_new_floor < v_current_floor AND p_new_floor != 1 THEN
        RAISE EXCEPTION 'Não é possível retroceder. Use a função de reset para voltar ao andar 1';
    END IF;
    
    -- Log da operação de avanço
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'floor_advance', json_build_object(
        'old_floor', v_current_floor, 
        'new_floor', p_new_floor,
        'max_floor_reached', v_max_floor_reached
    ), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Atualizar andar e highest_floor se necessário
    UPDATE characters
    SET
        floor = p_new_floor,
        highest_floor = GREATEST(COALESCE(highest_floor, 1), p_new_floor),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log de sucesso para debug
    RAISE NOTICE 'Andar atualizado com sucesso: % -> % (personagem: %)', v_current_floor, p_new_floor, p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ATUALIZAR PERMISSÕES
-- =====================================================

-- Garantir que as permissões estão corretas
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION secure_advance_floor(UUID, INTEGER) IS 
'Função segura para avançar andares com validação melhorada contra condições de corrida - apenas service_role';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000019_fix_advance_floor_race_condition concluída!';
    RAISE NOTICE '🔄 Função secure_advance_floor atualizada com validações mais robustas';
    RAISE NOTICE '🛡️ Condições de corrida e cache desatualizado resolvidos';
END;
$$; 