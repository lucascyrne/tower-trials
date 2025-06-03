-- Migração para corrigir detecção de checkpoints desbloqueados
-- Data: 2024-12-02
-- Garante que os checkpoints sejam detectados corretamente

-- =====================================================
-- CORRIGIR FUNÇÃO GET_UNLOCKED_CHECKPOINTS
-- =====================================================

-- Recriar a função com lógica mais robusta
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Debug: log do andar mais alto
    RAISE NOTICE 'get_unlocked_checkpoints chamada com p_highest_floor: %', p_highest_floor;
    
    -- Sempre incluir o andar 1 (início da torre)
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
    -- Só incluir se o jogador passou do boss correspondente
    FOR i IN 1..100 LOOP -- Até 100 bosses (andar 1000)
        DECLARE
            boss_floor INTEGER := i * 10;
            checkpoint_floor INTEGER := boss_floor + 1;
        BEGIN
            -- Se o jogador passou do boss (está no andar do checkpoint ou além)
            IF p_highest_floor >= checkpoint_floor THEN
                RETURN QUERY
                SELECT 
                    checkpoint_floor,
                    ('Andar ' || checkpoint_floor || ' - Checkpoint Pós-Boss')::TEXT as description;
                
                RAISE NOTICE 'Checkpoint desbloqueado: % (passou do boss do andar %)', checkpoint_floor, boss_floor;
            ELSE
                -- Se não passou deste boss, não há mais checkpoints
                EXIT;
            END IF;
        END;
    END LOOP;
    
    RAISE NOTICE 'get_unlocked_checkpoints concluída';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CRIAR FUNÇÃO PARA OBTER HIGHEST_FLOOR
-- =====================================================

-- Função para obter o andar mais alto alcançado por um personagem
CREATE OR REPLACE FUNCTION get_character_highest_floor(p_character_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_highest_floor INTEGER;
BEGIN
    SELECT GREATEST(floor, COALESCE(highest_floor, floor)) 
    INTO v_highest_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RAISE NOTICE 'Personagem % - andar mais alto: %', p_character_id, v_highest_floor;
    
    RETURN COALESCE(v_highest_floor, 1);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO COMBINADA PARA CHECKPOINTS POR PERSONAGEM
-- =====================================================

-- Função que combina as duas anteriores para facilitar uso
CREATE OR REPLACE FUNCTION get_character_unlocked_checkpoints(p_character_id UUID)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
DECLARE
    v_highest_floor INTEGER;
BEGIN
    -- Obter andar mais alto do personagem
    SELECT get_character_highest_floor(p_character_id) INTO v_highest_floor;
    
    -- Retornar checkpoints desbloqueados
    RETURN QUERY
    SELECT * FROM get_unlocked_checkpoints(v_highest_floor);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GARANTIR COLUNA HIGHEST_FLOOR EXISTE
-- =====================================================

-- Adicionar coluna highest_floor se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'characters' AND column_name = 'highest_floor') THEN
        ALTER TABLE characters ADD COLUMN highest_floor INTEGER;
        
        -- Inicializar com o andar atual para personagens existentes
        UPDATE characters SET highest_floor = floor WHERE highest_floor IS NULL;
        
        RAISE NOTICE 'Coluna highest_floor adicionada e inicializada';
    END IF;
END;
$$;

-- =====================================================
-- ATUALIZAR FUNÇÃO SECURE_ADVANCE_FLOOR
-- =====================================================

-- Garantir que secure_advance_floor atualiza highest_floor corretamente
CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_highest_floor INTEGER;
BEGIN
    -- Obter andar atual e highest_floor
    SELECT floor, COALESCE(highest_floor, floor) 
    INTO v_current_floor, v_highest_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validações básicas
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- Permitir resetar para andar 1 sempre
    IF p_new_floor = 1 THEN
        UPDATE characters
        SET floor = 1, last_activity = NOW()
        WHERE id = p_character_id;
        
        RAISE NOTICE 'Personagem % resetado para andar 1', p_character_id;
        RETURN;
    END IF;
    
    -- Validar progressão (máximo +1 andar ou re-visitar andar já alcançado)
    IF p_new_floor > v_highest_floor + 1 THEN
        RAISE EXCEPTION 'Só é possível avançar um andar por vez ou revisitar andares já alcançados. Atual: %, Tentativa: %, Máximo: %', v_current_floor, p_new_floor, v_highest_floor;
    END IF;
    
    -- Não permitir retroceder além do já alcançado (exceto andar 1)
    IF p_new_floor < 1 THEN
        RAISE EXCEPTION 'Não é possível ir para andar menor que 1';
    END IF;
    
    -- Atualizar andar e highest_floor
    UPDATE characters
    SET
        floor = p_new_floor,
        highest_floor = GREATEST(COALESCE(highest_floor, floor), p_new_floor),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    RAISE NOTICE 'Andar atualizado: % -> % (highest: %)', v_current_floor, p_new_floor, GREATEST(v_highest_floor, p_new_floor);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PERMISSÕES
-- =====================================================

-- Funções públicas (podem ser chamadas pelo cliente)
GRANT EXECUTE ON FUNCTION get_unlocked_checkpoints(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_character_highest_floor(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_character_unlocked_checkpoints(UUID) TO authenticated, anon;

-- Função restrita
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS 
'Retorna checkpoints desbloqueados baseado no andar mais alto alcançado';

COMMENT ON FUNCTION get_character_highest_floor(UUID) IS 
'Retorna o andar mais alto já alcançado por um personagem';

COMMENT ON FUNCTION get_character_unlocked_checkpoints(UUID) IS 
'Retorna checkpoints desbloqueados para um personagem específico';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000020_fix_checkpoint_detection concluída!';
    RAISE NOTICE '🗺️ Sistema de checkpoints corrigido e melhorado';
    RAISE NOTICE '🔍 Funções de debug adicionadas com logs detalhados';
END;
$$; 