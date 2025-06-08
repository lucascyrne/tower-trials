-- Otimizações para o Sistema de Ranking Dinâmico

-- Criar índices otimizados para consultas de ranking dinâmico
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor ON characters(user_id, floor DESC, level DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_ranking_level ON characters(user_id, level DESC, floor DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold ON characters(user_id, gold DESC, floor DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_active_ranking ON characters(floor DESC, level DESC, gold DESC) WHERE floor > 0;

-- Índices para game_rankings otimizados para consultas dinâmicas
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_users ON game_rankings(user_id, character_alive, highest_floor DESC) WHERE character_alive = FALSE;
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_level ON game_rankings(user_id, character_alive, character_level DESC) WHERE character_alive = FALSE;
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_gold ON game_rankings(user_id, character_alive, character_gold DESC) WHERE character_alive = FALSE;

-- Função otimizada para obter ranking global com melhor performance
CREATE OR REPLACE FUNCTION get_optimized_global_ranking(
    p_mode VARCHAR DEFAULT 'highest_floor', -- 'highest_floor', 'level', 'gold'
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    order_clause TEXT;
BEGIN
    -- Definir ordenação baseada no modo
    CASE p_mode
        WHEN 'level' THEN
            order_clause := 'cs.character_level DESC, cs.highest_floor DESC, cs.created_at ASC';
        WHEN 'gold' THEN
            order_clause := 'cs.character_gold DESC, cs.highest_floor DESC, cs.created_at ASC';
        ELSE -- 'highest_floor'
            order_clause := 'cs.highest_floor DESC, cs.character_level DESC, cs.created_at ASC';
    END CASE;

    RETURN QUERY EXECUTE format('
        WITH character_stats AS (
            -- Personagens vivos (apenas se solicitado)
            SELECT 
                c.id,
                c.user_id,
                c.name as player_name,
                c.floor as highest_floor,
                c.level as character_level,
                c.gold as character_gold,
                TRUE as character_alive,
                c.created_at
            FROM characters c
            WHERE ($3 = ''all'' OR $3 = ''alive'')
            AND c.floor > 0 -- Apenas personagens que começaram a jogar
            
            UNION ALL
            
            -- Personagens mortos (apenas se solicitado)
            SELECT DISTINCT ON (r.user_id)
                r.id,
                r.user_id,
                r.player_name,
                r.highest_floor,
                r.character_level,
                r.character_gold,
                r.character_alive,
                r.created_at
            FROM game_rankings r
            WHERE r.character_alive = FALSE
            AND ($3 = ''all'' OR $3 = ''dead'')
            ORDER BY r.user_id, %s
        ),
        best_per_user AS (
            -- Obter o melhor resultado por usuário
            SELECT DISTINCT ON (cs.user_id)
                cs.id,
                cs.user_id,
                cs.player_name,
                cs.highest_floor,
                cs.character_level,
                cs.character_gold,
                cs.character_alive,
                cs.created_at
            FROM character_stats cs
            ORDER BY cs.user_id, %s
        )
        SELECT 
            bpu.id,
            bpu.user_id,
            bpu.player_name,
            bpu.highest_floor,
            bpu.character_level,
            bpu.character_gold,
            bpu.character_alive,
            bpu.created_at
        FROM best_per_user bpu
        ORDER BY %s
        LIMIT $2
    ', order_clause, order_clause, order_clause)
    USING p_mode, p_limit, p_status_filter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas rápidas do usuário
CREATE OR REPLACE FUNCTION get_fast_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH live_chars AS (
        SELECT 
            COALESCE(MAX(c.floor), 0) as max_floor,
            COALESCE(MAX(c.level), 0) as max_level,
            COALESCE(MAX(c.gold), 0) as max_gold,
            COUNT(*) as live_count
        FROM characters c
        WHERE c.user_id = p_user_id
    ),
    dead_chars AS (
        SELECT 
            COALESCE(MAX(r.highest_floor), 0) as max_floor,
            COALESCE(MAX(r.character_level), 0) as max_level,
            COALESCE(MAX(r.character_gold), 0) as max_gold,
            COUNT(*) as dead_count
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
    )
    SELECT 
        GREATEST(lc.max_floor, dc.max_floor) as best_floor,
        GREATEST(lc.max_level, dc.max_level, 1) as best_level,
        GREATEST(lc.max_gold, dc.max_gold) as best_gold,
        (lc.live_count + dc.dead_count)::INTEGER as total_runs,
        lc.live_count::INTEGER as alive_characters
    FROM live_chars lc, dead_chars dc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking pessoal otimizado
CREATE OR REPLACE FUNCTION get_fast_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id
        ORDER BY c.floor DESC, c.level DESC, c.created_at DESC
    )
    UNION ALL
    (
        -- Personagens mortos
        SELECT 
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
        ORDER BY r.highest_floor DESC, r.character_level DESC, r.created_at DESC
    )
    ORDER BY highest_floor DESC, character_level DESC, created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar as funções dinâmicas para usar as versões otimizadas
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('highest_floor', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('level', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('gold', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Substituir as funções de usuário pelas versões otimizadas
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_fast_user_ranking_history(p_user_id, p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_fast_user_stats(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação das otimizações
COMMENT ON FUNCTION get_optimized_global_ranking IS 'Versão otimizada do ranking global com consultas mais eficientes';
COMMENT ON FUNCTION get_fast_user_stats IS 'Versão otimizada para obter estatísticas do usuário rapidamente';
COMMENT ON FUNCTION get_fast_user_ranking_history IS 'Versão otimizada para obter histórico do usuário rapidamente'; 