-- Atualizar funções RPC para suportar filtro de personagens mortos

-- Função para obter ranking por andar mais alto (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
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
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.highest_floor DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior nível (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
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
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.character_level DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior quantidade de ouro (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
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
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.character_gold DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 