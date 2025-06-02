-- =====================================
-- CORRIGIR RASTREAMENTO DO ANDAR MAIS ALTO
-- Data: 2024-12-02
-- Versão: 13 (Correção)
-- =====================================

-- Este sistema corrige:
-- 1. Adiciona coluna highest_floor na tabela characters
-- 2. Atualiza funções de ranking para usar highest_floor
-- 3. Cria trigger para manter highest_floor atualizado
-- 4. Corrige lógica de atualização de progresso

-- =====================================
-- 1. ADICIONAR COLUNA HIGHEST_FLOOR
-- =====================================

-- Adicionar coluna highest_floor se não existir
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS highest_floor INTEGER DEFAULT 1;

-- Atualizar registros existentes onde highest_floor é menor que floor atual
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- Garantir que highest_floor nunca seja menor que floor atual
UPDATE characters 
SET highest_floor = floor 
WHERE highest_floor < floor;

-- =====================================
-- 2. TRIGGER PARA MANTER HIGHEST_FLOOR ATUALIZADO
-- =====================================

-- Função do trigger
CREATE OR REPLACE FUNCTION update_highest_floor_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Sempre manter o highest_floor como o maior valor entre o atual e o novo
    NEW.highest_floor = GREATEST(COALESCE(OLD.highest_floor, 1), NEW.floor);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS maintain_highest_floor ON characters;

-- Criar trigger
CREATE TRIGGER maintain_highest_floor
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_highest_floor_trigger();

-- =====================================
-- 3. ATUALIZAR FUNÇÃO DE RANKING POR ANDAR
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
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
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- Sistema híbrido: personagens vivos da tabela characters + mortos da tabela game_rankings
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor em vez de floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0 -- Usar highest_floor
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.highest_floor DESC, c.level DESC, c.created_at ASC
    ),
    dead_characters AS (
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              -- Evitar duplicatas: se o usuário tem personagem vivo, não incluir os mortos
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.highest_floor DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO DE RANKING POR NÍVEL
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
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
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.level DESC, c.highest_floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.character_level DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE RANKING POR OURO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
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
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.gold DESC, c.highest_floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.character_gold DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 6. FUNÇÃO PARA CONTAR TOTAL DE ENTRADAS
-- =====================================

CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH live_characters AS (
        SELECT DISTINCT c.user_id
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        SELECT DISTINCT gr.user_id
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
    ),
    combined_users AS (
        SELECT user_id FROM live_characters
        UNION
        SELECT user_id FROM dead_characters
    )
    SELECT COUNT(*)::INTEGER INTO v_count FROM combined_users;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 7. ATUALIZAR FUNÇÃO SAVE_RANKING_ENTRY_ON_DEATH
-- =====================================

CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character RECORD;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.user_id,
        c.name,
        c.highest_floor, -- CORRIGIDO: usar highest_floor
        c.level,
        c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Salvar no ranking histórico
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
        v_character.user_id,
        v_character.name,
        v_character.highest_floor, -- CORRIGIDO: usar highest_floor
        v_character.level,
        v_character.gold,
        false, -- character_alive = false
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RAISE NOTICE '[RANKING] Entrada salva para personagem morto: % (andar máximo %)', v_character.name, v_character.highest_floor;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 8. ATUALIZAR ÍNDICES
-- =====================================

-- Índice para highest_floor
CREATE INDEX IF NOT EXISTS idx_characters_highest_floor 
ON characters(highest_floor DESC);

-- Índices otimizados com highest_floor
CREATE INDEX IF NOT EXISTS idx_characters_ranking_highest_floor_optimized 
ON characters(is_alive, highest_floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true AND highest_floor > 0;

-- =====================================
-- 9. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DO RASTREAMENTO DE ANDAR MÁXIMO';
    RAISE NOTICE 'Versão: 13 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Coluna highest_floor adicionada';
    RAISE NOTICE '✓ Trigger para manter highest_floor atualizado';
    RAISE NOTICE '✓ Funções de ranking corrigidas';
    RAISE NOTICE '✓ Filtro por nome adicionado';
    RAISE NOTICE '✓ Paginação implementada';
    RAISE NOTICE '✓ Função de contagem criada';
    RAISE NOTICE '====================================';
END $$; 