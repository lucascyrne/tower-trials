-- =============================================
-- MIGRATION: Sistema de Cemitério (Permadeath)
-- Version: 2.0
-- Description: Sistema de cemitério para registrar personagens mortos e estatísticas
-- Dependencies: 00004 (characters)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS dead_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_character_id UUID NOT NULL,
    
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    
    max_hp INTEGER NOT NULL DEFAULT 100,
    max_mana INTEGER NOT NULL DEFAULT 50,
    atk INTEGER NOT NULL DEFAULT 15,
    def INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 12,
    
    floor_reached INTEGER NOT NULL DEFAULT 1,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    total_monsters_killed INTEGER NOT NULL DEFAULT 0,
    total_damage_dealt BIGINT NOT NULL DEFAULT 0,
    total_damage_taken BIGINT NOT NULL DEFAULT 0,
    total_spells_cast INTEGER NOT NULL DEFAULT 0,
    total_potions_used INTEGER NOT NULL DEFAULT 0,
    
    death_cause VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    killed_by_monster VARCHAR(100),
    
    character_created_at TIMESTAMPTZ NOT NULL,
    died_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survival_time_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (died_at - character_created_at)) / 60
    ) STORED,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_dead_characters_user_id ON dead_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_dead_characters_died_at ON dead_characters(died_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_level ON dead_characters(level DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_floor_reached ON dead_characters(floor_reached DESC);

-- === TRIGGERS ===

CREATE TRIGGER update_dead_characters_updated_at
    BEFORE UPDATE ON dead_characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Mover personagem morto para o cemitério
CREATE OR REPLACE FUNCTION kill_character(
    p_character_id UUID,
    p_death_cause VARCHAR DEFAULT 'Battle defeat',
    p_killed_by_monster VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_character_data characters%ROWTYPE;
    v_dead_character_id UUID;
BEGIN
    SELECT * INTO v_character_data FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Character not found: %', p_character_id; END IF;
    
    INSERT INTO dead_characters (
        user_id, original_character_id, name, level, xp, gold,
        strength, dexterity, intelligence, wisdom, vitality, luck,
        max_hp, max_mana, atk, def, speed,
        floor_reached, highest_floor, death_cause, killed_by_monster, character_created_at
    ) VALUES (
        v_character_data.user_id, v_character_data.id, v_character_data.name, v_character_data.level,
        v_character_data.xp, v_character_data.gold, v_character_data.strength, v_character_data.dexterity,
        v_character_data.intelligence, v_character_data.wisdom, v_character_data.vitality, v_character_data.luck,
        v_character_data.max_hp, v_character_data.max_mana, v_character_data.atk, v_character_data.def, v_character_data.speed,
        v_character_data.floor, v_character_data.floor, p_death_cause, p_killed_by_monster, v_character_data.created_at
    ) RETURNING id INTO v_dead_character_id;
    
    DELETE FROM characters WHERE id = p_character_id;
    PERFORM update_user_character_progression(v_character_data.user_id);
    
    RETURN v_dead_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buscar cemitério de um usuário
CREATE OR REPLACE FUNCTION get_user_cemetery(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
    id UUID, name VARCHAR, level INTEGER, floor_reached INTEGER, highest_floor INTEGER,
    death_cause VARCHAR, killed_by_monster VARCHAR, died_at TIMESTAMPTZ, survival_time_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT dc.id, dc.name, dc.level, dc.floor_reached, dc.highest_floor,
           dc.death_cause, dc.killed_by_monster, dc.died_at, dc.survival_time_minutes
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    ORDER BY dc.died_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Buscar estatísticas do cemitério
CREATE OR REPLACE FUNCTION get_cemetery_stats(p_user_id UUID)
RETURNS TABLE (
    total_deaths INTEGER,
    highest_floor_reached INTEGER,
    highest_level_reached INTEGER,
    total_survival_time_hours NUMERIC,
    avg_survival_time_minutes NUMERIC,
    most_common_death_cause VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER,
        COALESCE(MAX(dc.floor_reached), 0)::INTEGER,
        COALESCE(MAX(dc.level), 0)::INTEGER,
        COALESCE(SUM(dc.survival_time_minutes) / 60.0, 0)::NUMERIC,
        COALESCE(AVG(dc.survival_time_minutes), 0)::NUMERIC,
        (
            SELECT death_cause 
            FROM dead_characters 
            WHERE user_id = p_user_id 
            GROUP BY death_cause 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )::VARCHAR
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Buscar detalhes de um personagem morto
CREATE OR REPLACE FUNCTION get_dead_character_details(p_dead_character_id UUID)
RETURNS dead_characters AS $$
DECLARE
    v_dead_character dead_characters;
BEGIN
    SELECT * INTO v_dead_character FROM dead_characters WHERE id = p_dead_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dead character not found'; END IF;
    RETURN v_dead_character;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE dead_characters ENABLE ROW LEVEL SECURITY;

