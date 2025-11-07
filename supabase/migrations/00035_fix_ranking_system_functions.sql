-- =============================================
-- MIGRATION: Corrigir e Expandir Funções do Sistema de Ranking
-- Version: 1.0
-- Description: Garante que todas as funções de ranking existem, adiciona suporte a permadeath
-- Dependencies: 00012 (ranking system), 00014 (dead characters system), 00004 (characters)
-- =============================================

-- === ALTERAÇÕES NA TABELA CHARACTERS ===

-- Adicionar campo is_alive para controlar status do personagem (permadeath)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT TRUE;

-- === FUNÇÕES DE RANKING ===

-- Contar entradas com filtros
CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_status_filter VARCHAR DEFAULT 'all',
    p_name_filter VARCHAR DEFAULT ''
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM game_rankings gr
    WHERE 
        (p_status_filter = 'all' OR (p_status_filter = 'alive' AND gr.character_alive) OR (p_status_filter = 'dead' AND NOT gr.character_alive))
        AND (p_name_filter = '' OR gr.player_name ILIKE '%' || p_name_filter || '%');
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Ranking dinâmico por andar com filtros e paginação
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 20,
    p_status_filter VARCHAR DEFAULT 'all',
    p_name_filter VARCHAR DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID, user_id UUID, player_name VARCHAR, highest_floor INTEGER,
    character_level INTEGER, character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id, gr.user_id, gr.player_name, gr.highest_floor,
        gr.character_level, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    WHERE 
        (p_status_filter = 'all' OR (p_status_filter = 'alive' AND gr.character_alive) OR (p_status_filter = 'dead' AND NOT gr.character_alive))
        AND (p_name_filter = '' OR gr.player_name ILIKE '%' || p_name_filter || '%')
    ORDER BY gr.highest_floor DESC, gr.character_level DESC, gr.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Ranking dinâmico por nível com filtros e paginação
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 20,
    p_status_filter VARCHAR DEFAULT 'all',
    p_name_filter VARCHAR DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID, user_id UUID, player_name VARCHAR, character_level INTEGER,
    highest_floor INTEGER, character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id, gr.user_id, gr.player_name, gr.character_level,
        gr.highest_floor, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    WHERE 
        (p_status_filter = 'all' OR (p_status_filter = 'alive' AND gr.character_alive) OR (p_status_filter = 'dead' AND NOT gr.character_alive))
        AND (p_name_filter = '' OR gr.player_name ILIKE '%' || p_name_filter || '%')
    ORDER BY gr.character_level DESC, gr.highest_floor DESC, gr.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Ranking dinâmico por ouro com filtros e paginação
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 20,
    p_status_filter VARCHAR DEFAULT 'all',
    p_name_filter VARCHAR DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID, user_id UUID, player_name VARCHAR, character_gold INTEGER,
    highest_floor INTEGER, character_level INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id, gr.user_id, gr.player_name, gr.character_gold,
        gr.highest_floor, gr.character_level, gr.character_alive, gr.created_at
    FROM game_rankings gr
    WHERE 
        (p_status_filter = 'all' OR (p_status_filter = 'alive' AND gr.character_alive) OR (p_status_filter = 'dead' AND NOT gr.character_alive))
        AND (p_name_filter = '' OR gr.player_name ILIKE '%' || p_name_filter || '%')
    ORDER BY gr.character_gold DESC, gr.highest_floor DESC, gr.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Histórico de ranking do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
    id UUID, player_name VARCHAR, highest_floor INTEGER,
    character_level INTEGER, character_gold INTEGER, character_alive BOOLEAN, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id, gr.player_name, gr.highest_floor,
        gr.character_level, gr.character_gold, gr.character_alive, gr.created_at
    FROM game_rankings gr
    WHERE gr.user_id = p_user_id
    ORDER BY gr.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER, best_level INTEGER, best_gold INTEGER, 
    total_runs INTEGER, alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(gr.highest_floor), 0)::INTEGER as best_floor,
        COALESCE(MAX(gr.character_level), 1)::INTEGER as best_level,
        COALESCE(MAX(gr.character_gold), 0)::INTEGER as best_gold,
        COUNT(*)::INTEGER as total_runs,
        COUNT(*) FILTER (WHERE gr.character_alive)::INTEGER as alive_characters
    FROM game_rankings gr
    WHERE gr.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- === FUNÇÕES PARA PERMADEATH ===

-- Salvar entrada no ranking quando personagem morre (sem deletar o personagem original)
CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character characters%ROWTYPE;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem antes de morrer
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Salvar no ranking
    INSERT INTO game_rankings (
        user_id, player_name, highest_floor, character_level, character_gold, character_alive
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.floor,
        v_character.level,
        v_character.gold,
        FALSE  -- Marcar como morto
    )
    RETURNING id INTO v_ranking_id;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Marcar personagem como morto (sem deletar)
CREATE OR REPLACE FUNCTION mark_character_dead(
    p_character_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_character_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM characters WHERE id = p_character_id) INTO v_character_exists;
    
    IF NOT v_character_exists THEN
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Salvar no ranking histórico
    PERFORM save_ranking_entry_on_death(p_character_id);
    
    -- Marcar como morto sem deletar
    UPDATE characters 
    SET is_alive = FALSE, updated_at = NOW()
    WHERE id = p_character_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

