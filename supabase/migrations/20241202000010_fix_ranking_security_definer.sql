-- Migração para corrigir SECURITY DEFINER nas funções de ranking
-- Data: 2024-12-02
-- Versão: 20241202000010

-- =====================================
-- PROBLEMA IDENTIFICADO:
-- As funções de ranking não têm SECURITY DEFINER, então elas executam
-- com privilégios do usuário atual e só conseguem ver os personagens
-- desse usuário devido às políticas RLS.
-- =====================================

-- =====================================
-- 1. REMOVER FUNÇÕES EXISTENTES
-- =====================================

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- =====================================
-- 2. RECRIAR FUNÇÕES COM SECURITY DEFINER
-- =====================================

-- Função para ranking global por andar mais alto (COM SECURITY DEFINER)
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
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
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

-- Função para ranking global por nível (COM SECURITY DEFINER)
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
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
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

-- Função para ranking global por ouro (COM SECURITY DEFINER)
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
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
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
-- 3. FUNÇÃO PARA HISTÓRICO DO USUÁRIO (MANTÉM SEM SECURITY DEFINER)
-- =====================================

-- Esta função deve continuar SEM SECURITY DEFINER pois deve respeitar RLS
-- para mostrar apenas os personagens do usuário atual
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
-- SEM SECURITY DEFINER - deve respeitar RLS para mostrar apenas dados do usuário
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
-- 4. FUNÇÃO PARA ESTATÍSTICAS DO USUÁRIO (MANTÉM SEM SECURITY DEFINER)
-- =====================================

-- Esta função deve continuar SEM SECURITY DEFINER pois deve respeitar RLS
-- para calcular estatísticas apenas dos personagens do usuário atual
CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
-- SEM SECURITY DEFINER - deve respeitar RLS para mostrar apenas dados do usuário
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
-- 5. TESTE FINAL
-- =====================================

DO $$
DECLARE
    test_result RECORD;
    total_count INTEGER;
    total_users INTEGER;
BEGIN
    RAISE NOTICE '=== TESTE FINAL COM SECURITY DEFINER ===';
    
    -- Verificar total de personagens no banco
    SELECT COUNT(*) INTO total_count FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    
    RAISE NOTICE 'Total de personagens no banco: %', total_count;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    
    -- Teste 1: Ranking por andar (todos) - deve mostrar personagens de todos os usuários
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 1 - Ranking por andar (todos): % registros', total_count;
    
    -- Teste 2: Verificar diversidade de usuários no ranking
    SELECT COUNT(DISTINCT user_id) INTO total_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 2 - Usuários únicos no ranking: %', total_count;
    
    -- Teste 3: Mostrar top 3 do ranking para verificar se há diferentes usuários
    RAISE NOTICE 'Teste 3 - Top 3 do ranking global:';
    FOR test_result IN 
        SELECT player_name, highest_floor, character_level, character_alive, user_id
        FROM get_dynamic_ranking_by_highest_floor(3, 'all')
    LOOP
        RAISE NOTICE '  - %: Andar %, Nível %, Vivo: %, User ID: %', 
            test_result.player_name, test_result.highest_floor, 
            test_result.character_level, test_result.character_alive,
            test_result.user_id;
    END LOOP;
    
    IF total_count > 0 AND total_users > 1 THEN
        RAISE NOTICE '✅ CORREÇÃO APLICADA COM SUCESSO!';
        RAISE NOTICE '✅ O ranking agora deve mostrar personagens de TODOS os usuários!';
    ELSE
        RAISE NOTICE '⚠️  ATENÇÃO: Pode não haver dados suficientes para testar completamente';
    END IF;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA ===';
END $$;

-- =====================================
-- EXPLICAÇÃO DA CORREÇÃO:
-- =====================================

-- SECURITY DEFINER faz com que a função execute com os privilégios
-- do usuário que a criou (geralmente o superusuário), permitindo
-- que ela acesse todos os dados da tabela characters, ignorando
-- as políticas RLS que normalmente restringem o acesso apenas
-- aos personagens do usuário atual.
--
-- Isso é necessário para funções de ranking global, mas deve ser
-- usado com cuidado para não expor dados sensíveis.
--
-- As funções de histórico e estatísticas do usuário NÃO devem
-- ter SECURITY DEFINER pois devem respeitar as políticas RLS
-- para mostrar apenas os dados do usuário atual. 