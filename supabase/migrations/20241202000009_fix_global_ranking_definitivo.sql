-- Migração definitiva para garantir ranking global funcionando
-- Data: 2024-12-02
-- Versão: 20241202000009

-- =====================================
-- 1. DIAGNÓSTICO INICIAL
-- =====================================

DO $$
DECLARE
    total_characters INTEGER;
    total_users INTEGER;
    alive_characters INTEGER;
    dead_characters INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_characters FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    SELECT COUNT(*) INTO alive_characters FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_characters FROM characters WHERE is_alive = false;
    
    RAISE NOTICE '=== DIAGNÓSTICO INICIAL ===';
    RAISE NOTICE 'Total de personagens: %', total_characters;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    RAISE NOTICE 'Personagens vivos: %', alive_characters;
    RAISE NOTICE 'Personagens mortos: %', dead_characters;
    RAISE NOTICE '================================';
END $$;

-- =====================================
-- 2. REMOVER FUNÇÕES EXISTENTES
-- =====================================

-- Remover todas as funções de ranking existentes
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- =====================================
-- 3. CRIAR FUNÇÕES DE RANKING GLOBAL DEFINITIVAS
-- =====================================

-- Função para ranking global por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por andar - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por nível - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por ouro - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA HISTÓRICO DO USUÁRIO (SEPARADA)
-- =====================================

-- Função específica para histórico do usuário (não é ranking global)
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[USER HISTORY] Buscando histórico do usuário: %, limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 5. FUNÇÃO PARA ESTATÍSTICAS DO USUÁRIO
-- =====================================

CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE c.is_alive = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 6. TESTE DEFINITIVO DO RANKING GLOBAL
-- =====================================

DO $$
DECLARE
    test_result RECORD;
    total_count INTEGER;
BEGIN
    RAISE NOTICE '=== TESTE DEFINITIVO DO RANKING GLOBAL ===';
    
    -- Teste 1: Ranking por andar (todos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 1 - Ranking por andar (todos): % registros', total_count;
    
    -- Teste 2: Ranking por andar (vivos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'alive');
    RAISE NOTICE 'Teste 2 - Ranking por andar (vivos): % registros', total_count;
    
    -- Teste 3: Ranking por andar (mortos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'dead');
    RAISE NOTICE 'Teste 3 - Ranking por andar (mortos): % registros', total_count;
    
    -- Teste 4: Verificar diversidade de usuários no ranking
    SELECT COUNT(DISTINCT user_id) INTO total_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 4 - Usuários únicos no ranking: %', total_count;
    
    -- Teste 5: Mostrar top 5 do ranking
    RAISE NOTICE 'Teste 5 - Top 5 do ranking global:';
    FOR test_result IN 
        SELECT player_name, highest_floor, character_level, character_alive
        FROM get_dynamic_ranking_by_highest_floor(5, 'all')
    LOOP
        RAISE NOTICE '  - %: Andar %, Nível %, Vivo: %', 
            test_result.player_name, test_result.highest_floor, 
            test_result.character_level, test_result.character_alive;
    END LOOP;
    
    RAISE NOTICE '=== TESTES CONCLUÍDOS ===';
END $$;

-- =====================================
-- 7. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar campo is_alive baseado no HP atual
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive != (hp > 0);

-- Garantir que todos os personagens tenham floor válido
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- =====================================
-- 8. VERIFICAÇÃO FINAL
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    total_users INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO FINAL ===';
    
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    IF total_chars > 0 AND total_users > 0 THEN
        RAISE NOTICE '✅ RANKING GLOBAL CONFIGURADO COM SUCESSO!';
        RAISE NOTICE '✅ O ranking agora mostra TODOS os personagens de TODOS os usuários!';
    ELSE
        RAISE NOTICE '❌ PROBLEMA: Não há dados suficientes para o ranking';
    END IF;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA ===';
END $$;

-- Migração concluída! 