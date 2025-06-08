-- Criar enum para tipos de andar
CREATE TYPE floor_type AS ENUM ('common', 'elite', 'event', 'boss');

-- Criar tabela de andares
CREATE TABLE IF NOT EXISTS floors (
    floor_number INTEGER PRIMARY KEY,
    type floor_type NOT NULL DEFAULT 'common',
    monster_pool UUID[] NOT NULL, -- Array de IDs de monstros possíveis
    is_checkpoint BOOLEAN DEFAULT FALSE, -- Andares que salvam progresso
    min_level INTEGER NOT NULL DEFAULT 1, -- Nível mínimo recomendado
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_floor_number CHECK (floor_number > 0)
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar pool de monstros para um andar
CREATE OR REPLACE FUNCTION generate_monster_pool(p_floor_number INTEGER)
RETURNS UUID[] AS $$
BEGIN
    RETURN (
        SELECT ARRAY_AGG(id ORDER BY min_floor DESC)
        FROM (
            SELECT id, min_floor
            FROM monsters
            WHERE min_floor <= p_floor_number
            ORDER BY min_floor DESC
            LIMIT 3
        ) subquery
    );
END;
$$ LANGUAGE plpgsql;

-- Função para obter dados do andar
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    -- Se o andar não existe, gerar informações dinamicamente
    IF v_floor IS NULL THEN
        v_floor_type := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
            WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
            ELSE 'common'::floor_type
        END;
        
        v_is_checkpoint := p_floor_number % 10 = 0;
        v_min_level := GREATEST(1, p_floor_number / 2);
        
        v_description := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'Andar do Chefe'
            WHEN p_floor_number % 5 = 0 THEN 'Andar de Elite'
            WHEN p_floor_number % 7 = 0 THEN 'Andar de Evento'
            ELSE 'Andar Comum'
        END || ' ' || p_floor_number;
        
        RETURN QUERY
        SELECT 
            p_floor_number,
            v_floor_type,
            v_is_checkpoint,
            v_min_level,
            v_description;
    ELSE
        -- Retornar dados do andar existente
        RETURN QUERY
        SELECT 
            v_floor.floor_number,
            v_floor.type,
            v_floor.is_checkpoint,
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para obter checkpoints desbloqueados
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Sempre incluir o andar 1
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints a cada 10 andares até o andar mais alto
    RETURN QUERY
    SELECT 
        f.floor_number,
        CASE 
            WHEN f.floor_number % 10 = 0 THEN 'Andar ' || f.floor_number || ' - Checkpoint de Chefe'
            ELSE 'Andar ' || f.floor_number || ' - Checkpoint'
        END::TEXT as description
    FROM generate_series(10, p_highest_floor, 10) as f(floor_number)
    WHERE f.floor_number <= p_highest_floor
    ORDER BY f.floor_number;
END;
$$ LANGUAGE plpgsql; 