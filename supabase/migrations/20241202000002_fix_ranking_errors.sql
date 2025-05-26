-- Migração para corrigir erros de coluna inexistente e tipos incompatíveis
-- Corrige problemas com critical_chance e tipos VARCHAR vs TEXT

-- =====================================
-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA CHARACTERS
-- =====================================

-- Adicionar colunas critical_chance e critical_damage se não existirem
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS critical_chance NUMERIC(5,2) DEFAULT 5.0;

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS critical_damage NUMERIC(5,2) DEFAULT 1.5;

-- Atualizar valores baseados nos atributos existentes
UPDATE characters 
SET 
    critical_chance = ROUND((luck * 0.5)::NUMERIC, 2),
    critical_damage = ROUND((1.5 + (luck::NUMERIC / 100))::NUMERIC, 2)
WHERE critical_chance IS NULL OR critical_damage IS NULL;

-- =====================================
-- 2. CORRIGIR TIPOS DE RETORNO DAS FUNÇÕES DE RANKING
-- =====================================

-- Remover funções com tipos incompatíveis
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid, integer);

-- Recriar função para ranking dinâmico por andar mais alto
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

-- Recriar função para ranking dinâmico por nível
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

-- Recriar função para ranking dinâmico por ouro
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

-- Recriar função para histórico de ranking do usuário
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

-- =====================================
-- 3. ATUALIZAR FUNÇÃO get_user_characters PARA INCLUIR CRITICAL_CHANCE
-- =====================================

-- Remover função existente
DROP FUNCTION IF EXISTS get_user_characters(UUID);

-- Recriar função com colunas corretas
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
        COALESCE(c.is_alive, true),
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id 
      AND COALESCE(c.is_alive, true) = true  -- Apenas personagens vivos
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO get_character_full_stats
-- =====================================

-- Remover função existente se houver
DROP FUNCTION IF EXISTS get_character_full_stats(UUID);

-- Recriar função com todas as colunas necessárias
CREATE OR REPLACE FUNCTION get_character_full_stats(p_character_id UUID)
RETURNS TABLE(
    character_id UUID,
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
    magic_mastery_xp INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as character_id,
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
        c.magic_mastery_xp
    FROM characters c
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. CRIAR TRIGGER PARA ATUALIZAR CRITICAL_CHANCE AUTOMATICAMENTE
-- =====================================

-- Função para recalcular critical_chance e critical_damage baseado em luck
CREATE OR REPLACE FUNCTION update_critical_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar critical_chance e critical_damage baseado no luck
    NEW.critical_chance := ROUND((NEW.luck * 0.5)::NUMERIC, 2);
    NEW.critical_damage := ROUND((1.5 + (NEW.luck::NUMERIC / 100))::NUMERIC, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar automaticamente quando luck mudar
DROP TRIGGER IF EXISTS update_critical_stats_trigger ON characters;
CREATE TRIGGER update_critical_stats_trigger
    BEFORE UPDATE OF luck ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_critical_stats();

-- =====================================
-- 6. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar todos os personagens existentes com valores corretos de crítico
UPDATE characters 
SET 
    critical_chance = ROUND((luck * 0.5)::NUMERIC, 2),
    critical_damage = ROUND((1.5 + (luck::NUMERIC / 100))::NUMERIC, 2)
WHERE critical_chance IS NULL 
   OR critical_damage IS NULL 
   OR critical_chance = 0;

-- Garantir que is_alive tenha valor padrão
UPDATE characters 
SET is_alive = true 
WHERE is_alive IS NULL;

-- Script concluído com sucesso!
-- Erros de coluna inexistente e tipos incompatíveis corrigidos 