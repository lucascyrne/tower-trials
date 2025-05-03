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
DECLARE
    v_monster_pool UUID[];
BEGIN
    -- Selecionar monstros apropriados para o andar
    SELECT ARRAY_AGG(id) INTO v_monster_pool
    FROM monsters
    WHERE min_floor <= p_floor_number
    ORDER BY min_floor DESC
    LIMIT 3;

    RETURN v_monster_pool;
END;
$$ LANGUAGE plpgsql;

-- Função para obter dados do andar
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    monster_id UUID,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT,
    monster_data JSON
) AS $$
DECLARE
    v_floor floors;
    v_monster_id UUID;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors
    WHERE floor_number = p_floor_number;

    -- Se o andar não existe, criar dinamicamente
    IF v_floor IS NULL THEN
        INSERT INTO floors (
            floor_number,
            type,
            monster_pool,
            is_checkpoint,
            min_level,
            description
        ) VALUES (
            p_floor_number,
            CASE 
                WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
                WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
                WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
                ELSE 'common'::floor_type
            END,
            generate_monster_pool(p_floor_number),
            p_floor_number % 10 = 0, -- Checkpoint a cada 10 andares
            GREATEST(1, p_floor_number / 2), -- Nível mínimo recomendado
            CASE 
                WHEN p_floor_number % 10 = 0 THEN 'Andar do Chefe'
                WHEN p_floor_number % 5 = 0 THEN 'Andar de Elite'
                WHEN p_floor_number % 7 = 0 THEN 'Andar de Evento'
                ELSE 'Andar Comum'
            END
        )
        RETURNING * INTO v_floor;
    END IF;

    -- Selecionar um monstro aleatório do pool
    SELECT v_floor.monster_pool[floor(random() * array_length(v_floor.monster_pool, 1)) + 1]
    INTO v_monster_id;

    -- Retornar dados do andar com o monstro selecionado
    RETURN QUERY
    SELECT 
        v_floor.floor_number,
        v_floor.type,
        v_monster_id,
        v_floor.is_checkpoint,
        v_floor.min_level,
        v_floor.description,
        (
            SELECT row_to_json(m.*)
            FROM get_monster_for_floor(p_floor_number) m
            WHERE m.id = v_monster_id
        ) as monster_data;
END;
$$ LANGUAGE plpgsql; 