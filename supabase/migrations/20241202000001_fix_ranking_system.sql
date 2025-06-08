-- Migração para corrigir completamente o sistema de ranking
-- Remove sistema antigo e implementa sistema dinâmico baseado na tabela characters

-- =====================================
-- 1. LIMPEZA DO SISTEMA ANTIGO
-- =====================================

-- Remover funções antigas do sistema de ranking
DROP FUNCTION IF EXISTS save_ranking_entry(uuid, text, integer, integer, integer, boolean);
DROP FUNCTION IF EXISTS get_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_user_ranking_history(uuid, integer);
DROP FUNCTION IF EXISTS get_user_stats(uuid);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(text, integer, text);
DROP FUNCTION IF EXISTS get_fast_user_stats(uuid);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(uuid, integer);

-- Remover triggers antigos
DROP TRIGGER IF EXISTS update_character_ranking_on_progress ON characters;
DROP FUNCTION IF EXISTS update_character_ranking_on_progress();

-- Remover tabelas antigas do sistema de ranking
DROP TABLE IF EXISTS game_rankings CASCADE;
DROP TABLE IF EXISTS ranking CASCADE;

-- =====================================
-- 2. ADICIONAR CAMPO PARA CONTROLAR STATUS DO PERSONAGEM
-- =====================================

-- Adicionar campo is_alive para controlar se o personagem está vivo
-- Personagens mortos ficam is_alive = false mas permanecem no banco para ranking
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT true;

-- Atualizar personagens existentes baseado no HP
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive IS NULL;

-- Criar índice para otimizar consultas por status
CREATE INDEX IF NOT EXISTS idx_characters_is_alive ON characters(is_alive);

-- =====================================
-- 3. FUNÇÕES DO SISTEMA DINÂMICO
-- =====================================

-- Função para salvar entrada no ranking (compatibilidade)
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name TEXT,
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- No sistema dinâmico, os dados já estão na tabela characters
    -- Esta função existe apenas para compatibilidade
    RETURN 'success';
END;
$$;

-- Função para ranking dinâmico por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
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
AS $$
BEGIN
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
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
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
AS $$
BEGIN
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
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
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
AS $$
BEGIN
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
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para histórico de ranking do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
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
AS $$
BEGIN
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

-- Função para estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
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
-- 4. ATUALIZAR FUNÇÃO get_user_characters PARA RETORNAR APENAS VIVOS
-- =====================================

-- Primeiro remover a função existente para evitar conflito de tipos
DROP FUNCTION IF EXISTS get_user_characters(UUID);

-- Recriar a função com o tipo de retorno correto
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER,
    is_alive BOOLEAN,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp,
        c.is_alive,
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id 
      AND c.is_alive = true  -- Apenas personagens vivos
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO delete_character PARA MARCAR COMO MORTO
-- =====================================

-- Primeiro remover a função existente para evitar conflito de tipos
DROP FUNCTION IF EXISTS delete_character(UUID);

-- Recriar a função para marcar como morto ao invés de deletar
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Obter user_id antes de marcar como morto
    SELECT user_id INTO v_user_id
    FROM characters
    WHERE id = p_character_id;
    
    -- Marcar personagem como morto ao invés de deletar
    UPDATE characters 
    SET 
        is_alive = false,
        hp = 0,  -- Garantir que HP seja 0
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Atualizar progressão do usuário
    IF v_user_id IS NOT NULL THEN
        PERFORM update_user_character_progression(v_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. CRIAR ÍNDICES OTIMIZADOS
-- =====================================

-- Índices para ranking por andar (apenas personagens que jogaram)
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor 
ON characters(floor DESC, level DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_ranking_level 
ON characters(level DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold 
ON characters(gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para filtros de status
CREATE INDEX IF NOT EXISTS idx_characters_alive_ranking 
ON characters(is_alive, floor DESC, level DESC) 
WHERE floor > 0;

-- Índices para histórico do usuário
CREATE INDEX IF NOT EXISTS idx_characters_user_history 
ON characters(user_id, created_at DESC);

-- Índice composto para personagens vivos do usuário
CREATE INDEX IF NOT EXISTS idx_characters_user_alive 
ON characters(user_id, is_alive, created_at DESC) 
WHERE is_alive = true;

-- =====================================
-- 7. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Garantir que todos os personagens tenham floor >= 1
UPDATE characters 
SET floor = 1 
WHERE floor IS NULL OR floor < 1;

-- Garantir que is_alive esteja correto baseado no HP
UPDATE characters 
SET is_alive = (hp > 0);

-- Script concluído com sucesso!
-- Sistema de ranking corrigido e otimizado 