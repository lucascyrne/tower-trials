-- =============================================
-- MIGRATION: Salvar Personagens Vivos no Ranking
-- Version: 1.0
-- Description: Adiciona função para salvar/atualizar personagens vivos no ranking durante o jogo
-- Dependencies: 00012 (ranking system), 00035 (permadeath system)
-- =============================================

-- === FUNÇÕES PARA SALVAR PERSONAGENS VIVOS ===

-- Salvar ou atualizar entrada de personagem vivo no ranking
CREATE OR REPLACE FUNCTION save_alive_character_to_ranking(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character characters%ROWTYPE;
    v_existing_ranking game_rankings%ROWTYPE;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Verificar se já existe entrada recente para este personagem vivo
    SELECT * INTO v_existing_ranking 
    FROM game_rankings 
    WHERE user_id = v_character.user_id 
      AND player_name = v_character.name
      AND character_alive = TRUE
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Se não existe ou é antiga, criar nova entrada
    IF v_existing_ranking IS NULL THEN
        INSERT INTO game_rankings (
            user_id, player_name, highest_floor, character_level, character_gold, character_alive
        )
        VALUES (
            v_character.user_id,
            v_character.name,
            v_character.floor,
            v_character.level,
            v_character.gold,
            TRUE  -- Marcado como vivo
        )
        RETURNING id INTO v_ranking_id;
    ELSE
        -- Atualizar entrada existente com stats mais recentes
        UPDATE game_rankings 
        SET 
            highest_floor = GREATEST(highest_floor, v_character.floor),
            character_level = GREATEST(character_level, v_character.level),
            character_gold = GREATEST(character_gold, v_character.gold),
            updated_at = NOW()
        WHERE id = v_existing_ranking.id;
        
        v_ranking_id := v_existing_ranking.id;
    END IF;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Salvar snapshot do personagem ao sair da batalha (vivo ou não)
CREATE OR REPLACE FUNCTION save_character_snapshot_to_ranking(
    p_character_id UUID,
    p_is_alive BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_character characters%ROWTYPE;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Sempre criar nova entrada (snapshot do momento)
    INSERT INTO game_rankings (
        user_id, player_name, highest_floor, character_level, character_gold, character_alive
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.floor,
        v_character.level,
        v_character.gold,
        p_is_alive
    )
    RETURNING id INTO v_ranking_id;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

