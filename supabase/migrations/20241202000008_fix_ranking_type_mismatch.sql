-- Migração para corrigir incompatibilidade de tipos nas funções de ranking
-- Data: 2024-12-02
-- Versão: 20241202000008

-- =====================================
-- CORRIGIR TIPOS DAS FUNÇÕES DE RANKING
-- =====================================

-- Primeiro, remover as funções existentes para poder alterar os tipos de retorno
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- Função corrigida para ranking global por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_level chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_gold chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para histórico do usuário
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_user_ranking_history chamada para usuário: % com limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
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

-- Função corrigida para estatísticas do usuário
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
-- VERIFICAÇÃO FINAL
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO DE TIPOS CORRIGIDOS ===';
    
    -- Contar personagens diretamente
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    RAISE NOTICE '=== TIPOS CORRIGIDOS COM SUCESSO ===';
END $$;

-- Migração concluída! 