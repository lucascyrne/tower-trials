-- Migração: Sistema de Cemitério e Permadeath
-- Cria tabela para armazenar dados de personagens mortos

-- Tabela para personagens mortos (cemitério)
CREATE TABLE IF NOT EXISTS dead_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_character_id UUID NOT NULL, -- ID original do personagem quando vivo
    
    -- Dados básicos do personagem na morte
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    
    -- Atributos primários na morte
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    
    -- Stats derivados na morte
    max_hp INTEGER NOT NULL DEFAULT 100,
    max_mana INTEGER NOT NULL DEFAULT 50,
    atk INTEGER NOT NULL DEFAULT 15,
    def INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 12,
    
    -- Dados da jornada
    floor_reached INTEGER NOT NULL DEFAULT 1, -- Andar onde morreu
    highest_floor INTEGER NOT NULL DEFAULT 1, -- Andar mais alto alcançado
    total_monsters_killed INTEGER NOT NULL DEFAULT 0,
    total_damage_dealt BIGINT NOT NULL DEFAULT 0,
    total_damage_taken BIGINT NOT NULL DEFAULT 0,
    total_spells_cast INTEGER NOT NULL DEFAULT 0,
    total_potions_used INTEGER NOT NULL DEFAULT 0,
    
    -- Causa da morte
    death_cause VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    killed_by_monster VARCHAR(100), -- Nome do monstro que matou
    
    -- Tempo de vida do personagem
    character_created_at TIMESTAMPTZ NOT NULL,
    died_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survival_time_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (died_at - character_created_at)) / 60
    ) STORED,
    
    -- Metadados
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dead_characters_user_id ON dead_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_dead_characters_died_at ON dead_characters(died_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_level ON dead_characters(level DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_floor_reached ON dead_characters(floor_reached DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_dead_characters_updated_at
    BEFORE UPDATE ON dead_characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para mover personagem morto para o cemitério
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
    -- Buscar dados do personagem vivo
    SELECT * INTO v_character_data
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Inserir no cemitério
    INSERT INTO dead_characters (
        user_id,
        original_character_id,
        name,
        level,
        xp,
        gold,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        max_hp,
        max_mana,
        atk,
        def,
        speed,
        floor_reached,
        highest_floor,
        death_cause,
        killed_by_monster,
        character_created_at
    ) VALUES (
        v_character_data.user_id,
        v_character_data.id,
        v_character_data.name,
        v_character_data.level,
        v_character_data.xp,
        v_character_data.gold,
        v_character_data.strength,
        v_character_data.dexterity,
        v_character_data.intelligence,
        v_character_data.wisdom,
        v_character_data.vitality,
        v_character_data.luck,
        v_character_data.max_hp,
        v_character_data.max_mana,
        v_character_data.atk,
        v_character_data.def,
        v_character_data.speed,
        v_character_data.floor,
        GREATEST(v_character_data.floor, v_character_data.highest_floor),
        p_death_cause,
        p_killed_by_monster,
        v_character_data.created_at
    ) RETURNING id INTO v_dead_character_id;
    
    -- Deletar personagem vivo
    DELETE FROM characters WHERE id = p_character_id;
    
    -- Atualizar progressão do usuário
    PERFORM update_user_character_progression(v_character_data.user_id);
    
    RETURN v_dead_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar cemitério de um usuário
CREATE OR REPLACE FUNCTION get_user_cemetery(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    original_character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp BIGINT,
    gold BIGINT,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    max_hp INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor_reached INTEGER,
    highest_floor INTEGER,
    total_monsters_killed INTEGER,
    total_damage_dealt BIGINT,
    total_damage_taken BIGINT,
    total_spells_cast INTEGER,
    total_potions_used INTEGER,
    death_cause VARCHAR,
    killed_by_monster VARCHAR,
    character_created_at TIMESTAMPTZ,
    died_at TIMESTAMPTZ,
    survival_time_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.original_character_id,
        dc.name,
        dc.level,
        dc.xp,
        dc.gold,
        dc.strength,
        dc.dexterity,
        dc.intelligence,
        dc.wisdom,
        dc.vitality,
        dc.luck,
        dc.max_hp,
        dc.max_mana,
        dc.atk,
        dc.def,
        dc.speed,
        dc.floor_reached,
        dc.highest_floor,
        dc.total_monsters_killed,
        dc.total_damage_dealt,
        dc.total_damage_taken,
        dc.total_spells_cast,
        dc.total_potions_used,
        dc.death_cause,
        dc.killed_by_monster,
        dc.character_created_at,
        dc.died_at,
        dc.survival_time_minutes
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    ORDER BY dc.died_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para contar personagens mortos de um usuário
CREATE OR REPLACE FUNCTION count_user_cemetery(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM dead_characters
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para estatísticas do cemitério
CREATE OR REPLACE FUNCTION get_cemetery_stats(p_user_id UUID)
RETURNS TABLE (
    total_deaths INTEGER,
    highest_level_reached INTEGER,
    highest_floor_reached INTEGER,
    total_survival_time_hours NUMERIC,
    most_common_death_cause VARCHAR,
    deadliest_monster VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deaths,
        COALESCE(MAX(dc.level), 0)::INTEGER as highest_level_reached,
        COALESCE(MAX(dc.highest_floor), 0)::INTEGER as highest_floor_reached,
        COALESCE(ROUND(SUM(dc.survival_time_minutes) / 60.0, 2), 0) as total_survival_time_hours,
        COALESCE(
            (SELECT death_cause 
             FROM dead_characters 
             WHERE user_id = p_user_id 
             GROUP BY death_cause 
             ORDER BY COUNT(*) DESC 
             LIMIT 1),
            'N/A'
        ) as most_common_death_cause,
        COALESCE(
            (SELECT killed_by_monster 
             FROM dead_characters 
             WHERE user_id = p_user_id AND killed_by_monster IS NOT NULL
             GROUP BY killed_by_monster 
             ORDER BY COUNT(*) DESC 
             LIMIT 1),
            'N/A'
        ) as deadliest_monster
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE dead_characters ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver seus próprios personagens mortos
CREATE POLICY "Users can view own dead characters" ON dead_characters
    FOR SELECT USING (auth.uid() = user_id);

-- Apenas funções do sistema podem inserir personagens mortos
CREATE POLICY "System can insert dead characters" ON dead_characters
    FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE dead_characters IS 'Cemitério - armazena dados de personagens mortos para o sistema de permadeath';
COMMENT ON FUNCTION kill_character IS 'Move um personagem vivo para o cemitério e o deleta permanentemente';
COMMENT ON FUNCTION get_user_cemetery IS 'Retorna personagens mortos de um usuário com paginação';
COMMENT ON FUNCTION count_user_cemetery IS 'Conta total de personagens mortos de um usuário';
COMMENT ON FUNCTION get_cemetery_stats IS 'Retorna estatísticas consolidadas do cemitério de um usuário'; 