-- =============================================
-- MIGRATION: Sistema de Ranking
-- Version: 2.0
-- Description: Rankings globais, progressão e leaderboards
-- Dependencies: 00003 (users)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS game_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
    character_alive BOOLEAN DEFAULT TRUE,
    character_level INTEGER DEFAULT 1,
    character_gold INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(uid) ON DELETE CASCADE,
    character_name VARCHAR(100) NOT NULL,
    current_floor INTEGER DEFAULT 1,
    last_save TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor ON game_rankings(highest_floor DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_user_id ON game_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_game_rankings_level ON game_rankings(character_level DESC);
CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON game_progress(user_id);

-- === FUNÇÕES ===

-- Salvar ranking
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name VARCHAR,
    p_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_ranking_id UUID;
    v_existing_rank RECORD;
BEGIN
    SELECT * INTO v_existing_rank 
    FROM game_rankings 
    WHERE user_id = p_user_id AND player_name = p_player_name
    ORDER BY highest_floor DESC 
    LIMIT 1;
    
    IF v_existing_rank IS NULL OR p_floor > v_existing_rank.highest_floor THEN
        INSERT INTO game_rankings (user_id, player_name, highest_floor, character_level, character_gold, character_alive)
        VALUES (p_user_id, p_player_name, p_floor, p_character_level, p_character_gold, p_character_alive)
        RETURNING id INTO v_ranking_id;
    ELSE
        v_ranking_id := v_existing_rank.id;
    END IF;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql;

-- Buscar ranking global (por andar)
CREATE OR REPLACE FUNCTION get_global_ranking(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    rank BIGINT, player_name VARCHAR, highest_floor INTEGER, 
    character_level INTEGER, character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY gr.highest_floor DESC, gr.character_level DESC, gr.created_at ASC),
        gr.player_name, gr.highest_floor, gr.character_level, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    ORDER BY gr.highest_floor DESC, gr.character_level DESC, gr.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Buscar ranking por nível
CREATE OR REPLACE FUNCTION get_level_ranking(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    rank BIGINT, player_name VARCHAR, character_level INTEGER, 
    highest_floor INTEGER, character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY gr.character_level DESC, gr.highest_floor DESC, gr.created_at ASC),
        gr.player_name, gr.character_level, gr.highest_floor, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    ORDER BY gr.character_level DESC, gr.highest_floor DESC, gr.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Buscar posição do jogador no ranking (por andar)
CREATE OR REPLACE FUNCTION get_player_floor_rank(p_user_id UUID, p_player_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_rank INTEGER;
    v_highest_floor INTEGER;
BEGIN
    SELECT highest_floor INTO v_highest_floor 
    FROM game_rankings 
    WHERE user_id = p_user_id AND player_name = p_player_name
    ORDER BY highest_floor DESC 
    LIMIT 1;
    
    IF v_highest_floor IS NULL THEN RETURN 0; END IF;
    
    SELECT COUNT(*) + 1 INTO v_rank
    FROM game_rankings gr
    WHERE gr.highest_floor > v_highest_floor 
       OR (gr.highest_floor = v_highest_floor AND gr.character_level > (
           SELECT character_level FROM game_rankings 
           WHERE user_id = p_user_id AND player_name = p_player_name AND highest_floor = v_highest_floor
           ORDER BY character_level DESC LIMIT 1
       ));
    
    RETURN v_rank;
END;
$$ LANGUAGE plpgsql;

-- Buscar posição do jogador no ranking (por nível)
CREATE OR REPLACE FUNCTION get_player_level_rank(p_user_id UUID, p_player_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_rank INTEGER;
    v_highest_level INTEGER;
BEGIN
    SELECT character_level INTO v_highest_level 
    FROM game_rankings 
    WHERE user_id = p_user_id AND player_name = p_player_name
    ORDER BY character_level DESC 
    LIMIT 1;
    
    IF v_highest_level IS NULL THEN RETURN 0; END IF;
    
    SELECT COUNT(*) + 1 INTO v_rank
    FROM game_rankings gr
    WHERE gr.character_level > v_highest_level 
       OR (gr.character_level = v_highest_level AND gr.highest_floor > (
           SELECT highest_floor FROM game_rankings 
           WHERE user_id = p_user_id AND player_name = p_player_name AND character_level = v_highest_level
           ORDER BY highest_floor DESC LIMIT 1
       ));
    
    RETURN v_rank;
END;
$$ LANGUAGE plpgsql;

-- Limpar rankings antigos (manter top 1000)
CREATE OR REPLACE FUNCTION cleanup_old_rankings()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH ranked_entries AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY highest_floor DESC, character_level DESC, created_at ASC) as rn
        FROM game_rankings
    )
    DELETE FROM game_rankings
    WHERE id IN (SELECT id FROM ranked_entries WHERE rn > 1000);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Buscar rankings do usuário
CREATE OR REPLACE FUNCTION get_user_rankings(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    player_name VARCHAR, highest_floor INTEGER, character_level INTEGER, 
    character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT gr.player_name, gr.highest_floor, gr.character_level, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    WHERE gr.user_id = p_user_id
    ORDER BY gr.highest_floor DESC, gr.character_level DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Buscar top 10 rankings
CREATE OR REPLACE FUNCTION get_top_rankings()
RETURNS TABLE (
    rank BIGINT, player_name VARCHAR, highest_floor INTEGER, 
    character_level INTEGER, character_alive BOOLEAN
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM get_global_ranking(10);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE game_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;

