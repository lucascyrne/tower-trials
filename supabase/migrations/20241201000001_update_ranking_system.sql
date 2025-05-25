-- Atualização do sistema de ranking
-- Adicionar colunas necessárias à tabela game_rankings

-- Adicionar coluna para indicar se o personagem está vivo
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_alive BOOLEAN DEFAULT TRUE;

-- Adicionar colunas para novas modalidades de ranking
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS character_gold INTEGER DEFAULT 0;

-- Criar índices para otimizar consultas de ranking
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor_alive ON game_rankings(highest_floor DESC, character_alive);
CREATE INDEX IF NOT EXISTS idx_game_rankings_level ON game_rankings(character_level DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_gold ON game_rankings(character_gold DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_user_alive ON game_rankings(user_id, character_alive);

-- Função para salvar entrada no ranking com informações completas
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name VARCHAR,
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_ranking_id UUID;
BEGIN
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        p_user_id,
        p_player_name,
        p_highest_floor,
        p_character_level,
        p_character_gold,
        p_character_alive,
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por andar mais alto
CREATE OR REPLACE FUNCTION get_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
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
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.highest_floor DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior nível
CREATE OR REPLACE FUNCTION get_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
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
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.character_level DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior quantidade de ouro
CREATE OR REPLACE FUNCTION get_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
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
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.character_gold DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking pessoal do usuário
CREATE OR REPLACE FUNCTION get_user_ranking_history(
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
    ORDER BY r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar registros existentes com valores padrão
UPDATE game_rankings 
SET 
    character_alive = TRUE,
    character_level = 1,
    character_gold = 0
WHERE character_alive IS NULL 
   OR character_level IS NULL 
   OR character_gold IS NULL;

-- Adicionar comentários às colunas
COMMENT ON COLUMN game_rankings.character_alive IS 'Indica se o personagem estava vivo quando a entrada foi criada';
COMMENT ON COLUMN game_rankings.character_level IS 'Nível do personagem quando a entrada foi criada';
COMMENT ON COLUMN game_rankings.character_gold IS 'Quantidade de ouro do personagem quando a entrada foi criada'; 