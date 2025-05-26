-- Migração para limpar funções duplicadas e resolver conflitos de overloading
-- Remove todas as versões das funções de ranking e recria apenas as corretas

-- =====================================
-- 1. REMOVER TODAS AS VERSÕES DAS FUNÇÕES DE RANKING
-- =====================================

-- Remover todas as versões possíveis das funções de ranking dinâmico
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor();

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level();

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold();

DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid, integer);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history();

DROP FUNCTION IF EXISTS get_dynamic_user_stats(uuid);
DROP FUNCTION IF EXISTS get_dynamic_user_stats();

-- Remover também versões otimizadas se existirem
DROP FUNCTION IF EXISTS get_optimized_global_ranking(text, integer, text);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(varchar, integer, varchar);
DROP FUNCTION IF EXISTS get_fast_user_stats(uuid);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(uuid, integer);

-- =====================================
-- 2. RECRIAR FUNÇÕES DE RANKING COM TIPOS CONSISTENTES
-- =====================================

-- Função para ranking dinâmico por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para histórico de ranking do usuário
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Função para estatísticas dinâmicas do usuário
CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE COALESCE(c.is_alive, true) = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 3. GARANTIR PERMISSÕES CORRETAS
-- =====================================

-- Garantir que as funções podem ser executadas por usuários autenticados
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_highest_floor(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_level(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_gold(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_user_ranking_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_user_stats(UUID) TO authenticated;

-- Garantir que as funções podem ser executadas pelo service_role
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_highest_floor(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_level(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_gold(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_user_ranking_history(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_user_stats(UUID) TO service_role;

-- Script concluído com sucesso!
-- Funções duplicadas removidas e recriadas com tipos consistentes 