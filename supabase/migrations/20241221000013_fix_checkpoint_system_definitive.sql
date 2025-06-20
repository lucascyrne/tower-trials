-- ===================================================================================================
-- MIGRAÇÃO: CORREÇÃO DEFINITIVA DO SISTEMA DE CHECKPOINTS
-- ===================================================================================================
-- Data: 2024-12-21
-- Versão: 20241221000013
-- Objetivo: Padronizar sistema de checkpoints com andar 5 como primeiro checkpoint especial

-- NOVA LÓGICA DE CHECKPOINTS:
-- - Andar 1: Início da Torre (sempre disponível)
-- - Andar 5: Primeiro Desafio (checkpoint especial)
-- - Andares 11, 21, 31, 41...: Checkpoints pós-boss (após andares 10, 20, 30, 40...)

-- =====================================================
-- CORRIGIR FUNÇÃO GET_UNLOCKED_CHECKPOINTS
-- =====================================================

CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Sempre incluir o andar 1 (início da torre)
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Checkpoint especial no andar 5 (se alcançado)
    IF p_highest_floor >= 5 THEN
        RETURN QUERY
        SELECT 
            5 as floor_number,
            'Andar 5 - Primeiro Desafio'::TEXT as description;
    END IF;
    
    -- Checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
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
            ELSE
                -- Se não passou deste boss, não há mais checkpoints
                EXIT;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CORRIGIR FUNÇÃO GET_FLOOR_DATA
-- =====================================================

CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    -- Se o andar não existe, gerar informações dinamicamente
    IF v_floor IS NULL THEN
        -- Definir tipo do andar com nova lógica
        v_floor_type := CASE 
            WHEN p_floor_number = 5 THEN 'boss'::floor_type  -- Primeiro desafio
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type  -- Bosses principais
            WHEN p_floor_number % 5 = 0 AND p_floor_number > 5 THEN 'elite'::floor_type  -- Elites a cada 5 andares (exceto boss floors)
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type  -- Eventos especiais
            ELSE 'common'::floor_type
        END;
        
        -- Checkpoints: 1, 5, e pós-boss (11, 21, 31, etc.)
        v_is_checkpoint := (p_floor_number = 1) OR 
                          (p_floor_number = 5) OR
                          (p_floor_number > 10 AND (p_floor_number - 1) % 10 = 0);
        
        v_min_level := GREATEST(1, p_floor_number / 3);
        
        -- Descrições melhoradas
        v_description := CASE 
            WHEN p_floor_number = 1 THEN 'Entrada da Torre'
            WHEN p_floor_number = 5 THEN 'Primeiro Desafio - Andar 5'
            WHEN p_floor_number % 10 = 0 THEN 'Covil do Chefe - Andar ' || p_floor_number
            WHEN p_floor_number % 5 = 0 THEN 'Domínio de Elite - Andar ' || p_floor_number
            WHEN p_floor_number % 7 = 0 THEN 'Câmara de Eventos - Andar ' || p_floor_number
            WHEN v_is_checkpoint THEN 'Santuário Seguro - Andar ' || p_floor_number
            ELSE 'Corredor Sombrio - Andar ' || p_floor_number
        END;
        
        RETURN QUERY
        SELECT 
            p_floor_number,
            v_floor_type,
            v_is_checkpoint,
            v_min_level,
            v_description;
    ELSE
        -- Retornar dados do andar existente, mas atualizar is_checkpoint com nova lógica
        v_is_checkpoint := (v_floor.floor_number = 1) OR 
                          (v_floor.floor_number = 5) OR
                          (v_floor.floor_number > 10 AND (v_floor.floor_number - 1) % 10 = 0);
        
        RETURN QUERY
        SELECT 
            v_floor.floor_number,
            v_floor.type,
            v_is_checkpoint, -- Usar nova lógica
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CORRIGIR FUNÇÃO SECURE_ADVANCE_FLOOR
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
    v_new_highest_floor INTEGER;
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
    
    -- Permitir ir para qualquer checkpoint desbloqueado
    -- Lista de checkpoints válidos: 1, 5, 11, 21, 31, 41, etc.
    DECLARE
        v_is_valid_checkpoint BOOLEAN := FALSE;
        checkpoints INTEGER[];
    BEGIN
        -- Construir lista de checkpoints desbloqueados
        SELECT ARRAY_AGG(uc.floor_number) 
        INTO checkpoints
        FROM get_unlocked_checkpoints(v_highest_floor) uc;
        
        -- Verificar se é um checkpoint válido ou progressão normal
        v_is_valid_checkpoint := (
            p_new_floor = ANY(checkpoints) OR  -- Checkpoint desbloqueado
            p_new_floor = v_highest_floor + 1  -- Progressão normal (+1 andar)
        );
        
        IF NOT v_is_valid_checkpoint THEN
            RAISE EXCEPTION 'Movimento inválido. Andares permitidos: checkpoints desbloqueados ou próximo andar (%). Tentativa: %', 
                v_highest_floor + 1, p_new_floor;
        END IF;
    END;
    
    -- Calcular novo highest_floor
    v_new_highest_floor := GREATEST(v_highest_floor, p_new_floor);
    
    -- Atualizar andar e highest_floor
    UPDATE characters
    SET
        floor = p_new_floor,
        highest_floor = v_new_highest_floor,
        last_activity = NOW()
    WHERE id = p_character_id;
    
    RAISE NOTICE 'Andar atualizado: % -> % (highest: % -> %)', 
        v_current_floor, p_new_floor, v_highest_floor, v_new_highest_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GARANTIR HIGHEST_FLOOR ESTÁ CORRETO PARA PERSONAGENS EXISTENTES
-- =====================================================

-- Atualizar highest_floor para personagens existentes baseado no floor atual
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- =====================================================
-- ATUALIZAR DADOS EXISTENTES DE FLOORS
-- =====================================================

-- Atualizar is_checkpoint em floors existentes com nova lógica
UPDATE floors 
SET is_checkpoint = (
    floor_number = 1 OR 
    floor_number = 5 OR
    (floor_number > 10 AND (floor_number - 1) % 10 = 0)
);

-- =====================================================
-- INSERIR/ATUALIZAR ANDARES ESPECÍFICOS
-- =====================================================

INSERT INTO floors (floor_number, type, monster_pool, is_checkpoint, min_level, description) VALUES
(1, 'common', '{}', true, 1, 'Entrada da Torre - O Despertar'),
(5, 'boss', '{}', true, 2, 'Primeiro Desafio - Guardião Iniciante'),
(10, 'boss', '{}', false, 4, 'Covil do Guardião Sombrio'),
(11, 'common', '{}', true, 4, 'Santuário da Primeira Vitória'),
(15, 'elite', '{}', false, 5, 'Domínio de Elite - Soldado Veterano'),
(20, 'boss', '{}', false, 7, 'Trono do Senhor das Trevas'),
(21, 'common', '{}', true, 7, 'Refúgio dos Sobreviventes'),
(25, 'elite', '{}', false, 8, 'Fortaleza dos Campeões'),
(30, 'boss', '{}', false, 10, 'Arena do Devorador de Almas'),
(31, 'common', '{}', true, 10, 'Câmara da Redenção'),
(40, 'boss', '{}', false, 13, 'Palácio do Rei Demônio'),
(41, 'common', '{}', true, 14, 'Oásis da Esperança'),
(50, 'boss', '{}', false, 17, 'Cidadela do Lorde Supremo'),
(51, 'common', '{}', true, 17, 'Templo da Transcendência')
ON CONFLICT (floor_number) DO UPDATE SET
    type = EXCLUDED.type,
    is_checkpoint = EXCLUDED.is_checkpoint,
    description = EXCLUDED.description,
    min_level = EXCLUDED.min_level;

-- =====================================================
-- PERMISSÕES E COMENTÁRIOS
-- =====================================================

-- Revogar e conceder permissões corretas
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION get_unlocked_checkpoints(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_character_unlocked_checkpoints(UUID) TO authenticated, anon;

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS 
'Retorna checkpoints desbloqueados: 1, 5 (especial), e pós-boss (11, 21, 31...)';

COMMENT ON FUNCTION get_floor_data(INTEGER) IS 
'Retorna dados do andar com sistema de checkpoints padronizado: boss floors em 5, 10, 20, 30...';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== SISTEMA DE CHECKPOINTS CORRIGIDO DEFINITIVAMENTE ===';
    RAISE NOTICE 'Checkpoints: 1 (início), 5 (primeiro desafio), 11, 21, 31... (pós-boss)';
    RAISE NOTICE 'Boss floors: 5 (especial), 10, 20, 30, 40... (a cada 10)';
    RAISE NOTICE 'Elite floors: 15, 25, 35... (a cada 5, exceto boss floors)';
    RAISE NOTICE 'Sistema agora é consistente em todo o codebase';
    RAISE NOTICE '=====================================================';
END $$; 